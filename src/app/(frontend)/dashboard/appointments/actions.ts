'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { toActionError, type ActionResult } from '@/lib/errors'
import { wallTimeToUTC } from '@/lib/reports'
import { computeEnd, findConflict } from '@/lib/booking'
import { checkAvailability, formatWindow, windowOf, type AvailabilityTag } from '@/lib/availability'
import { DEFAULT_TIMEZONE } from '@/lib/constants'
import type { Tenant, User } from '@/payload-types'
import { isPractitioner } from '@/lib/practice'
import { practitionerWhere } from '@/lib/practice'

async function actorTenant() {
  const user = await getCurrentUser()
  if (!user || user.role === 'superAdmin') return null
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)
  const tenant = tenantID
    ? await payload.findByID({ collection: 'tenants', id: tenantID, depth: 0, overrideAccess: true })
    : null
  return { user, payload, tenantID: tenantID!, tenant: tenant as Tenant | null }
}

export type DoctorAvailabilityHit = {
  id: string
  name: string
  tag: AvailabilityTag
  note: string
  free: boolean // within availability AND no clash
}

/** "Which doctors can see a patient at this date+time?" — powers the call-in flow. */
export async function availableDoctorsAt(
  date: string,
  time: string,
  durationMins: number,
): Promise<DoctorAvailabilityHit[]> {
  const ctx = await actorTenant()
  if (!ctx || !date || !time) return []
  const { payload, tenantID, tenant } = ctx
  const tz = tenant?.settings?.timezone || DEFAULT_TIMEZONE
  const start = wallTimeToUTC(tz, date, time)
  const end = computeEnd(start, durationMins || tenant?.settings?.appointmentDurationMins || 15)

  const docs = await payload.find({
    collection: 'users',
    where: { and: [practitionerWhere(String(tenantID)), { active: { equals: true } }] },
    limit: 50,
    sort: 'name',
    overrideAccess: true,
  })

  const hits: DoctorAvailabilityHit[] = []
  for (const d of docs.docs as User[]) {
    const a = checkAvailability(d, start, end, tz)
    if (!a.inFinder) continue // by-appointment doctors are hidden from the auto finder
    let free = a.bookable
    if (free) {
      const clash = await findConflict({
        payload,
        tenantID,
        doctorID: String(d.id),
        start,
        end,
      })
      if (clash) free = false
    }
    hits.push({
      id: String(d.id),
      name: d.name,
      tag: a.tag,
      note: a.tag === 'onCall' ? 'De guardia' : a.reason || formatWindow(windowOf(d)),
      free,
    })
  }
  return hits
}

export async function bookAppointment(
  formData: FormData,
): Promise<ActionResult<{ id: string; token?: string }>> {
  const ctx = await actorTenant()
  if (!ctx) return { ok: false, code: 'FORBIDDEN', message: 'No tiene permiso para realizar esta acción.' }
  const { user, payload, tenant } = ctx

  const patient = String(formData.get('patient') || '')
  const doctorID = String(formData.get('doctor') || '')
  const date = String(formData.get('date') || '')
  const time = String(formData.get('time') || '')
  const durationMins = Number(formData.get('durationMins') || tenant?.settings?.appointmentDurationMins || 15)
  const reason = String(formData.get('reason') || '')
  const isWalkIn = formData.get('isWalkIn') === 'on'

  if (!patient || !doctorID || !date || !time) {
    return { ok: false, code: 'VALIDATION', message: 'Paciente, médico, fecha y hora son obligatorios.' }
  }

  const tz = tenant?.settings?.timezone || DEFAULT_TIMEZONE
  const start = wallTimeToUTC(tz, date, time)
  const end = computeEnd(start, durationMins)

  // Enforce the doctor's availability (regular doctors are blocked off-window).
  try {
    const doctor = (await payload.findByID({ collection: 'users', id: doctorID, depth: 0, overrideAccess: true })) as User
    // Never reveal (or book) another clinic's doctor: treat a foreign id as unknown.
    if (getTenantID(doctor as never) !== ctx.tenantID || !isPractitioner(doctor)) throw new Error('foreign doctor')
    const avail = checkAvailability(doctor, start, end, tz)
    if (!avail.bookable) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: `No se puede agendar con ${doctor.name} en ese horario: ${avail.reason}.`,
      }
    }
  } catch {
    return { ok: false, code: 'VALIDATION', message: 'No se pudo verificar el médico.' }
  }

  try {
    const appt = await payload.create({
      collection: 'appointments',
      user,
      overrideAccess: false,
      data: {
        patient,
        doctor: doctorID,
        start: start.toISOString(),
        durationMins,
        reason: reason || undefined,
        isWalkIn,
        status: isWalkIn ? 'checked-in' : 'scheduled',
      } as never,
    })
    revalidatePath('/dashboard/appointments')
    return { ok: true, data: { id: String(appt.id), token: (appt as { tokenNumber?: string }).tokenNumber } }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}

export async function updateAppointmentStatus(
  id: string,
  status: string,
  cancellationReason?: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await actorTenant()
  if (!ctx) return { ok: false, code: 'FORBIDDEN', message: 'No tiene permiso para realizar esta acción.' }
  const { user, payload } = ctx

  try {
    await payload.update({
      collection: 'appointments',
      id,
      user,
      overrideAccess: false,
      data: { status, ...(cancellationReason ? { cancellationReason } : {}) } as never,
    })
    revalidatePath('/dashboard/appointments')
    revalidatePath('/dashboard')
    return { ok: true, data: { id } }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}

/**
 * "Atender ahora": start a consultation for a patient straight from their file,
 * without booking first (the everyday flow of an independent doctor). Creates a
 * checked-in walk-in appointment with the acting practitioner — or, when an
 * assistant/owner who doesn't practise starts it, with the practice's only active
 * doctor — and returns its id so the UI can open the visit form.
 */
export async function startConsultation(
  patientId: string,
): Promise<ActionResult<{ appointmentId: string }>> {
  const ctx = await actorTenant()
  if (!ctx) return { ok: false, code: 'FORBIDDEN', message: 'No tiene permiso para realizar esta acción.' }
  const { user, payload, tenantID, tenant } = ctx

  let doctorID: string | null = isPractitioner(user) ? String(user.id) : null
  if (!doctorID) {
    const docs = await payload.find({
      collection: 'users',
      where: { and: [practitionerWhere(String(tenantID)), { active: { equals: true } }] },
      limit: 2,
      depth: 0,
      overrideAccess: true,
    })
    if (docs.totalDocs !== 1) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: 'Hay varios médicos: agende la cita desde la agenda para elegir con quién.',
      }
    }
    doctorID = String(docs.docs[0].id)
  }

  try {
    const appt = await payload.create({
      collection: 'appointments',
      user,
      overrideAccess: false,
      data: {
        patient: patientId,
        doctor: doctorID,
        start: new Date().toISOString(),
        durationMins: tenant?.settings?.appointmentDurationMins || 20,
        reason: 'Consulta sin cita previa',
        isWalkIn: true,
        status: 'checked-in',
      } as never,
    })
    revalidatePath('/dashboard/appointments')
    return { ok: true, data: { appointmentId: String(appt.id) } }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}
