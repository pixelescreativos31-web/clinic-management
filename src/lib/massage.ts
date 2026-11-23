// Massage session sheet ("Ficha técnica del cliente · evaluación y consentimiento
// para masajes"), adapted from the paper form clinics already use. One field list
// drives the Payload schema, the form, server-side normalisation and the read-only
// views — adding a question here is the only change needed. Pure module.

export type MassageKind = 'multi' | 'yesno' | 'select' | 'text' | 'long' | 'number' | 'date' | 'check'
export type MassageGroup = 'servicio' | 'salud' | 'lesiones' | 'alergias' | 'evaluacion' | 'consentimiento'

export type MassageFieldDef = {
  key: string
  label: string
  kind: MassageKind
  group: MassageGroup
  options?: { value: string; label: string }[]
  /** yes/no questions with a free-text "details" field stored as `${key}Detail`. */
  detail?: string
  min?: number
  max?: number
  placeholder?: string
}

const opts = (...labels: [string, string][]) => labels.map(([value, label]) => ({ value, label }))

export const MASSAGE_SERVICES = opts(
  ['relaxing', 'Masaje relajante'],
  ['antistress', 'Masaje antiestrés'],
  ['decontracting', 'Masaje descontracturante'],
  ['sports', 'Masaje deportivo'],
  ['stretching', 'Masaje con estiramientos'],
  ['volcanicStones', 'Masaje con piedras volcánicas'],
  ['myofascial', 'Liberación miofascial'],
  ['reducing', 'Masaje reductor'],
  ['anticellulite', 'Masaje anticelulitis'],
  ['lymphatic', 'Drenaje linfático manual'],
  ['postop', 'Masaje postoperatorio'],
  ['gluteLift', 'Levantamiento de glúteos'],
  ['facial', 'Masaje facial'],
  ['woodTherapy', 'Maderoterapia'],
)

export const MASSAGE_GROUP_LABELS: Record<MassageGroup, string> = {
  servicio: 'Servicio solicitado',
  salud: 'Antecedentes y estado de salud',
  lesiones: 'Lesiones, dolor y situaciones recientes',
  alergias: 'Alergias y sensibilidades',
  evaluacion: 'Evaluación del terapeuta',
  consentimiento: 'Consentimiento informado',
}

export const MASSAGE_FIELDS: MassageFieldDef[] = [
  // 2. Servicio solicitado
  { key: 'services', label: 'Servicios', kind: 'multi', group: 'servicio', options: MASSAGE_SERVICES },
  { key: 'servicesOther', label: 'Otro servicio', kind: 'text', group: 'servicio' },
  { key: 'zones', label: 'Zona(s) a trabajar', kind: 'text', group: 'servicio', placeholder: 'p. ej. Abdomen, flancos y muslos' },
  {
    key: 'goals',
    label: 'Objetivo del cliente',
    kind: 'multi',
    group: 'servicio',
    options: opts(['relaxation', 'Relajación'], ['tension', 'Alivio de tensión'], ['recovery', 'Recuperación'], ['aesthetic', 'Estética']),
  },
  { key: 'goalOther', label: 'Otro objetivo', kind: 'text', group: 'servicio' },
  { key: 'surgeryDate', label: 'Fecha de cirugía (si aplica)', kind: 'date', group: 'servicio' },
  {
    key: 'medicalAuthorization',
    label: '¿Tiene autorización médica?',
    kind: 'select',
    group: 'servicio',
    options: opts(['yes', 'Sí'], ['no', 'No'], ['na', 'No aplica']),
  },

  // 3. Antecedentes y estado de salud
  { key: 'hypertension', label: 'Hipertensión o presión baja', kind: 'yesno', group: 'salud', detail: 'Detalles / tratamiento' },
  { key: 'diabetes', label: 'Diabetes', kind: 'yesno', group: 'salud', detail: 'Detalles / tratamiento' },
  { key: 'cardio', label: 'Problemas cardíacos o circulatorios / trombosis', kind: 'yesno', group: 'salud', detail: 'Detalles / tratamiento' },
  { key: 'varices', label: 'Várices importantes o problemas de coagulación', kind: 'yesno', group: 'salud', detail: 'Detalles / tratamiento' },
  { key: 'cancer', label: 'Cáncer, tumor o tratamiento oncológico actual', kind: 'yesno', group: 'salud', detail: 'Detalles / tratamiento' },
  { key: 'pregnancy', label: 'Embarazo o posibilidad de embarazo', kind: 'yesno', group: 'salud', detail: 'Detalles' },
  { key: 'recentSurgery', label: 'Cirugía reciente o procedimiento estético', kind: 'yesno', group: 'salud', detail: 'Cuál y fecha' },
  { key: 'skin', label: 'Enfermedad de la piel, infección o fiebre', kind: 'yesno', group: 'salud', detail: 'Detalles' },
  { key: 'osteo', label: 'Osteoporosis, hernias o problemas articulares', kind: 'yesno', group: 'salud', detail: 'Detalles' },
  { key: 'anticoagulants', label: 'Uso de anticoagulantes u otros medicamentos', kind: 'yesno', group: 'salud', detail: 'Cuáles' },
  { key: 'otherCondition', label: 'Otra condición médica o antecedente relevante', kind: 'yesno', group: 'salud', detail: 'Cuál' },

  // 4. Lesiones, dolor y situaciones recientes
  { key: 'pain', label: '¿Tiene actualmente dolor?', kind: 'yesno', group: 'lesiones', detail: '¿En qué zona?' },
  { key: 'painIntensity', label: 'Intensidad del dolor (0–10)', kind: 'number', group: 'lesiones', min: 0, max: 10 },
  { key: 'painSince', label: 'Dolor desde cuándo', kind: 'text', group: 'lesiones' },
  { key: 'injuries', label: '¿Ha sufrido lesiones recientes?', kind: 'yesno', group: 'lesiones', detail: '¿Cuál y cuándo?' },
  { key: 'wounds', label: '¿Tiene quemaduras, heridas, golpes o moretones?', kind: 'yesno', group: 'lesiones', detail: 'Ubicación y fecha' },
  { key: 'inflammation', label: '¿Tiene inflamación, sensibilidad o pérdida de movilidad?', kind: 'yesno', group: 'lesiones', detail: 'Explique' },
  {
    key: 'sensitiveAreas',
    label: 'Molestias, cicatrices recientes, zonas sensibles o áreas que no desea que se toquen',
    kind: 'long',
    group: 'lesiones',
  },

  // 5. Alergias y sensibilidades
  { key: 'allergyOils', label: 'Aceites o aceites esenciales', kind: 'yesno', group: 'alergias', detail: 'Cuál / reacción' },
  { key: 'allergyCreams', label: 'Cremas, lociones o geles', kind: 'yesno', group: 'alergias', detail: 'Cuál / reacción' },
  { key: 'allergyFragrances', label: 'Fragancias, perfumes u olores', kind: 'yesno', group: 'alergias', detail: 'Cuál / reacción' },
  { key: 'allergyLatex', label: 'Látex u otros materiales', kind: 'yesno', group: 'alergias', detail: 'Cuál / reacción' },
  { key: 'allergyHeat', label: 'Calor, frío o piedras calientes', kind: 'yesno', group: 'alergias', detail: 'Cuál / reacción' },
  { key: 'avoidProducts', label: 'Productos u olores que prefiere evitar', kind: 'text', group: 'alergias' },

  // 6. Evaluación del terapeuta
  { key: 'skinObservations', label: 'Observaciones de la piel y zonas a tratar', kind: 'long', group: 'evaluacion' },
  {
    key: 'pressure',
    label: 'Presión recomendada',
    kind: 'select',
    group: 'evaluacion',
    options: opts(['soft', 'Suave'], ['moderate', 'Moderada'], ['firm', 'Firme']),
  },
  { key: 'precautions', label: 'Precauciones / zonas que se deben evitar', kind: 'long', group: 'evaluacion' },
  { key: 'postpone', label: '¿Se recomienda posponer o solicitar autorización médica?', kind: 'yesno', group: 'evaluacion', detail: 'Motivo' },
  { key: 'sessionNotes', label: 'Notas de la sesión', kind: 'long', group: 'evaluacion', placeholder: 'Técnica, aparatología, duración, cómo respondió…' },

  // 7. Consentimiento
  { key: 'consent', label: 'El cliente leyó y aceptó el consentimiento informado', kind: 'check', group: 'consentimiento' },
  { key: 'guardianName', label: 'Si es menor de edad: nombre del padre, madre o tutor', kind: 'text', group: 'consentimiento' },
]

export const CONSENT_TEXT =
  'Declaro que la información suministrada en esta ficha es verdadera, completa y actualizada. Me comprometo a informar al personal sobre cualquier cambio en mi estado de salud, medicamento, embarazo, dolor, lesión, alergia o sensibilidad antes y durante cada sesión. Comprendo que los masajes y tratamientos ofrecidos son servicios de bienestar y/o estética; no sustituyen una evaluación, diagnóstico ni tratamiento médico, fisioterapéutico o de rehabilitación. Entiendo que pueden presentarse molestias temporales, sensibilidad, enrojecimiento o moretones, dependiendo del tipo de técnica y de mi condición individual. No se me ha garantizado un resultado específico. Autorizo al profesional a detener o modificar la sesión si presenta dolor, irritación, reacción adversa o si considera que continuar no es seguro. Entiendo que ciertos procedimientos, especialmente los postoperatorios, requieren autorización y orientación del médico tratante. Confirmo que pude hacer preguntas, que recibí explicación del servicio y que doy mi consentimiento voluntario. Puedo retirar mi consentimiento o solicitar que la sesión se detenga en cualquier momento.'

export const YES_NO_OPTIONS = opts(['yes', 'Sí'], ['no', 'No'])

/** Every stored key, including the `…Detail` companions of yes/no questions. */
export const MASSAGE_KEYS: string[] = MASSAGE_FIELDS.flatMap((f) => (f.detail ? [f.key, `${f.key}Detail`] : [f.key]))

/** Form state: strings everywhere, string[] for multi-selects, 'yes' | '' for checks. */
export type MassageFormState = Record<string, string | string[]>
export type MassageValues = Record<string, unknown>

export const EMPTY_MASSAGE: MassageFormState = Object.fromEntries(
  MASSAGE_FIELDS.flatMap((f) => {
    const base: [string, string | string[]][] = [[f.key, f.kind === 'multi' ? [] : '']]
    return f.detail ? [...base, [`${f.key}Detail`, '']] : base
  }),
)

/** Stored document → form state. */
export function massageToForm(stored: MassageValues | null | undefined): MassageFormState {
  const s = stored ?? {}
  const out: MassageFormState = { ...EMPTY_MASSAGE }
  for (const f of MASSAGE_FIELDS) {
    const v = s[f.key]
    if (f.kind === 'multi') out[f.key] = Array.isArray(v) ? v.map(String) : []
    else if (f.kind === 'check') out[f.key] = v === true ? 'yes' : ''
    else if (f.kind === 'date') out[f.key] = typeof v === 'string' ? v.slice(0, 10) : ''
    else out[f.key] = v == null ? '' : String(v)
    if (f.detail) out[`${f.key}Detail`] = s[`${f.key}Detail`] == null ? '' : String(s[`${f.key}Detail`])
  }
  return out
}

/**
 * Form state → stored values. Blank fields become null on update and are dropped on
 * create; option values outside the list are dropped rather than failing the save.
 */
export function formToMassage(form: MassageFormState | undefined, forUpdate: boolean): MassageValues | undefined {
  if (!form) return undefined
  const out: MassageValues = {}
  const blank = (key: string) => {
    if (forUpdate) out[key] = null
  }
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  for (const f of MASSAGE_FIELDS) {
    const raw = form[f.key]
    if (f.kind === 'multi') {
      const allowed = new Set(f.options!.map((o) => o.value))
      const vals = (Array.isArray(raw) ? raw : []).filter((v) => allowed.has(v))
      if (vals.length || forUpdate) out[f.key] = vals
    } else if (f.kind === 'check') {
      if (raw === 'yes') out[f.key] = true
      else if (forUpdate) out[f.key] = false
    } else if (f.kind === 'number') {
      const n = Number(str(raw).replace(',', '.'))
      if (str(raw) && Number.isFinite(n) && n >= (f.min ?? -Infinity) && n <= (f.max ?? Infinity)) out[f.key] = n
      else blank(f.key)
    } else if (f.kind === 'yesno' || f.kind === 'select') {
      const opts = f.kind === 'yesno' ? YES_NO_OPTIONS : f.options!
      const v = str(raw)
      if (opts.some((o) => o.value === v)) out[f.key] = v
      else blank(f.key)
    } else if (f.kind === 'date') {
      const v = str(raw)
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) out[f.key] = v
      else blank(f.key)
    } else {
      const v = str(raw)
      if (v) out[f.key] = v.slice(0, 4000)
      else blank(f.key)
    }
    if (f.detail) {
      const d = str(form[`${f.key}Detail`])
      if (d) out[`${f.key}Detail`] = d.slice(0, 1000)
      else blank(`${f.key}Detail`)
    }
  }
  return forUpdate || Object.keys(out).length ? out : undefined
}

const optionLabel = (f: MassageFieldDef, v: string) =>
  (f.kind === 'yesno' ? YES_NO_OPTIONS : f.options ?? []).find((o) => o.value === v)?.label ?? v

/** "Masaje reductor, Drenaje linfático manual" — the session's headline. */
export function massageServicesLine(v: MassageValues | null | undefined): string {
  const services = Array.isArray(v?.services) ? (v!.services as string[]) : []
  const labels = services.map((s) => MASSAGE_SERVICES.find((o) => o.value === s)?.label ?? s)
  if (typeof v?.servicesOther === 'string' && v.servicesOther) labels.push(v.servicesOther)
  return labels.join(', ')
}

/**
 * Non-empty "Label: value" lines for a group, for read-only cards and print.
 * Health questions answered «No» are skipped so the card shows only what matters.
 */
export function massageLines(v: MassageValues | null | undefined, group: MassageGroup): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = []
  for (const f of MASSAGE_FIELDS.filter((x) => x.group === group)) {
    const raw = v?.[f.key]
    if (f.key === 'services' || f.key === 'servicesOther') continue // headline
    if (raw == null || raw === '' || (Array.isArray(raw) && !raw.length)) continue
    let value: string
    if (f.kind === 'multi') value = (raw as string[]).map((x) => optionLabel(f, x)).join(', ')
    else if (f.kind === 'check') {
      if (raw !== true) continue
      value = 'Sí'
    } else if (f.kind === 'yesno') {
      if (raw === 'no' && group !== 'evaluacion') continue
      value = optionLabel(f, String(raw))
    } else if (f.kind === 'select') value = optionLabel(f, String(raw))
    else if (f.kind === 'date') value = String(raw).slice(0, 10).split('-').reverse().join('/')
    else value = String(raw)
    const detail = f.detail ? v?.[`${f.key}Detail`] : null
    lines.push({ label: f.label, value: detail ? `${value} — ${detail}` : value })
  }
  return lines
}

/** Health/allergy flags answered «Sí» — shown as a warning before each session. */
export function massageAlerts(v: MassageValues | null | undefined): string[] {
  return MASSAGE_FIELDS.filter((f) => (f.group === 'salud' || f.group === 'alergias') && f.kind === 'yesno' && v?.[f.key] === 'yes').map((f) => {
    const d = v?.[`${f.key}Detail`]
    return d ? `${f.label}: ${d}` : f.label
  })
}
