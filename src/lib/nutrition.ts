// Nutrition consultation template (Historia Clínica Nutricional). Enabled per
// clinic via `settings.consultTemplate = 'nutrition'`. One field list drives the
// Payload schema, the visit form, the server-side normalisation and the read-only
// views, so adding a field here is the only change needed. Kept PURE (no payload
// imports) so client components can import it.

export type NutritionKind = 'number' | 'text' | 'yesno' | 'goodbad'
export type NutritionGroup = 'interrogatorio' | 'antropometria' | 'laboratorio' | 'seguimiento'

export type NutritionFieldDef = {
  key: string
  label: string
  kind: NutritionKind
  group: NutritionGroup
  unit?: string
  min?: number
  max?: number
  placeholder?: string
  /** Wide textarea instead of a compact input. */
  long?: boolean
}

export const NUTRITION_GROUP_LABELS: Record<NutritionGroup, string> = {
  interrogatorio: 'Interrogatorio nutricional',
  antropometria: 'Antropometría',
  laboratorio: 'Laboratorio',
  seguimiento: 'Seguimiento',
}

export const NUTRITION_FIELDS: NutritionFieldDef[] = [
  // Interrogatorio (APP/APF live in the patient's background).
  { key: 'constipation', label: 'Estreñimiento', kind: 'yesno', group: 'interrogatorio' },
  { key: 'waterIntake', label: 'Consumo de agua', kind: 'goodbad', group: 'interrogatorio' },
  { key: 'anxiety', label: 'Ansiedad', kind: 'yesno', group: 'interrogatorio' },
  { key: 'stress', label: 'Estrés', kind: 'yesno', group: 'interrogatorio' },
  { key: 'sleepHours', label: 'Sueño (horas/día)', kind: 'number', group: 'interrogatorio', min: 0, max: 24, placeholder: '7' },
  { key: 'sleepQuality', label: 'Calidad del sueño', kind: 'text', group: 'interrogatorio', placeholder: 'p. ej. Se despierta de noche' },

  // Antropometría (current weight + height are the visit's vitals).
  { key: 'goal', label: 'Meta', kind: 'text', group: 'antropometria', placeholder: 'p. ej. Bajar 8 kg en 4 meses' },
  { key: 'usualWeightKg', label: 'Peso habitual', kind: 'number', group: 'antropometria', unit: 'kg', min: 0.5, max: 500 },
  { key: 'armCm', label: 'Brazos', kind: 'number', group: 'antropometria', unit: 'cm', min: 5, max: 100 },
  { key: 'waistCm', label: 'Cintura', kind: 'number', group: 'antropometria', unit: 'cm', min: 20, max: 300 },
  { key: 'abdomenCm', label: 'Abdomen', kind: 'number', group: 'antropometria', unit: 'cm', min: 20, max: 300 },
  { key: 'glutesCm', label: 'Glúteos', kind: 'number', group: 'antropometria', unit: 'cm', min: 20, max: 300 },
  { key: 'hipCm', label: 'Cadera', kind: 'number', group: 'antropometria', unit: 'cm', min: 20, max: 300 },

  // Laboratorio — free text per study, plus the values worth charting as numbers.
  { key: 'labHemogram', label: 'Hemograma (HB, HCT, GB, PLT)', kind: 'text', group: 'laboratorio', long: true },
  { key: 'labFastingGlucose', label: 'Glicemia en ayunas', kind: 'number', group: 'laboratorio', unit: 'mg/dL', min: 10, max: 1000 },
  { key: 'labHba1c', label: 'HbA1c', kind: 'number', group: 'laboratorio', unit: '%', min: 2, max: 20 },
  { key: 'labGlucoseOther', label: 'Glicemia: G2H, insulina basal', kind: 'text', group: 'laboratorio' },
  { key: 'labTotalCholesterol', label: 'Colesterol total', kind: 'number', group: 'laboratorio', unit: 'mg/dL', min: 20, max: 1000 },
  { key: 'labLdl', label: 'LDL', kind: 'number', group: 'laboratorio', unit: 'mg/dL', min: 5, max: 1000 },
  { key: 'labHdl', label: 'HDL', kind: 'number', group: 'laboratorio', unit: 'mg/dL', min: 5, max: 300 },
  { key: 'labTriglycerides', label: 'Triglicéridos', kind: 'number', group: 'laboratorio', unit: 'mg/dL', min: 10, max: 5000 },
  { key: 'labUrinalysis', label: 'Examen de orina (GB, GR, glucosa, nitritos, bacterias, proteínas)', kind: 'text', group: 'laboratorio', long: true },
  { key: 'labAbdominalUltrasound', label: 'Sonografía abdominal', kind: 'text', group: 'laboratorio', long: true },
  { key: 'labThyroidUltrasound', label: 'Sonografía de tiroides', kind: 'text', group: 'laboratorio', long: true },
  { key: 'labStool', label: 'Coprológico', kind: 'text', group: 'laboratorio', long: true },

  // Seguimiento — the follow-up sheet's free columns.
  { key: 'changes', label: 'Cambios', kind: 'text', group: 'seguimiento', placeholder: 'p. ej. Menos ansiedad por dulces' },
  { key: 'exercise', label: 'Ejercicio', kind: 'text', group: 'seguimiento', placeholder: 'p. ej. Caminata 30 min, 4 días' },
  { key: 'diet', label: 'Dieta', kind: 'text', group: 'seguimiento', placeholder: 'p. ej. Plan 1500 kcal' },
]

export const YES_NO = [
  { value: 'yes', label: 'Sí' },
  { value: 'no', label: 'No' },
]
export const GOOD_BAD = [
  { value: 'good', label: 'Buena' },
  { value: 'poor', label: 'Mala' },
]

export type NutritionValues = Record<string, string | number | null | undefined>
/** The form keeps every field as a string. */
export type NutritionFormState = Record<string, string>

export const EMPTY_NUTRITION: NutritionFormState = Object.fromEntries(NUTRITION_FIELDS.map((f) => [f.key, '']))

export const isNutritionPractice = (tenant: { settings?: { consultTemplate?: string | null } | null } | null | undefined) =>
  tenant?.settings?.consultTemplate === 'nutrition'

/** Stored document → form strings. */
export function nutritionToForm(stored: NutritionValues | null | undefined): NutritionFormState {
  const s = stored ?? {}
  return Object.fromEntries(NUTRITION_FIELDS.map((f) => [f.key, s[f.key] == null ? '' : String(s[f.key])]))
}

/**
 * Form strings → stored values. Blank fields become `null` on update (so clearing
 * a field really clears it) and are dropped on create. Unparseable numbers are
 * dropped rather than stored as NaN.
 */
export function formToNutrition(form: NutritionFormState | undefined, forUpdate: boolean): NutritionValues | undefined {
  if (!form) return undefined
  const out: NutritionValues = {}
  for (const f of NUTRITION_FIELDS) {
    const raw = (form[f.key] ?? '').trim()
    if (!raw) {
      if (forUpdate) out[f.key] = null
      continue
    }
    if (f.kind === 'number') {
      const n = Number(raw.replace(',', '.'))
      if (Number.isFinite(n)) out[f.key] = n
      else if (forUpdate) out[f.key] = null
    } else {
      out[f.key] = raw
    }
  }
  return forUpdate || Object.keys(out).length ? out : undefined
}

/** Waist / hip ratio, or null when either measure is missing. */
export function waistHipRatio(v: NutritionValues | null | undefined): number | null {
  const waist = Number(v?.waistCm)
  const hip = Number(v?.hipCm)
  if (!waist || !hip) return null
  const r = waist / hip
  return Number.isFinite(r) ? Math.round(r * 100) / 100 : null
}

/** Human-readable value for one field ("Sí", "92 cm", free text…). */
export function formatNutritionValue(f: NutritionFieldDef, value: unknown): string | null {
  if (value == null || value === '') return null
  if (f.kind === 'yesno') return YES_NO.find((o) => o.value === value)?.label ?? String(value)
  if (f.kind === 'goodbad') return GOOD_BAD.find((o) => o.value === value)?.label ?? String(value)
  if (f.kind === 'number') return f.unit ? `${value} ${f.unit}` : String(value)
  return String(value)
}

/** Non-empty "Label: value" pairs for a group, for read-only consultation cards. */
export function nutritionLines(v: NutritionValues | null | undefined, group: NutritionGroup): { label: string; value: string }[] {
  const lines = NUTRITION_FIELDS.filter((f) => f.group === group)
    .map((f) => ({ label: f.label, value: formatNutritionValue(f, v?.[f.key]) }))
    .filter((l): l is { label: string; value: string } => l.value != null)
  if (group === 'antropometria') {
    const ratio = waistHipRatio(v)
    if (ratio != null) lines.push({ label: 'Relación cintura/cadera', value: String(ratio) })
  }
  return lines
}
