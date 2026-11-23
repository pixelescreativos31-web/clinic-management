'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { toActionError, type ActionResult } from '@/lib/errors'
import { isClinical, isPractitioner } from '@/lib/practice'
import { DEFAULT_PROGRAM_NAME, PHOTO_VIEWS } from '@/lib/program'
import { startConsultation } from '@/app/(frontend)/dashboard/appointments/actions'

const FORBIDDEN = { ok: false as const, code: 'FORBIDDEN', message: 'No tiene permiso para realizar esta acción.' }
const MAX_PHOTO_BYTES = 8 * 1024 * 1024

async function clinicalCtx() {
  const user = await getCurrentUser()
  if (!user || !isClinical(user)) return null
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)
  if (!tenantID) return null
  const tenant = await payload.findByID({ collection: 'tenants', id: tenantID, depth: 0, overrideAccess: true })
  return { user, payload, tenantID, tenant }
}

/**
 * Enrol a patient in the clinic's programme and open the initial evaluation
 * (week 0) right away, as a walk-in consultation with the acting doctor.
 */
export async function enrollInProgram(
  patientId: string,
  input: { startDate?: string; goal?: string },
): Promise<ActionResult<{ programId: string; appointmentId: string | null; message?: string }>> {
  const ctx = await clinicalCtx()
  if (!ctx) return FORBIDDEN
  const { user, payload, tenant } = ctx
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(input.startDate ?? '') ? `${input.startDate}T12:00:00.000Z` : new Date().toISOString()
  try {
    const program = await payload.create({
      collection: 'programs',
      user,
      overrideAccess: false,
      data: {
        patient: patientId,
        name: tenant?.settings?.programName?.trim() || DEFAULT_PROGRAM_NAME,
        status: 'active',
        startDate,
        goal: input.goal?.trim().slice(0, 200) || undefined,
        responsible: isPractitioner(user) ? user.id : undefined,
      } as never,
    })
    revalidatePath(`/dashboard/patients/${patientId}`)
    const appt = await startConsultation(patientId)
    return {
      ok: true,
      data: {
        programId: String(program.id),
        appointmentId: appt.ok ? appt.data.appointmentId : null,
        message: appt.ok ? undefined : appt.message,
      },
    }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}

/** Close (completed / suspended) or reopen a programme; update its goal. */
export async function updateProgram(
  programId: string,
  input: { status?: 'active' | 'completed' | 'cancelled'; goal?: string },
): Promise<ActionResult<null>> {
  const ctx = await clinicalCtx()
  if (!ctx) return FORBIDDEN
  try {
    const doc = await ctx.payload.update({
      collection: 'programs',
      id: programId,
      user: ctx.user,
      overrideAccess: false,
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.goal !== undefined ? { goal: input.goal.trim().slice(0, 200) || null } : {}),
      } as never,
    })
    revalidatePath(`/dashboard/patients/${typeof doc.patient === 'object' ? doc.patient.id : doc.patient}`)
    return { ok: true, data: null }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}

/** Upload one progress photo (already resized in the browser) for a week and view. */
export async function uploadProgressPhoto(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await clinicalCtx()
  if (!ctx) return FORBIDDEN
  const file = formData.get('file')
  const programId = String(formData.get('program') ?? '')
  const week = Number(formData.get('week'))
  const view = String(formData.get('view') ?? '')
  const takenAt = String(formData.get('takenAt') ?? '')
  if (!(file instanceof File) || file.size === 0) return { ok: false, code: 'VALIDATION', message: 'Elija una foto.' }
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, code: 'VALIDATION', message: 'La foto es demasiado grande (máximo 8 MB).' }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return { ok: false, code: 'VALIDATION', message: 'La foto debe ser JPG, PNG o WebP.' }
  }
  if (!Number.isInteger(week) || week < 0 || week > 520) return { ok: false, code: 'VALIDATION', message: 'Indique la semana.' }
  if (!PHOTO_VIEWS.some((v) => v.value === view)) return { ok: false, code: 'VALIDATION', message: 'Indique la vista.' }
  try {
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const doc = await ctx.payload.create({
      collection: 'progressPhotos',
      user: ctx.user,
      overrideAccess: false,
      data: {
        program: programId,
        week,
        view,
        takenAt: /^\d{4}-\d{2}-\d{2}$/.test(takenAt) ? `${takenAt}T12:00:00.000Z` : new Date().toISOString(),
      } as never,
      file: {
        data: Buffer.from(await file.arrayBuffer()),
        mimetype: file.type,
        // Random name: the file name never carries the patient's identity.
        name: `p-${crypto.randomUUID()}.${ext}`,
        size: file.size,
      },
    })
    revalidatePath(`/dashboard/patients/${typeof doc.patient === 'object' ? doc.patient.id : doc.patient}`)
    return { ok: true, data: { id: String(doc.id) } }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}

export async function deleteProgressPhoto(id: string): Promise<ActionResult<null>> {
  const ctx = await clinicalCtx()
  if (!ctx) return FORBIDDEN
  try {
    const doc = await ctx.payload.delete({ collection: 'progressPhotos', id, user: ctx.user, overrideAccess: false })
    revalidatePath(`/dashboard/patients/${typeof doc.patient === 'object' ? doc.patient.id : doc.patient}`)
    return { ok: true, data: null }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}
