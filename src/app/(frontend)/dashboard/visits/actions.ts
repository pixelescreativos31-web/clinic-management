'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, getPayloadClient } from '@/lib/auth'
import { toActionError, type ActionResult } from '@/lib/errors'
import { formToNutrition, type NutritionFormState } from '@/lib/nutrition'

export type PrescriptionRowInput = {
  medicine: string
  dosage?: string
  frequency?: string
  frequencyNote?: string
  durationDays?: number
  quantity?: string
  instructions?: string
}

export type VisitInput = {
  appointmentId: string
  chiefComplaint?: string
  symptoms?: string
  physicalExam?: string
  diagnosis?: string
  treatmentPlan?: string
  labOrders?: string
  notes?: string
  vitals?: {
    bpSystolic?: number
    bpDiastolic?: number
    temperatureC?: number
    weightKg?: number
    heightCm?: number
    pulse?: number
    respiratoryRate?: number
    oxygenSaturation?: number
    glucoseMgDl?: number
  }
  prescription?: PrescriptionRowInput[]
  followUpDate?: string
  /** Only sent when the consultation uses the nutrition format. */
  nutrition?: NutritionFormState
  format?: 'general' | 'nutrition'
}

const FORBIDDEN = { ok: false as const, code: 'FORBIDDEN', message: 'No tiene permiso para realizar esta acción.' }

/** Normalise form input: drop blank vitals / empty rows so we never store noise. */
function clinicalData(input: Omit<VisitInput, 'appointmentId'>, forUpdate: boolean) {
  const vitals = input.vitals
    ? Object.fromEntries(Object.entries(input.vitals).filter(([, v]) => v != null && !Number.isNaN(v)))
    : undefined
  // Keep only rows with a medicine, and drop empty optional fields so an empty
  // `frequency` ('') never trips the select's option validation.
  const prescription = (input.prescription ?? [])
    .filter((p) => p.medicine?.trim())
    .map((p) => ({
      medicine: p.medicine.trim(),
      dosage: p.dosage?.trim() || undefined,
      frequency: p.frequency || undefined,
      frequencyNote: p.frequencyNote?.trim() || undefined,
      durationDays: p.durationDays ?? undefined,
      quantity: p.quantity?.trim() || undefined,
      instructions: p.instructions?.trim() || undefined,
    }))
  // On update an emptied field must be cleared (null), on create simply omitted.
  const empty = forUpdate ? null : undefined
  const txt = (v?: string) => (v && v.trim() ? v : empty)
  return {
    chiefComplaint: txt(input.chiefComplaint),
    symptoms: txt(input.symptoms),
    physicalExam: txt(input.physicalExam),
    diagnosis: txt(input.diagnosis),
    treatmentPlan: txt(input.treatmentPlan),
    labOrders: txt(input.labOrders),
    notes: txt(input.notes),
    vitals: vitals && Object.keys(vitals).length ? vitals : forUpdate ? {} : undefined,
    prescription,
    followUpDate: input.followUpDate || empty,
    nutrition: formToNutrition(input.nutrition, forUpdate),
    ...(input.format ? { format: input.format === 'nutrition' ? 'nutrition' : 'general' } : {}),
  }
}

/** Record a consultation against a checked-in / completed appointment. */
export async function recordVisit(input: VisitInput): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  if (!user || user.role === 'superAdmin') return FORBIDDEN
  const payload = await getPayloadClient()

  try {
    const visit = await payload.create({
      collection: 'visits',
      user,
      overrideAccess: false,
      data: { appointment: input.appointmentId, ...clinicalData(input, false) } as never,
    })
    revalidatePath('/dashboard/appointments')
    revalidatePath('/dashboard')
    return { ok: true, data: { id: String(visit.id) } }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}

/**
 * Amend a recorded consultation (doctors complete notes after the patient leaves).
 * Access is enforced by Payload (clinical roles, own clinic); every edit is audited
 * with the list of changed fields.
 */
export async function updateVisit(
  visitId: string,
  input: Omit<VisitInput, 'appointmentId'>,
): Promise<ActionResult<{ id: string; patientId: string }>> {
  const user = await getCurrentUser()
  if (!user || user.role === 'superAdmin') return FORBIDDEN
  const payload = await getPayloadClient()
  try {
    const visit = await payload.update({
      collection: 'visits',
      id: visitId,
      user,
      overrideAccess: false,
      data: clinicalData(input, true) as never,
    })
    const patientId = String(
      typeof visit.patient === 'object' && visit.patient ? visit.patient.id : visit.patient,
    )
    revalidatePath(`/dashboard/patients/${patientId}`)
    return { ok: true, data: { id: String(visit.id), patientId } }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}
