// Small presentation helpers for clinical records, shared by the visit form,
// the patient file and printed documents.

type PatientLike = {
  history?: {
    chronicConditions?: string | null
    medications?: string | null
  } | null
} | null | undefined

/** One-line background reminder while consulting: chronic conditions + current meds. */
export function backgroundLine(patient: PatientLike): string | null {
  const h = patient?.history
  if (!h) return null
  const parts = [
    h.chronicConditions ? `Crónicas: ${h.chronicConditions}` : null,
    h.medications ? `Medicamentos: ${h.medications}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

type VitalsLike = {
  bpSystolic?: number | null
  bpDiastolic?: number | null
  pulse?: number | null
  respiratoryRate?: number | null
  temperatureC?: number | null
  oxygenSaturation?: number | null
  weightKg?: number | null
  heightCm?: number | null
  glucoseMgDl?: number | null
} | null | undefined

/** "PA 120/80 · FC 72 · T 36.8 °C · …" for compact display and print. */
export function vitalsLine(v: VitalsLike): string {
  if (!v) return ''
  const imc =
    v.weightKg && v.heightCm ? (v.weightKg / Math.pow(v.heightCm / 100, 2)).toFixed(1) : null
  return [
    v.bpSystolic && v.bpDiastolic ? `PA ${v.bpSystolic}/${v.bpDiastolic}` : null,
    v.pulse ? `FC ${v.pulse}` : null,
    v.respiratoryRate ? `FR ${v.respiratoryRate}` : null,
    v.temperatureC ? `T ${v.temperatureC} °C` : null,
    v.oxygenSaturation ? `SatO₂ ${v.oxygenSaturation}%` : null,
    v.weightKg ? `Peso ${v.weightKg} kg` : null,
    v.heightCm ? `Talla ${v.heightCm} cm` : null,
    imc ? `IMC ${imc}` : null,
    v.glucoseMgDl ? `Glucemia ${v.glucoseMgDl} mg/dL` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * A doctor's most frequent diagnoses (last 200 consultations), offered as
 * one-tap chips in the consultation form. Falls back to «Control».
 */
export async function frequentDiagnoses(
  payload: import('payload').Payload,
  tenantID: string,
  doctorID: string,
  limit = 4,
): Promise<string[]> {
  const res = await payload.find({
    collection: 'visits',
    where: { tenant: { equals: tenantID }, doctor: { equals: doctorID } },
    sort: '-visitDate',
    limit: 200,
    depth: 0,
    overrideAccess: true,
    select: { diagnosis: true },
  })
  const counts = new Map<string, { label: string; n: number }>()
  for (const v of res.docs as { diagnosis?: string | null }[]) {
    const label = v.diagnosis?.trim()
    if (!label || label.length > 40) continue
    const key = label.toLowerCase()
    const cur = counts.get(key)
    counts.set(key, { label: cur?.label ?? label, n: (cur?.n ?? 0) + 1 })
  }
  const top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, limit).map((c) => c.label)
  return top.length ? top : ['Control']
}
