// Regional preferences per clinic (Configuración → Formato regional): clock format,
// first day of the week and weight / height units. Defaults: 12 h, Sunday, lb, cm.
// Measurements are always STORED in kg and cm; only display and data entry change,
// and the other unit is shown alongside. Pure module: safe in client components.

import { LB_PER_KG, CM_PER_IN } from './program'

export type TimeFormat = '12h' | '24h'
export type WeekStart = 'sunday' | 'monday'
export type WeightUnit = 'lb' | 'kg'
export type HeightUnit = 'cm' | 'in'

export type Regional = {
  timeFormat: TimeFormat
  weekStart: WeekStart
  weightUnit: WeightUnit
  heightUnit: HeightUnit
}

export const DEFAULT_REGIONAL: Regional = { timeFormat: '12h', weekStart: 'sunday', weightUnit: 'lb', heightUnit: 'cm' }

export const TIME_FORMATS = [
  { value: '12h', label: '12 horas (2:30 p. m.)' },
  { value: '24h', label: '24 horas (14:30)' },
] as const
export const WEEK_STARTS = [
  { value: 'sunday', label: 'Domingo' },
  { value: 'monday', label: 'Lunes' },
] as const
export const WEIGHT_UNITS = [
  { value: 'lb', label: 'Libras (lb)' },
  { value: 'kg', label: 'Kilogramos (kg)' },
] as const
export const HEIGHT_UNITS = [
  { value: 'cm', label: 'Centímetros (cm)' },
  { value: 'in', label: 'Pulgadas (in)' },
] as const

type TenantLike = { settings?: Partial<Record<keyof Regional, string | null>> | null } | null | undefined

const pick = <T extends string>(v: unknown, allowed: readonly { value: T }[], fallback: T): T =>
  allowed.some((a) => a.value === v) ? (v as T) : fallback

/** The clinic's preferences, falling back to the defaults for clinics that never set them. */
export function regionalOf(tenant: TenantLike): Regional {
  const s = tenant?.settings ?? {}
  return {
    timeFormat: pick(s.timeFormat, TIME_FORMATS, DEFAULT_REGIONAL.timeFormat),
    weekStart: pick(s.weekStart, WEEK_STARTS, DEFAULT_REGIONAL.weekStart),
    weightUnit: pick(s.weightUnit, WEIGHT_UNITS, DEFAULT_REGIONAL.weightUnit),
    heightUnit: pick(s.heightUnit, HEIGHT_UNITS, DEFAULT_REGIONAL.heightUnit),
  }
}

// ---- Clock ------------------------------------------------------------------

/** 14, 30 → "2:30 p. m." (12 h) or "14:30" (24 h). */
export function clockLabel(h: number, m: number, fmt: TimeFormat = DEFAULT_REGIONAL.timeFormat): string {
  const mm = String(m).padStart(2, '0')
  if (fmt === '24h') return `${String(h).padStart(2, '0')}:${mm}`
  return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

/** Compact clock: "2:30" in 12 h (period implied by context), "14:30" in 24 h. */
export function compactClock(mins: number, fmt?: TimeFormat): string {
  const h = Math.floor(mins / 60) % 24
  const mm = String(mins % 60).padStart(2, '0')
  return fmt === '24h' ? `${String(h).padStart(2, '0')}:${mm}` : `${h % 12 === 0 ? 12 : h % 12}:${mm}`
}

/** "14:30" → compact clock. */
export const compactHHMM = (hhmm: string, fmt?: TimeFormat) => {
  const [h, m] = hhmm.split(':').map(Number)
  return compactClock((h || 0) * 60 + (m || 0), fmt)
}

/** "14:30" → clock label. */
export function hhmmLabel(hhmm: string, fmt?: TimeFormat): string {
  const [h, m] = hhmm.split(':').map(Number)
  return clockLabel(h || 0, m || 0, fmt)
}

/** Minutes from midnight → clock label. */
export const minutesLabel = (mins: number, fmt?: TimeFormat) => clockLabel(Math.floor(mins / 60) % 24, mins % 60, fmt)

/** Intl options for a time in the clinic's format (es-DO). */
export const intlTime = (fmt: TimeFormat = DEFAULT_REGIONAL.timeFormat): Intl.DateTimeFormatOptions =>
  fmt === '24h' ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : { hour: 'numeric', minute: '2-digit', hour12: true }

/**
 * Intl output for 12 h ends in "p. m." (Node and browsers also disagree on the
 * separator), so build "28 de noviembre de 2026, 2:30 p. m." by hand.
 */
export function dateTimeLabel(value: Date | string, timeZone: string, fmt?: TimeFormat, opts: { year?: boolean } = {}): string {
  const d = new Date(value)
  const date = d.toLocaleDateString('es-DO', { day: 'numeric', month: 'long', ...(opts.year === false ? {} : { year: 'numeric' }), timeZone })
  const [h, m] = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone })
    .format(d)
    .split(':')
    .map(Number)
  return `${date}, ${clockLabel(h || 0, m || 0, fmt)}`
}

/** A sentence ending with a 12 h time already has its period ("p. m."). */
export const endSentence = (s: string) => (s.endsWith('.') ? s : `${s}.`)

// ---- Week -------------------------------------------------------------------

/** Day keys in display order. */
export function weekOrder(start: WeekStart = DEFAULT_REGIONAL.weekStart): string[] {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return start === 'monday' ? [...days.slice(1), days[0]!] : days
}

/** react-day-picker / date-fns `weekStartsOn`. */
export const weekStartsOn = (start: WeekStart = DEFAULT_REGIONAL.weekStart): 0 | 1 => (start === 'monday' ? 1 : 0)

/** Sort items with a weekday key into the clinic's week order. */
export function sortByWeek<T extends { value: string }>(items: readonly T[], start?: WeekStart): T[] {
  const order = weekOrder(start)
  return [...items].sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value))
}

// ---- Weight & height --------------------------------------------------------

const round1 = (n: number) => Math.round(n * 10) / 10

/** kg → value in the unit (1 decimal). */
export const weightIn = (kg: number, unit: WeightUnit) => (unit === 'lb' ? round1(kg * LB_PER_KG) : round1(kg))
/** Entered value in the unit → kg (2 decimals, as stored). */
export const weightToKg = (v: number, unit: WeightUnit) => (unit === 'lb' ? Math.round((v / LB_PER_KG) * 100) / 100 : v)

/** "165.3 lb · 75.0 kg" — the clinic's unit first, the other alongside. */
export function weightLabel(kg: number | null | undefined, unit: WeightUnit = DEFAULT_REGIONAL.weightUnit): string {
  if (kg == null || !Number.isFinite(kg) || kg <= 0) return '—'
  const other: WeightUnit = unit === 'lb' ? 'kg' : 'lb'
  return `${weightIn(kg, unit).toFixed(1)} ${unit} · ${weightIn(kg, other).toFixed(1)} ${other}`
}

/** Signed change: "−3.2 lb (−1.5 kg)". */
export function weightDeltaLabel(kg: number, unit: WeightUnit = DEFAULT_REGIONAL.weightUnit): string {
  const other: WeightUnit = unit === 'lb' ? 'kg' : 'lb'
  const sign = kg > 0 ? '+' : kg < 0 ? '−' : ''
  return `${sign}${Math.abs(weightIn(kg, unit)).toFixed(1)} ${unit} (${sign}${Math.abs(weightIn(kg, other)).toFixed(1)} ${other})`
}

export const heightIn = (cm: number, unit: HeightUnit) => (unit === 'in' ? round1(cm / CM_PER_IN) : round1(cm))
export const heightToCm = (v: number, unit: HeightUnit) => (unit === 'in' ? round1(v * CM_PER_IN) : v)

/** "170 cm · 66.9 in". */
export function heightLabel(cm: number | null | undefined, unit: HeightUnit = DEFAULT_REGIONAL.heightUnit): string {
  if (cm == null || !Number.isFinite(cm) || cm <= 0) return '—'
  const other: HeightUnit = unit === 'cm' ? 'in' : 'cm'
  const f = (u: HeightUnit) => (u === 'cm' ? String(Math.round(cm)) : heightIn(cm, 'in').toFixed(1))
  return `${f(unit)} ${unit} · ${f(other)} ${other}`
}
