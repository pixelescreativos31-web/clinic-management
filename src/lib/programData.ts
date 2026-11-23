// Server-side reads for the weight-management programme: the patient's active
// enrolment, its controls (consultations with format `program`) as table rows, and
// the context a new control needs (suggested week, start / previous weight).

import type { Payload } from 'payload'
import type { Program, ProgressPhoto, User, Visit } from '@/payload-types'
import { METRICS, MEASURE_KEYS, withProgress, type MetricKey } from './program'
import type { ProgramContext } from '@/components/ProgramControl'

type Actor = { payload: Payload; user: User }

export type ControlRow = {
  id: string
  week: number
  date: string
  weightKg: number | null
  heightCm: number | null
  bpSystolic: number | null
  bpDiastolic: number | null
  heartRate: number | null
  respRate: number | null
  muscleMassUnit: string | null
  notes: string | null
  doctor: string | null
} & Partial<Record<MetricKey, number | null>>

/** A programme consultation → one row of the follow-up sheet. */
export function visitToControl(v: Visit): ControlRow {
  const body = (v.body ?? {}) as Record<string, unknown>
  const row: ControlRow = {
    id: String(v.id),
    week: v.programWeek ?? 0,
    date: v.visitDate,
    weightKg: v.vitals?.weightKg ?? null,
    heightCm: v.vitals?.heightCm ?? null,
    bpSystolic: v.vitals?.bpSystolic ?? null,
    bpDiastolic: v.vitals?.bpDiastolic ?? null,
    heartRate: v.vitals?.pulse ?? null,
    respRate: v.vitals?.respiratoryRate ?? null,
    muscleMassUnit: (body.muscleMassUnit as string) ?? null,
    notes: v.notes ?? null,
    doctor: v.doctor && typeof v.doctor === 'object' ? (v.doctor as User).name : null,
  }
  for (const m of METRICS) {
    if (m.group === 'composition' || m.group === 'measures') {
      const n = body[m.key]
      row[m.key] = typeof n === 'number' ? n : null
    }
  }
  return row
}

export async function activeProgram({ payload, user }: Actor, patientId: string): Promise<Program | null> {
  const res = await payload.find({
    collection: 'programs',
    where: { patient: { equals: patientId }, status: { equals: 'active' } },
    sort: '-startDate',
    limit: 1,
    depth: 0,
    overrideAccess: false,
    user,
  })
  return (res.docs[0] as Program | undefined) ?? null
}

export async function patientPrograms({ payload, user }: Actor, patientId: string): Promise<Program[]> {
  const res = await payload.find({
    collection: 'programs',
    where: { patient: { equals: patientId } },
    sort: '-startDate',
    limit: 50,
    depth: 1,
    overrideAccess: false,
    user,
  })
  return res.docs as Program[]
}

/** Every control of a programme, oldest week first, with BMI and weight change. */
export async function programControls({ payload, user }: Actor, programId: string) {
  const res = await payload.find({
    collection: 'visits',
    where: { program: { equals: programId } },
    sort: 'programWeek',
    limit: 1000,
    pagination: false,
    depth: 1,
    overrideAccess: false,
    user,
  })
  return withProgress((res.docs as Visit[]).map(visitToControl))
}

export async function programPhotos({ payload, user }: Actor, programId: string): Promise<ProgressPhoto[]> {
  const res = await payload.find({
    collection: 'progressPhotos',
    where: { program: { equals: programId } },
    sort: 'week',
    limit: 500,
    pagination: false,
    depth: 0,
    overrideAccess: false,
    user,
  })
  return res.docs as ProgressPhoto[]
}

/** What the control form needs to show progress while typing. */
export async function programContext(actor: Actor, program: Program, editing?: { id: string; week: number }): Promise<ProgramContext> {
  const rows = (await programControls(actor, String(program.id))).filter((r) => r.id !== editing?.id)
  const weighed = rows.filter((r) => r.weightKg != null)
  const before = editing ? weighed.filter((r) => r.week < editing.week) : weighed
  const last = before[before.length - 1]
  const lastMeasures: Partial<Record<string, number>> = {}
  for (const k of MEASURE_KEYS) {
    const withIt = rows.filter((r) => r[k] != null)
    const v = withIt[withIt.length - 1]?.[k]
    if (v != null) lastMeasures[k] = v
  }
  return {
    programId: String(program.id),
    name: program.name,
    suggestedWeek: rows.length ? Math.max(...rows.map((r) => r.week)) + 1 : 0,
    startWeightKg: weighed[0]?.weightKg ?? null,
    prev: last ? { week: last.week, weightKg: last.weightKg! } : null,
    lastMeasures,
    heightCm: latestHeight(rows),
  }
}

/** Latest known height (cm) for prefilling a new control. */
export const latestHeight = (rows: { heightCm: number | null }[]) => [...rows].reverse().find((r) => r.heightCm)?.heightCm ?? null
