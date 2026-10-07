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
