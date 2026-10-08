// Public online booking (/agendar/<slug>). Patients pick a free slot inside a
// doctor's published schedule and the appointment is confirmed immediately; a
// clinic may also accept "extra / emergency" requests that staff review.
//
// There is no logged-in user on this path, so everything runs with
// overrideAccess and the tenant set explicitly. The Appointments hooks still run:
// the double-booking guard (inside the request transaction) plus the partial
// unique index on (tenant, doctor, start) make two simultaneous bookings for the
// same slot impossible.

import type { Payload } from 'payload'
import { APIError } from 'payload'
import { ACTIVE_STATUSES, ALL_DAYS, DEFAULT_APPOINTMENT_DURATION, DEFAULT_TIMEZONE, ERROR_CODES, GENDERS } from './constants'
import { hhmmToMinutes, weekdayInTz, windowOf } from './availability'
import { computeEnd, overlaps } from './booking'
import { practitionerWhere } from './practice'
import { startOfDayInTz, wallTimeToUTC } from './reports'
import type { Patient, Tenant, User } from '@/payload-types'

/** How far ahead patients may book. */
export const BOOKING_WINDOW_DAYS = 30
/** Minimum notice: no online booking for a slot starting sooner than this. */
export const MIN_LEAD_MINUTES = 120

export type PublicService = { name: string; durationMins: number; price: number | null }

export type PublicDoctor = {
  id: string
  name: string
  specialty: string | null
  licenseNumber: string | null
  days: string[]
  from: string
  to: string
  /** Appointment types offered online; never empty (falls back to one "Consulta"). */
  services: PublicService[]
}

export type PublicClinic = {
  tenantId: string
  name: string
  slug: string
  phone: string | null
  address: string | null
  city: string | null
  currency: string | null
  tz: string
  durationMins: number
  requestsEnabled: boolean
  doctors: PublicDoctor[]
}

const fail = (message: string, status = 400, code: string = ERROR_CODES.VALIDATION) =>
  new APIError(message, status, { code })

/** YYYY-MM-DD of an instant as seen in `tz`. */
export function dateInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

const toHHMM = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

/** Active clinic with online booking on, and its bookable doctors; null otherwise. */
export async function getPublicClinic(payload: Payload, slug: string): Promise<PublicClinic | null> {
  if (!slug || !/^[a-z0-9-]{1,80}$/.test(slug)) return null
  const res = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const tenant = res.docs[0] as Tenant | undefined
  if (!tenant || tenant.status !== 'active' || tenant.settings?.onlineBookingEnabled === false) return null

  const users = await payload.find({
    collection: 'users',
    where: { and: [practitionerWhere(String(tenant.id)), { active: { not_equals: false } }] },
    sort: 'name',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  // Only doctors with a published schedule are bookable online; on-call and
  // by-appointment doctors are booked by the clinic itself.
  const doctors = (users.docs as User[])
    .filter((d) => (d.availabilityType ?? 'regular') === 'regular')
    .map((d) => {
      const win = windowOf(d)
      const services: PublicService[] = (d.bookingServices ?? [])
        .filter((s) => s.name?.trim() && s.durationMins)
        .map((s) => ({ name: s.name.trim(), durationMins: s.durationMins, price: s.price ?? null }))
      return {
        id: String(d.id),
        name: d.name,
        specialty: d.specialty ?? null,
        licenseNumber: d.licenseNumber ?? null,
        services: services.length
          ? services
          : [{ name: 'Consulta', durationMins: tenant.settings?.appointmentDurationMins || DEFAULT_APPOINTMENT_DURATION, price: d.consultationFee ?? null }],
        days: (d.availableDays as string[] | null | undefined)?.length ? (d.availableDays as string[]) : ALL_DAYS,
        from: win.from,
        to: win.to,
      }
    })

  return {
    tenantId: String(tenant.id),
    name: tenant.name,
    slug,
    phone: tenant.phone ?? null,
    address: tenant.address ?? null,
    city: tenant.city ?? null,
    currency: tenant.settings?.currency ?? null,
    tz: tenant.settings?.timezone || DEFAULT_TIMEZONE,
    durationMins: tenant.settings?.appointmentDurationMins || DEFAULT_APPOINTMENT_DURATION,
    requestsEnabled: tenant.settings?.onlineRequestsEnabled === true,
    doctors,
  }
}

/** Dates (YYYY-MM-DD, clinic tz) within the booking window on which the doctor works. */
export function bookableDates(clinic: PublicClinic, doctor: PublicDoctor, now = new Date()): string[] {
  const out: string[] = []
  for (let i = 0; i <= BOOKING_WINDOW_DAYS; i++) {
    // Noon avoids any DST edge when reading the weekday.
    const day = new Date(startOfDayInTz(clinic.tz, i, now).getTime() + 12 * 3600_000)
    if (doctor.days.includes(weekdayInTz(day, clinic.tz))) out.push(dateInTz(day, clinic.tz))
  }
  return out
}

/** Free start times ("HH:mm") for a doctor on a date, honouring schedule, notice and existing bookings. */
export async function freeSlots(
  payload: Payload,
  clinic: PublicClinic,
  doctorId: string,
  date: string,
  now = new Date(),
  serviceIndex = 0,
): Promise<string[]> {
  const doctor = clinic.doctors.find((d) => d.id === doctorId)
  if (!doctor || !bookableDates(clinic, doctor, now).includes(date)) return []
  const service = doctor.services[serviceIndex]
  if (!service) return []

  // Slots start on a fixed grid (the shorter of the service and 30 min) so long
  // services still offer every half hour; each must fit whole inside the window.
  const dur = service.durationMins
  const step = Math.min(dur, 30)
  const fromMin = hhmmToMinutes(doctor.from)
  const toMin = hhmmToMinutes(doctor.to)
  const earliest = now.getTime() + MIN_LEAD_MINUTES * 60_000

  const dayStart = wallTimeToUTC(clinic.tz, date, '00:00')
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000)
  const taken = await payload.find({
    collection: 'appointments',
    where: {
      tenant: { equals: clinic.tenantId },
      doctor: { equals: doctorId },
      status: { in: ACTIVE_STATUSES },
      and: [{ start: { less_than: dayEnd.toISOString() } }, { end: { greater_than: dayStart.toISOString() } }],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    pagination: false,
  })
  const busy = taken.docs.map((a) => [new Date(a.start), new Date(a.end ?? a.start)] as const)

  const slots: string[] = []
  for (let m = fromMin; m + dur <= toMin; m += step) {
    const time = toHHMM(m)
    const start = wallTimeToUTC(clinic.tz, date, time)
    if (start.getTime() < earliest) continue
    const end = computeEnd(start, dur)
    if (busy.some(([s, e]) => overlaps(start, end, s, e))) continue
    slots.push(time)
  }
  return slots
}

/** Online patients give name + WhatsApp; age and sex are optional (completed at check-in). */
export type PatientContact = { name: string; phone: string; gender?: string; ageYears?: number }

const normName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const digitsOf = (s: string) => s.replace(/[^0-9]/g, '')

function validateContact(c: PatientContact): PatientContact {
  const name = c.name?.trim() ?? ''
  if (name.length < 3) throw fail('Escriba su nombre completo.')
  if (digitsOf(c.phone ?? '').length < 10) throw fail('Escriba un teléfono válido, con código de área.')
  const gender = c.gender && (GENDERS as readonly string[]).includes(c.gender) ? c.gender : undefined
  const age = c.ageYears === undefined || c.ageYears === null || (c.ageYears as unknown) === '' ? undefined : Number(c.ageYears)
  if (age !== undefined && (!Number.isInteger(age) || age < 0 || age > 120)) throw fail('Revise la edad del paciente.')
  // Patients store phones as digits (the collection normalises on save).
  return { name, phone: digitsOf(c.phone), gender, ageYears: age }
}

/**
 * Reuse the clinic's existing patient when phone AND name match (families share
 * phones, so phone alone is not enough); otherwise register a new patient.
 */
async function findOrCreatePatient(payload: Payload, tenantId: string, c: PatientContact): Promise<Patient> {
  const candidates = await payload.find({
    collection: 'patients',
    where: { tenant: { equals: tenantId }, or: [{ phone: { equals: c.phone } }, { phone: { equals: `+${c.phone}` } }] },
    limit: 20,
    depth: 0,
    overrideAccess: true,
  })
  const match = (candidates.docs as Patient[]).find((p) => normName(p.name) === normName(c.name))
  if (match) return match
  try {
    return (await payload.create({
      collection: 'patients',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        name: c.name,
        phone: c.phone,
        gender: c.gender,
        ageYears: c.ageYears,
        // Staff complete age / sex at check-in; the collection allows it meanwhile.
        pendingIntake: !(c.gender && c.ageYears !== undefined),
        notes: 'Registrado desde la reserva en línea.',
      } as never,
    })) as Patient
  } catch (err) {
    if (err instanceof APIError && (err.data as { code?: string } | undefined)?.code === ERROR_CODES.PLAN_LIMIT) {
      throw fail('Este consultorio no puede recibir pacientes nuevos en línea en este momento. Llame al consultorio para agendar.', 403)
    }
    throw err
  }
}

export type OnlineBookingInput = PatientContact & {
  doctorId: string
  date: string
  time: string
  /** Index into the doctor's `services` (default 0). */
  serviceIndex?: number
  reason?: string
  firstTime?: boolean
}

/** Short human code shown to the patient and staff ("CITA-7F3K"), derived from the id. */
export const bookingCode = (appointmentId: string) => `CITA-${appointmentId.slice(-4).toUpperCase()}`

/** Book a published slot; confirmed immediately. */
export async function bookOnline(payload: Payload, clinic: PublicClinic, input: OnlineBookingInput, now = new Date()) {
  const contact = validateContact(input)
  const serviceIndex = input.serviceIndex ?? 0
  const service = clinic.doctors.find((d) => d.id === input.doctorId)?.services[serviceIndex]
  const slots = service ? await freeSlots(payload, clinic, input.doctorId, input.date, now, serviceIndex) : []
  if (!slots.includes(input.time)) {
    throw fail('Ese horario ya no está disponible. Elija otro.', 409, ERROR_CODES.SLOT_TAKEN)
  }
  const patient = await findOrCreatePatient(payload, clinic.tenantId, contact)
  const start = wallTimeToUTC(clinic.tz, input.date, input.time)
  const appt = await payload.create({
    collection: 'appointments',
    overrideAccess: true,
    data: {
      tenant: clinic.tenantId,
      patient: patient.id,
      doctor: input.doctorId,
      start: start.toISOString(),
      durationMins: service!.durationMins,
      // Reason line staff see in the agenda: "Primera consulta · primera vez · motivo".
      reason:
        [service!.name, input.firstTime ? 'primera vez' : null, input.reason?.trim().slice(0, 160) || null]
          .filter(Boolean)
          .join(' · ') || undefined,
      status: 'scheduled',
      source: 'online',
    } as never,
  })
  return {
    appointmentId: String(appt.id),
    code: bookingCode(String(appt.id)),
    start: start.toISOString(),
    durationMins: service!.durationMins,
    serviceName: service!.name,
    patientName: patient.name,
  }
}

export type OnlineRequestInput = PatientContact & {
  doctorId?: string
  preferredDate?: string
  reason: string
  urgent: boolean
}

/** File an extra / emergency request (only when the clinic accepts them). */
export async function requestOnline(payload: Payload, clinic: PublicClinic, input: OnlineRequestInput) {
  if (!clinic.requestsEnabled) throw fail('Este consultorio no recibe solicitudes en línea.', 403)
  const contact = validateContact(input)
  const reason = input.reason?.trim() ?? ''
  if (reason.length < 3) throw fail('Describa brevemente el motivo.')
  const doctorId = input.doctorId && clinic.doctors.some((d) => d.id === input.doctorId) ? input.doctorId : undefined
  const preferredDate = input.preferredDate && /^\d{4}-\d{2}-\d{2}$/.test(input.preferredDate) ? input.preferredDate : undefined
  const patient = await findOrCreatePatient(payload, clinic.tenantId, contact)
  const req = await payload.create({
    collection: 'bookingRequests',
    overrideAccess: true,
    data: {
      tenant: clinic.tenantId,
      patient: patient.id,
      doctor: doctorId,
      preferredDate: preferredDate ? wallTimeToUTC(clinic.tz, preferredDate, '12:00').toISOString() : undefined,
      reason: reason.slice(0, 1000),
      urgent: Boolean(input.urgent),
      status: 'pending',
    } as never,
  })
  return { requestId: String(req.id) }
}
