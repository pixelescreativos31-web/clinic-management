// Generic specialty-sheet engine. A specialty's clinical sheet (massage, and next
// ophthalmology, dentistry…) is ONE list of field definitions; this module derives
// from it everything the app needs:
//   - the Payload schema (`sheetPayloadFields`)
//   - the empty form state and stored → form conversion
//   - form → stored normalisation (`formToSheet`, the server-side guard)
//   - readable «Label: value» lines for cards and print
// Adding a question to a sheet is a one-line change in that sheet's module.
//
// Per-eye capture: a field with `eyes: true` is stored twice, as `${key}OD` (ojo
// derecho) and `${key}OI` (ojo izquierdo), each validated like the base field.
//
// Pure module (types only from payload) so client components can import it.

import type { Field } from 'payload'

export type SheetKind = 'multi' | 'yesno' | 'select' | 'text' | 'long' | 'number' | 'date' | 'check'
export type SheetOption = { value: string; label: string }

export type SheetFieldDef<G extends string = string> = {
  key: string
  label: string
  kind: SheetKind
  group: G
  options?: SheetOption[]
  /** yes/no questions with a free-text "details" field stored as `${key}Detail`. */
  detail?: string
  min?: number
  max?: number
  /** Decimal places kept for numbers (default: as typed). */
  step?: number
  unit?: string
  placeholder?: string
  /** Captured once per eye: stored as `${key}OD` and `${key}OI`. */
  eyes?: boolean
}

export const EYES = [
  { suffix: 'OD', label: 'OD', name: 'Ojo derecho' },
  { suffix: 'OI', label: 'OI', name: 'Ojo izquierdo' },
] as const

export const YES_NO_OPTIONS: SheetOption[] = [
  { value: 'yes', label: 'Sí' },
  { value: 'no', label: 'No' },
]

export const opts = (...labels: [string, string][]): SheetOption[] => labels.map(([value, label]) => ({ value, label }))

/** Form state: strings everywhere, string[] for multi-selects, 'yes' | '' for checks. */
export type SheetFormState = Record<string, string | string[]>
export type SheetValues = Record<string, unknown>

/** The stored keys one definition expands to (eyes → OD/OI; + Detail companion). */
export function fieldKeys(f: SheetFieldDef): string[] {
  const base = f.eyes ? EYES.map((e) => `${f.key}${e.suffix}`) : [f.key]
  return f.detail ? [...base, `${f.key}Detail`] : base
}

/** The value keys only (no Detail companion). */
const valueKeys = (f: SheetFieldDef): string[] => (f.eyes ? EYES.map((e) => `${f.key}${e.suffix}`) : [f.key])

export function sheetKeys(fields: SheetFieldDef[]): string[] {
  return fields.flatMap(fieldKeys)
}

export function emptySheet(fields: SheetFieldDef[]): SheetFormState {
  const out: SheetFormState = {}
  for (const f of fields) {
    for (const k of valueKeys(f)) out[k] = f.kind === 'multi' ? [] : ''
    if (f.detail) out[`${f.key}Detail`] = ''
  }
  return out
}

/** Stored document → form state. */
export function sheetToForm(fields: SheetFieldDef[], stored: SheetValues | null | undefined): SheetFormState {
  const s = stored ?? {}
  const out = emptySheet(fields)
  for (const f of fields) {
    for (const k of valueKeys(f)) {
      const v = s[k]
      if (f.kind === 'multi') out[k] = Array.isArray(v) ? v.map(String) : []
      else if (f.kind === 'check') out[k] = v === true ? 'yes' : ''
      else if (f.kind === 'date') out[k] = typeof v === 'string' ? v.slice(0, 10) : ''
      else out[k] = v == null ? '' : String(v)
    }
    if (f.detail) out[`${f.key}Detail`] = s[`${f.key}Detail`] == null ? '' : String(s[`${f.key}Detail`])
  }
  return out
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Parse a typed number («1,5», « 2 ») within the field's range; undefined when invalid. */
export function parseSheetNumber(raw: unknown, f: Pick<SheetFieldDef, 'min' | 'max' | 'step'>): number | undefined {
  const s = typeof raw === 'number' ? String(raw) : str(raw).replace(',', '.')
  if (!s || !/^[-+]?\d*\.?\d+$/.test(s)) return undefined
  const n = Number(s)
  if (!Number.isFinite(n) || n < (f.min ?? -Infinity) || n > (f.max ?? Infinity)) return undefined
  return f.step != null ? Number(n.toFixed(f.step)) : n
}

/** A real YYYY-MM-DD calendar day (rejects 2026-02-30, which Date would roll over). */
export function isCalendarDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/**
 * Form state → stored values. Blank or invalid fields become null on update and are
 * dropped on create; option values outside the list are dropped rather than failing
 * the save. Returns undefined on create when nothing was filled.
 */
export function formToSheet(fields: SheetFieldDef[], form: SheetFormState | undefined, forUpdate: boolean): SheetValues | undefined {
  if (!form) return undefined
  const out: SheetValues = {}
  const blank = (key: string) => {
    if (forUpdate) out[key] = null
  }
  for (const f of fields) {
    for (const key of valueKeys(f)) {
      const raw = form[key]
      if (f.kind === 'multi') {
        const allowed = new Set((f.options ?? []).map((o) => o.value))
        const vals = [...new Set((Array.isArray(raw) ? raw : []).filter((v) => allowed.has(v)))]
        if (vals.length || forUpdate) out[key] = vals
      } else if (f.kind === 'check') {
        if (raw === 'yes') out[key] = true
        else if (forUpdate) out[key] = false
      } else if (f.kind === 'number') {
        const n = parseSheetNumber(raw, f)
        if (n !== undefined) out[key] = n
        else blank(key)
      } else if (f.kind === 'yesno' || f.kind === 'select') {
        const options = f.kind === 'yesno' ? YES_NO_OPTIONS : (f.options ?? [])
        const v = str(raw)
        if (options.some((o) => o.value === v)) out[key] = v
        else blank(key)
      } else if (f.kind === 'date') {
        const v = str(raw)
        if (isCalendarDate(v)) out[key] = v
        else blank(key)
      } else {
        const v = str(raw)
        if (v) out[key] = v.slice(0, 4000)
        else blank(key)
      }
    }
    if (f.detail) {
      const d = str(form[`${f.key}Detail`])
      if (d) out[`${f.key}Detail`] = d.slice(0, 1000)
      else blank(`${f.key}Detail`)
    }
  }
  return forUpdate || Object.keys(out).length ? out : undefined
}

export const optionLabel = (f: SheetFieldDef, v: string) => (f.kind === 'yesno' ? YES_NO_OPTIONS : (f.options ?? [])).find((o) => o.value === v)?.label ?? v

/** One stored value as display text; null when there is nothing to show. */
export function displayValue(f: SheetFieldDef, raw: unknown): string | null {
  if (raw == null || raw === '' || (Array.isArray(raw) && !raw.length)) return null
  if (f.kind === 'multi') return (raw as unknown[]).map((x) => optionLabel(f, String(x))).join(', ')
  if (f.kind === 'check') return raw === true ? 'Sí' : null
  if (f.kind === 'yesno' || f.kind === 'select') return optionLabel(f, String(raw))
  if (f.kind === 'date') return String(raw).slice(0, 10).split('-').reverse().join('/')
  if (f.kind === 'number' && f.unit) return `${raw} ${f.unit}`
  return String(raw)
}

/**
 * Non-empty «Label: value» lines for the given fields. Per-eye fields read
 * «OD 20/20 · OI 20/40». `skip` lets a sheet hide answers that carry no signal
 * (e.g. health questions answered «No»).
 */
export function sheetLines(
  fields: SheetFieldDef[],
  v: SheetValues | null | undefined,
  skip?: (f: SheetFieldDef, raw: unknown) => boolean,
): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = []
  for (const f of fields) {
    let value: string | null
    if (f.eyes) {
      const parts = EYES.map((e) => {
        const d = displayValue(f, v?.[`${f.key}${e.suffix}`])
        return d == null ? null : `${e.label} ${d}`
      }).filter(Boolean)
      value = parts.length ? parts.join(' · ') : null
    } else {
      const raw = v?.[f.key]
      if (skip?.(f, raw)) continue
      value = displayValue(f, raw)
    }
    if (value == null) continue
    const detail = f.detail ? v?.[`${f.key}Detail`] : null
    lines.push({ label: f.label, value: detail ? `${value} — ${detail}` : value })
  }
  return lines
}

/** Payload fields for a sheet group (one per stored key). */
export function sheetPayloadFields(fields: SheetFieldDef[]): Field[] {
  return fields.flatMap((f): Field[] => {
    const label = f.unit ? `${f.label} (${f.unit})` : f.label
    const one = (name: string, lbl: string): Field => {
      if (f.kind === 'multi') return { name, type: 'select', hasMany: true, label: lbl, options: f.options ?? [] }
      if (f.kind === 'yesno') return { name, type: 'select', label: lbl, options: YES_NO_OPTIONS }
      if (f.kind === 'select') return { name, type: 'select', label: lbl, options: f.options ?? [] }
      if (f.kind === 'number') return { name, type: 'number', label: lbl, min: f.min, max: f.max }
      if (f.kind === 'check') return { name, type: 'checkbox', label: lbl }
      if (f.kind === 'long') return { name, type: 'textarea', label: lbl }
      return { name, type: 'text', label: lbl } // text, date (YYYY-MM-DD)
    }
    const values = f.eyes ? EYES.map((e) => one(`${f.key}${e.suffix}`, `${label} — ${e.label}`)) : [one(f.key, label)]
    return f.detail ? [...values, { name: `${f.key}Detail`, type: 'text', label: `${f.label} — ${f.detail}` }] : values
  })
}
