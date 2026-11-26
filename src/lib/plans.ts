// Subscription plans & limits (v3 spec §2.1, §4). Limits live in code, not the DB:
// at this scale plans change rarely and a code review is an acceptable, simple gate
// for changing them. This file is deliberately PURE (no payload imports) so the
// owner-facing plan page can import it client-side; enforcement lives in
// src/hooks/planLimit.ts.

//
// Commercial model (2026-10): `free` is the trial tier; `pro` is one independent
// doctor plus their assistant; `clinic` is a flat-priced practice of up to 3
// doctors; `plus` is private clinics priced per doctor; `public` is government
// hospitals, quoted individually (priceUsd null). Plan keys are stored on tenants,
// so labels/prices may change but keys must not be renamed. Prices are
// display-only until a payment gateway lands — the super admin switches plans.
export const PLAN_LIMITS = {
  free: {
    doctors: 1,
    patients: 50,
    label: 'Gratis',
    priceUsd: 0,
    perDoctor: false,
    description: 'Para probar EMR con pacientes reales.',
  },
  pro: {
    doctors: 1,
    patients: null, // null = unlimited
    label: 'Médico independiente',
    priceUsd: 25,
    perDoctor: false,
    description: 'Un médico y su asistente.',
  },
  clinic: {
    doctors: 3,
    patients: null,
    label: 'Consultorio',
    priceUsd: 50,
    perDoctor: false,
    description: 'Hasta 3 médicos en el mismo consultorio.',
  },
  plus: {
    doctors: null,
    patients: null,
    label: 'Clínica privada',
    priceUsd: 15,
    perDoctor: true,
    description: 'Clínicas con más médicos.',
  },
  public: {
    doctors: null,
    patients: null,
    label: 'Hospital público',
    priceUsd: null,
    perDoctor: false,
    description: 'Hospitales del Estado y centros de salud.',
  },
} as const satisfies Record<
  string,
  {
    doctors: number | null
    patients: number | null
    label: string
    priceUsd: number | null
    perDoctor: boolean
    description: string
  }
>

export type Plan = keyof typeof PLAN_LIMITS

// ---- Marketing (pricing page) ---------------------------------------------
// Plans are grouped in two audiences and each lists only what it ADDS over the
// previous one ("Todo lo de X, más:"). Only list what the software really does;
// service commitments (support, onboarding) are marked as such in the docs.

export type PlanAudience = 'individual' | 'institutions'

export const PLAN_AUDIENCES: { key: PlanAudience; label: string; hint: string; plans: Plan[] }[] = [
  { key: 'individual', label: 'Médicos y consultorios', hint: 'Para el médico independiente y consultorios pequeños.', plans: ['free', 'pro', 'clinic'] },
  { key: 'institutions', label: 'Clínicas e instituciones', hint: 'Para clínicas privadas y hospitales del Estado.', plans: ['plus', 'public'] },
]

export type PlanFeature = { text: string; included: boolean }

export const PLAN_FEATURES: Record<Plan, { inherits?: Plan; features: PlanFeature[] }> = {
  free: {
    features: [
      { text: '1 médico', included: true },
      { text: 'Hasta 50 pacientes', included: true },
      { text: 'Agenda, expediente y recetas', included: true },
      { text: 'Facturación y pagos', included: true },
      { text: 'Recordatorios por WhatsApp', included: false },
    ],
  },
  pro: {
    inherits: 'free',
    features: [
      { text: 'Pacientes ilimitados', included: true },
      { text: 'Cuenta para su asistente', included: true },
      { text: 'Recordatorios por WhatsApp', included: true },
      { text: 'Formatos de consulta por especialidad (nutrición)', included: true },
      { text: 'Reportes mensuales y exportación a Excel', included: true },
    ],
  },
  clinic: {
    inherits: 'pro',
    features: [
      { text: 'Hasta 3 médicos en un solo pago', included: true },
      { text: 'Expediente compartido: todos los médicos ven la historia completa del paciente', included: true },
      { text: 'Asistentes para todo el consultorio', included: true },
      { text: 'Agenda y reportes por médico', included: true },
      { text: 'Registro de actividad (auditoría)', included: true },
    ],
  },
  plus: {
    inherits: 'clinic',
    features: [
      { text: 'Médicos ilimitados, pago por médico', included: true },
      { text: 'Una sola historia clínica por paciente en toda la institución', included: true },
      { text: 'Ayuda para migrar sus expedientes ¹', included: true },
      { text: 'Soporte prioritario por WhatsApp ¹', included: true },
    ],
  },
  public: {
    inherits: 'plus',
    features: [
      { text: 'Precio y facturación bajo contrato institucional ¹', included: true },
      { text: 'Capacitación del personal ¹', included: true },
      { text: 'Opción de instalar en los servidores de la institución', included: true },
    ],
  },
}
export type LimitedResource = 'doctors' | 'patients'

export const PLANS = Object.keys(PLAN_LIMITS) as Plan[]

/**
 * True when `value` is one of our plan keys. Uses an own-property check: a plain
 * `value in PLAN_LIMITS` also accepts inherited keys such as "toString" or
 * "constructor", which resolve to functions instead of a limits object (and then
 * read as "no limit" in the enforcement hook).
 */
export function isPlan(value: unknown): value is Plan {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLAN_LIMITS, value)
}

/** Narrow an untrusted value to a known plan, defaulting to `free`. */
export function asPlan(value: unknown): Plan {
  return isPlan(value) ? value : 'free'
}

/** The cap for a resource on a plan; `null` means unlimited. */
export function limitFor(plan: Plan, resource: LimitedResource): number | null {
  return PLAN_LIMITS[plan][resource]
}

export const planLabel = (plan: Plan): string => PLAN_LIMITS[plan].label

/** "Gratis", "Cotizado", "US$25/mes" or "US$15/médico/mes". */
export function planPriceLabel(plan: Plan): string {
  const p = PLAN_LIMITS[plan]
  if (p.priceUsd === null) return 'Cotizado'
  if (p.priceUsd === 0) return 'Gratis'
  return p.perDoctor ? `US$${p.priceUsd}/médico/mes` : `US$${p.priceUsd}/mes`
}

/** Spanish noun for a limited resource, singular/plural aware. */
export function resourceLabel(resource: LimitedResource, n: number): string {
  if (resource === 'doctors') return n === 1 ? 'médico' : 'médicos'
  return n === 1 ? 'paciente' : 'pacientes'
}

/**
 * Usage summary for a progress bar. `limit: null` ⇒ unlimited (no bar).
 * `atLimit` drives the "Request upgrade" prompt; `near` (≥80%) drives a quiet note.
 */
export function usage(
  plan: Plan,
  resource: LimitedResource,
  count: number,
): { count: number; limit: number | null; atLimit: boolean; near: boolean; ratio: number } {
  const limit = limitFor(plan, resource)
  if (limit === null) return { count, limit: null, atLimit: false, near: false, ratio: 0 }
  const ratio = limit === 0 ? 1 : Math.min(1, count / limit)
  return { count, limit, atLimit: count >= limit, near: count >= limit * 0.8, ratio }
}

// ---- Metered quotas (roadmap B1) -------------------------------------------
// Separate from the hard caps above (doctors/patients), which gate *creation*.
// Metered quotas count consumption of costly actions — AI study interpretations,
// automated WhatsApp messages, optical orders — per calendar month, plus total
// file storage. Policy mirrors igalenus: a SOFT cap. Owners are warned at 80% and
// 100%; over quota, only the metered action itself is refused (e.g. sending one
// more WhatsApp). Clinical care and existing records are never blocked.
//
// Draft numbers (PARTE IV §19 of docs/feedback-igaleno-y-oftalmologia.md); they
// are fixed once B1 measures real usage and Meta/AI costs are known. Keep every
// quota number in this table.
//
// Carry-over: igalenus rolls unused units into the next month (up to one full
// allowance). Not implemented. When it is, it belongs in `effectiveQuota()` below
// (limit + min(limit, unused last period)), so callers and the UI pick it up.

export type MeteredResource =
  | 'whatsappMessages'
  | 'aiDictations'
  | 'aiStudies'
  | 'aiSummaries'
  | 'opticalOrders'
  | 'emailReminders'
  | 'storageBytes'

/** Resources counted per calendar month (in the clinic's timezone), in display order (spec §2). */
export const MONTHLY_RESOURCES = [
  'whatsappMessages',
  'aiDictations',
  'aiStudies',
  'aiSummaries',
  'opticalOrders',
  'emailReminders',
] as const
export type MonthlyResource = (typeof MONTHLY_RESOURCES)[number]

/** Every metered resource, in display order. `storageBytes` is a running total, not monthly. */
export const METERED_RESOURCES: readonly MeteredResource[] = [...MONTHLY_RESOURCES, 'storageBytes']

export const isMonthlyResource = (r: MeteredResource): r is MonthlyResource => r !== 'storageBytes'

const GB = 1024 ** 3

/**
 * Quota per plan; `null` = unlimited, `0` = not included in the plan.
 *
 * Dictations, summaries and email reminders follow spec §2. Clínica privada's
 * dictations are «100 por médico» pooled for the clinic; until per-doctor pooling
 * lands this is the 4-doctor minimum (400). Gratis aiStudies/storage and
 * Consultorio storage differ from the spec (5 / 1 GB / 100 GB) and stay as they
 * are until the owner decides (lowering a quota would affect live accounts).
 */
export const PLAN_QUOTAS = {
  free: { whatsappMessages: 0, aiDictations: 5, aiStudies: 10, aiSummaries: 10, opticalOrders: 15, emailReminders: 100, storageBytes: 2 * GB },
  pro: { whatsappMessages: 500, aiDictations: 100, aiStudies: 60, aiSummaries: 150, opticalOrders: null, emailReminders: null, storageBytes: 25 * GB },
  clinic: { whatsappMessages: 1000, aiDictations: 300, aiStudies: 150, aiSummaries: 400, opticalOrders: null, emailReminders: null, storageBytes: 50 * GB },
  plus: { whatsappMessages: 2000, aiDictations: 400, aiStudies: 250, aiSummaries: 1000, opticalOrders: null, emailReminders: null, storageBytes: 200 * GB },
  public: { whatsappMessages: null, aiDictations: null, aiStudies: null, aiSummaries: null, opticalOrders: null, emailReminders: null, storageBytes: null },
} as const satisfies Record<Plan, Record<MeteredResource, number | null>>

// ---- Quota packs (spec §2) ---------------------------------------------------
// One-off purchases that add units on top of the monthly quota for 90 days (or
// until used up). The monthly quota is spent first, then the pack that expires
// soonest. Gratis may buy AI packs but not WhatsApp. Monthly add-ons (+50 GB,
// +1 user, +1 doctor) are billed with the subscription and belong to phase 3.

export const PACK_VALID_DAYS = 90

export type PackResource = 'whatsappMessages' | 'aiDictations' | 'aiStudies' | 'aiSummaries'

export const QUOTA_PACKS: readonly { resource: PackResource; units: number; priceUsd: number }[] = [
  { resource: 'whatsappMessages', units: 500, priceUsd: 10 },
  { resource: 'aiDictations', units: 100, priceUsd: 10 },
  { resource: 'aiStudies', units: 50, priceUsd: 10 },
  { resource: 'aiSummaries', units: 200, priceUsd: 10 },
]

export const PACK_RESOURCES: readonly PackResource[] = QUOTA_PACKS.map((p) => p.resource)

export const isPackResource = (r: unknown): r is PackResource =>
  typeof r === 'string' && (PACK_RESOURCES as readonly string[]).includes(r)

/** Can a clinic on `plan` buy (or be given) packs of `resource`? */
export function packAllowed(plan: Plan, resource: MeteredResource): resource is PackResource {
  if (!isPackResource(resource)) return false
  if (quotaFor(plan, resource) === null) return false // unlimited: nothing to add
  return !(asPlan(plan) === 'free' && resource === 'whatsappMessages')
}

/** Units left in a clinic's live packs for one resource, and the soonest expiry. */
export type PackBalance = { remaining: number; nextExpiry: string | null }

export const NO_PACKS: PackBalance = { remaining: 0, nextExpiry: null }

/** Warning threshold: "se está acercando al límite". */
export const QUOTA_NEAR_RATIO = 0.8

/** The plan's quota for a metered resource; `null` = unlimited. */
export function quotaFor(plan: Plan, resource: MeteredResource): number | null {
  return PLAN_QUOTAS[asPlan(plan)][resource]
}

/**
 * The quota in force right now: the plan's monthly quota plus what is left in
 * live packs. `null` = unlimited. Unused monthly units do not carry over (spec §2,
 * first version).
 */
export function effectiveQuota(plan: Plan, resource: MeteredResource, packRemaining = 0): number | null {
  const q = quotaFor(plan, resource)
  if (q === null) return null
  return q + Math.max(0, packRemaining)
}

export type QuotaStatus = {
  used: number
  /** `null` = unlimited. */
  limit: number | null
  /** 0..1 for the progress bar (clamped; over quota reads as 1). */
  ratio: number
  /** ≥ 80% used (also true at/over the limit). */
  near: boolean
  /** ≥ 100% used: the next metered action would be refused. */
  atLimit: boolean
  /** Units used beyond the limit (after a downgrade, or a concurrent overshoot). */
  over: number
  /** False when the plan's quota is 0 (feature not in the plan) and no pack adds units. */
  included: boolean
  /** Units left in live packs (spent only after the monthly quota). */
  packRemaining: number
  /** ISO date the soonest-expiring live pack ends, if any. */
  packNextExpiry: string | null
}

/**
 * Pure quota math. Negative/NaN usage (e.g. a storage total that drifted after
 * deletes) reads as 0. The 80% test uses integer arithmetic (used·5 ≥ limit·4)
 * so it is exact for every limit.
 */
export function quotaStatus(
  plan: Plan,
  resource: MeteredResource,
  used: number,
  packs: PackBalance = NO_PACKS,
): QuotaStatus {
  const u = Number.isFinite(used) && used > 0 ? used : 0
  const packRemaining = Math.max(0, packs.remaining || 0)
  const packNextExpiry = packRemaining > 0 ? packs.nextExpiry : null
  const monthly = quotaFor(plan, resource)
  if (monthly === null) {
    return { used: u, limit: null, ratio: 0, near: false, atLimit: false, over: 0, included: true, packRemaining: 0, packNextExpiry: null }
  }
  if (monthly <= 0 && packRemaining === 0) {
    return { used: u, limit: 0, ratio: 1, near: true, atLimit: true, over: u, included: false, packRemaining: 0, packNextExpiry: null }
  }
  // `limit` is the monthly quota (the bar); packs are reported apart. Usage beyond
  // the monthly quota was paid from packs, so with units left it is not "over".
  const withPacks = packRemaining > 0
  return {
    used: u,
    limit: monthly,
    ratio: monthly > 0 ? Math.min(1, u / monthly) : 1,
    near: withPacks ? false : u * 5 >= monthly * 4, // ≥ 80%, exact integer arithmetic
    atLimit: withPacks ? false : u >= monthly,
    over: withPacks ? 0 : Math.max(0, u - monthly),
    included: true,
    packRemaining,
    packNextExpiry,
  }
}

/** Would consuming `n` more units fit in what is left (monthly quota, then packs)? */
export function quotaAllows(status: QuotaStatus, n = 1): boolean {
  if (status.limit === null) return true
  const monthlyLeft = Math.max(0, status.limit - status.used)
  return n <= monthlyLeft + status.packRemaining
}

export const METERED_LABELS: Record<MeteredResource, string> = {
  whatsappMessages: 'Mensajes de WhatsApp',
  aiDictations: 'Consultas dictadas con IA',
  aiStudies: 'Estudios con IA',
  aiSummaries: 'Resúmenes con IA',
  opticalOrders: 'Órdenes de óptica',
  emailReminders: 'Recordatorios por correo',
  storageBytes: 'Almacenamiento',
}

/** Spanish noun for a metered unit, singular/plural aware. */
export function meteredUnit(resource: MeteredResource, n: number): string {
  switch (resource) {
    case 'aiStudies':
      return n === 1 ? 'estudio con IA' : 'estudios con IA'
    case 'aiDictations':
      return n === 1 ? 'consulta dictada con IA' : 'consultas dictadas con IA'
    case 'aiSummaries':
      return n === 1 ? 'resumen con IA' : 'resúmenes con IA'
    case 'emailReminders':
      return n === 1 ? 'recordatorio por correo' : 'recordatorios por correo'
    case 'whatsappMessages':
      return n === 1 ? 'mensaje de WhatsApp' : 'mensajes de WhatsApp'
    case 'opticalOrders':
      return n === 1 ? 'orden de óptica' : 'órdenes de óptica'
    case 'storageBytes':
      return 'de almacenamiento'
  }
}

/** "2 GB", "1.5 GB", "350 MB". */
export function formatBytes(bytes: number): string {
  const b = Math.max(0, bytes || 0)
  if (b >= GB) {
    const v = b / GB
    return `${Number.isInteger(v) ? v : v.toFixed(1)} GB`
  }
  return `${Math.round(b / 1024 ** 2)} MB`
}

/** A quantity of a metered resource, for display ("1,000", "2 GB"). */
export const formatMetered = (resource: MeteredResource, n: number): string =>
  resource === 'storageBytes' ? formatBytes(n) : n.toLocaleString('en-US')

/** Plan-card line: "60 estudios con IA al mes", "Sin mensajes de whatsapp", "25 GB de almacenamiento"… */
export function quotaLine(plan: Plan, resource: MeteredResource): string {
  const q = quotaFor(plan, resource)
  if (q === null) {
    if (resource === 'storageBytes') return 'Almacenamiento ilimitado'
    const unit = meteredUnit(resource, 2)
    const fem = resource === 'opticalOrders' || resource === 'aiDictations'
    return `${unit.charAt(0).toUpperCase()}${unit.slice(1)} ${fem ? 'ilimitadas' : 'ilimitados'}`
  }
  if (q === 0) return `Sin ${meteredUnit(resource, 2)}`
  if (resource === 'storageBytes') return `${formatBytes(q)} de almacenamiento`
  return `${formatMetered(resource, q)} ${meteredUnit(resource, q)} al mes`
}

/**
 * The Spanish refusal for a metered action over quota. Only that action is
 * refused, and the message says so.
 */
export function quotaExceededMessage(plan: Plan, resource: MeteredResource, status: QuotaStatus): string {
  const label = planLabel(plan)
  if (!status.included) {
    return `Su plan ${label} no incluye ${meteredUnit(resource, 2)}. Solicite una mejora de plan para usarlo.`
  }
  if (resource === 'storageBytes') return 'No se pueden subir más archivos. Nada se borra.'
  const way = packAllowed(plan, resource) ? 'compre un paquete o mejore su plan' : 'mejore su plan'
  return `Se agotó su cuota de ${meteredUnit(resource, 2)} de este mes. Sus expedientes siguen disponibles; ${way} para continuar.`
}

/** Spec §2 80% notice: «Va por el 80 % de sus mensajes de WhatsApp de este mes (400 de 500). Se reinician el 1 de diciembre.» */
export function quotaNearMessage(resource: MeteredResource, status: QuotaStatus, period: string): string {
  const limit = status.limit ?? 0
  if (resource === 'storageBytes') {
    return `Va por el 80 % de su almacenamiento (${formatBytes(status.used)} de ${formatBytes(limit)}).`
  }
  return `Va por el 80 % de sus ${meteredUnit(resource, 2)} de este mes (${formatMetered(resource, status.used)} de ${formatMetered(resource, limit)}). Se reinician el ${resetLabel(period)}.`
}

/** "1 de diciembre": the first day of the month after `period` ("YYYY-MM"). */
export function resetLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return 'próximo mes'
  const next = new Date(Date.UTC(m === 12 ? y + 1 : y, m % 12, 1))
  return `1 de ${next.toLocaleDateString('es-DO', { month: 'long', timeZone: 'UTC' })}`
}

/** Period key used by `storageBytes` (a running total, never reset). */
export const STORAGE_PERIOD = 'total'

/** "YYYY-MM" of `date` in the clinic's timezone. */
export function monthKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(date)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  return `${y}-${m}`
}

/**
 * Usage period key. Monthly resources: the month *in the clinic's timezone* — a
 * 23:30 action on Nov 30 in Santo Domingo is 03:30 UTC Dec 1 and still counts for
 * November. `storageBytes` always uses "total".
 */
export function usagePeriod(resource: MeteredResource, date: Date, timeZone: string): string {
  return isMonthlyResource(resource) ? monthKey(date, timeZone) : STORAGE_PERIOD
}

/** "noviembre de 2026" for "2026-11". */
export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return period
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('es-DO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
