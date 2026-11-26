// Weight-management programme (Fénix Stetic calls theirs «Impulso Vital»; each
// clinic names it in Configuración). Modelled like FHIR EpisodeOfCare → Encounter
// → Observation: the enrolment is a `programs` doc; every control (week 0 = the
// initial evaluation) is a regular consultation (`visits`, format `program`) with
// its week number, vitals and body metrics; photos are `progressPhotos`.
// Every control is its own record — adding one never overwrites an earlier one.
// The background history (niñez/adultez, madre/padre/hermanos, E-A-P-C) lives in
// the patient's shared clinical history, not in the programme.
// Pure module so client components can import it.

export const DEFAULT_PROGRAM_NAME = 'Programa de control de peso'

export const LB_PER_KG = 2.20462
export const CM_PER_IN = 2.54

export const kgToLb = (kg: number) => Math.round(kg * LB_PER_KG * 10) / 10
export const lbToKg = (lb: number) => Math.round((lb / LB_PER_KG) * 100) / 100
export const cmToIn = (cm: number) => Math.round((cm / CM_PER_IN) * 10) / 10
export const inToCm = (inches: number) => Math.round(inches * CM_PER_IN * 10) / 10

export function bmi(weightKg?: number | null, heightCm?: number | null): number | null {
  if (!weightKg || !heightCm) return null
  const v = weightKg / (heightCm / 100) ** 2
  return Number.isFinite(v) && v > 5 && v < 100 ? Math.round(v * 10) / 10 : null
}

export function bmiLabel(v: number | null): string | null {
  if (v == null) return null
  if (v < 18.5) return 'Bajo peso'
  if (v < 25) return 'Normal'
  if (v < 30) return 'Sobrepeso'
  if (v < 35) return 'Obesidad grado I'
  if (v < 40) return 'Obesidad grado II'
  return 'Obesidad grado III'
}

/** Weeks 4, 8, 12… are the scheduled body-measurement controls. */
export const isMeasureWeek = (week: number) => week > 0 && week % 4 === 0

export const weekLabel = (week: number) => (week === 0 ? 'Evaluación inicial' : `Semana ${week}`)

// ---- Control metrics ----

export type MetricKey =
  | 'weightKg'
  | 'heightCm'
  | 'bpSystolic'
  | 'bpDiastolic'
  | 'heartRate'
  | 'respRate'
  | 'muscleMass'
  | 'bodyFatPct'
  | 'bodyWaterPct'
  | 'waistCm'
  | 'chestCm'
  | 'hipCm'
  | 'armRightCm'
  | 'armLeftCm'
  | 'legRightCm'
  | 'legLeftCm'

export type MetricDef = { key: MetricKey; label: string; short: string; unit: string; min: number; max: number; group: 'core' | 'vitals' | 'composition' | 'measures' }

export const METRICS: MetricDef[] = [
  { key: 'weightKg', label: 'Peso', short: 'Peso', unit: 'kg', min: 2, max: 400, group: 'core' },
  { key: 'heightCm', label: 'Estatura', short: 'Estatura', unit: 'cm', min: 40, max: 250, group: 'core' },
  { key: 'bpSystolic', label: 'TA sistólica', short: 'TA sist.', unit: 'mmHg', min: 50, max: 260, group: 'vitals' },
  { key: 'bpDiastolic', label: 'TA diastólica', short: 'TA diast.', unit: 'mmHg', min: 30, max: 180, group: 'vitals' },
  { key: 'heartRate', label: 'FC', short: 'FC', unit: 'lpm', min: 25, max: 230, group: 'vitals' },
  { key: 'respRate', label: 'FR', short: 'FR', unit: 'rpm', min: 4, max: 70, group: 'vitals' },
  { key: 'muscleMass', label: 'Masa muscular', short: 'Músculo', unit: '', min: 0, max: 300, group: 'composition' },
  { key: 'bodyFatPct', label: 'Grasa corporal', short: 'Grasa', unit: '%', min: 1, max: 80, group: 'composition' },
  { key: 'bodyWaterPct', label: 'Agua corporal', short: 'Agua', unit: '%', min: 10, max: 90, group: 'composition' },
  { key: 'waistCm', label: 'Cintura / circunferencia abdominal', short: 'Cintura', unit: 'cm', min: 20, max: 300, group: 'measures' },
  { key: 'chestCm', label: 'Pecho', short: 'Pecho', unit: 'cm', min: 20, max: 300, group: 'measures' },
  { key: 'hipCm', label: 'Cadera', short: 'Cadera', unit: 'cm', min: 20, max: 300, group: 'measures' },
  { key: 'armRightCm', label: 'Brazo derecho', short: 'Brazo D', unit: 'cm', min: 5, max: 100, group: 'measures' },
  { key: 'armLeftCm', label: 'Brazo izquierdo', short: 'Brazo I', unit: 'cm', min: 5, max: 100, group: 'measures' },
  { key: 'legRightCm', label: 'Pierna derecha', short: 'Pierna D', unit: 'cm', min: 10, max: 150, group: 'measures' },
  { key: 'legLeftCm', label: 'Pierna izquierda', short: 'Pierna I', unit: 'cm', min: 10, max: 150, group: 'measures' },
]

export const MEASURE_KEYS = METRICS.filter((m) => m.group === 'measures').map((m) => m.key)

export type ControlValues = Partial<Record<MetricKey, number | null>> & {
  week: number
  date: string
  muscleMassUnit?: string | null
  notes?: string | null
}

/** Height to use for a control's BMI: its own, else the latest earlier one recorded. */
export function heightFor<T extends { week: number; heightCm?: number | null }>(controls: T[], week: number): number | null {
  const withHeight = controls.filter((c) => c.week <= week && c.heightCm).sort((a, b) => b.week - a.week)
  return withHeight[0]?.heightCm ?? null
}

export type ControlRow<T> = T & { bmi: number | null; deltaPrev: number | null; deltaStart: number | null }

/**
 * Controls sorted by week with BMI and weight change versus the previous weighed
 * control and versus the initial evaluation (kg, negative = lost).
 */
export function withProgress<T extends { week: number; weightKg?: number | null; heightCm?: number | null }>(controls: T[]): ControlRow<T>[] {
  const sorted = [...controls].sort((a, b) => a.week - b.week)
  const start = sorted.find((c) => c.weightKg)?.weightKg ?? null
  let prev: number | null = null
  return sorted.map((c) => {
    const w = c.weightKg ?? null
    const row = {
      ...c,
      bmi: bmi(w, heightFor(sorted, c.week)),
      deltaPrev: w != null && prev != null ? Math.round((w - prev) * 100) / 100 : null,
      deltaStart: w != null && start != null ? Math.round((w - start) * 100) / 100 : null,
    }
    if (w != null) prev = w
    return row
  })
}

/** Signed change, the clinic's unit first: "−3.2 lb (−1.5 kg)". */
export const fmtDelta = (kg: number | null, unit: 'lb' | 'kg' = 'lb') => {
  if (kg == null) return '—'
  if (kg === 0) return '0'
  const s = kg > 0 ? '+' : '−'
  const lb = `${s}${Math.abs(kgToLb(kg)).toFixed(1)} lb`
  const k = `${s}${Math.abs(kg).toFixed(1)} kg`
  return unit === 'lb' ? `${lb} (${k})` : `${k} (${lb})`
}

/** "165.3 lb · 75.0 kg", the clinic's unit first. */
export const fmtWeight = (kg?: number | null, unit: 'lb' | 'kg' = 'lb') =>
  kg ? (unit === 'lb' ? `${kgToLb(kg).toFixed(1)} lb · ${kg.toFixed(1)} kg` : `${kg.toFixed(1)} kg · ${kgToLb(kg).toFixed(1)} lb`) : '—'

// ---- Photos ----

export const PHOTO_VIEWS = [
  { value: 'front', label: 'Frente' },
  { value: 'rightProfile', label: 'Perfil derecho' },
  { value: 'leftProfile', label: 'Perfil izquierdo' },
  { value: 'back', label: 'Espalda' },
] as const
export type PhotoView = (typeof PHOTO_VIEWS)[number]['value']

/** Parse a form number ("72,5" too); undefined when blank or outside [min, max]. */
export function parseMetric(raw: unknown, min: number, max: number): number | undefined {
  if (raw == null) return undefined
  const s = String(raw).trim().replace(',', '.')
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : undefined
}

/** One line with a control's composition and measurements, for the record card. */
export function bodyLine(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const parts = METRICS.filter((m) => (m.group === 'composition' || m.group === 'measures') && typeof b[m.key] === 'number').map((m) => {
    const unit = m.key === 'muscleMass' ? ` ${(b.muscleMassUnit as string) || 'kg'}` : m.unit === '%' ? '%' : ` ${m.unit}`
    return `${m.short} ${b[m.key]}${unit}`
  })
  return parts.length ? parts.join(' · ') : null
}
