'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, getPayloadClient } from '@/lib/auth'
import { toActionError, type ActionResult } from '@/lib/errors'
import { formToNutrition, type NutritionFormState } from '@/lib/nutrition'
import { formToMassage, massageServicesLine, type MassageFormState } from '@/lib/massage'
import { asFormat, type ConsultFormat } from '@/lib/profiles'
import { METRICS, parseMetric } from '@/lib/program'

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
  /** Only sent when the visit is a massage session sheet. */
  massage?: MassageFormState
  format?: ConsultFormat
  /** Programme control: the enrolment and its week (blank = next week). */
  programId?: string
  programWeek?: number
  /** Body composition and measurements, as typed (strings). */
  body?: Record<string, string>
}

/** Programme body metrics: form strings → numbers (blank → null on update). */
function bodyData(body: Record<string, string> | undefined, forUpdate: boolean) {
  if (!body) return undefined
  const out: Record<string, number | string | null> = {}
  for (const m of METRICS.filter((x) => x.group === 'composition' || x.group === 'measures')) {
    const v = parseMetric(body[m.key], m.min, m.max)
    if (v !== undefined) out[m.key] = v
    else if (forUpdate) out[m.key] = null
  }
  const unit = body.muscleMassUnit
  if (unit === 'kg' || unit === 'lb' || unit === '%') out.muscleMassUnit = unit
  else if (forUpdate) out.muscleMassUnit = null
  return out
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
  const format = asFormat(input.format)
  const massage = format === 'massage' ? formToMassage(input.massage, forUpdate) : undefined
  const program =
    format === 'program'
      ? {
          ...(!forUpdate && input.programId ? { program: input.programId } : {}),
          ...(input.programWeek != null && Number.isInteger(input.programWeek) && input.programWeek >= 0 ? { programWeek: input.programWeek } : {}),
          body: bodyData(input.body, forUpdate),
        }
      : {}
  return {
    ...program,
    // A massage sheet has no free-text complaint: its services are the headline.
    // A programme control is titled by the server («Impulso Vital · Semana 3»).
    chiefComplaint:
      format === 'massage' ? massageServicesLine(massage) || empty : format === 'program' ? txt(input.chiefComplaint) ?? undefined : txt(input.chiefComplaint),
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
    ...(massage ? { massage } : {}),
    ...(format ? { format } : {}),
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
