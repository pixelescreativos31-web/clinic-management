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
    description: 'Un médico y su asistente, pacientes ilimitados.',
  },
  clinic: {
    doctors: 3,
    patients: null,
    label: 'Consultorio',
    priceUsd: 50,
    perDoctor: false,
    description: 'Hasta 3 médicos en el mismo consultorio, con sus asistentes.',
  },
  plus: {
    doctors: null,
    patients: null,
    label: 'Clínica privada',
    priceUsd: 15,
    perDoctor: true,
    description: 'Clínicas con más médicos. Precio por médico.',
  },
  public: {
    doctors: null,
    patients: null,
    label: 'Hospital público',
    priceUsd: null,
    perDoctor: false,
    description: 'Hospitales y centros del Estado. Precio según el contrato.',
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
      { text: 'Formatos de consulta por especialidad (p. ej. nutrición)', included: true },
      { text: 'Reportes mensuales y exportación a Excel', included: true },
    ],
  },
  clinic: {
    inherits: 'pro',
    features: [
      { text: 'Hasta 3 médicos con un solo pago', included: true },
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
      { text: 'Ayuda para migrar sus expedientes', included: true },
      { text: 'Soporte prioritario por WhatsApp', included: true },
    ],
  },
  public: {
    inherits: 'plus',
    features: [
      { text: 'Precio y facturación según contrato institucional', included: true },
      { text: 'Implementación y capacitación del personal', included: true },
      { text: 'Opción de instalar en servidores de la institución', included: true },
    ],
  },
}
export type LimitedResource = 'doctors' | 'patients'

export const PLANS = Object.keys(PLAN_LIMITS) as Plan[]

/** Narrow an untrusted value to a known plan, defaulting to `free`. */
export function asPlan(value: unknown): Plan {
  return typeof value === 'string' && value in PLAN_LIMITS ? (value as Plan) : 'free'
}

/** The cap for a resource on a plan; `null` means unlimited. */
export function limitFor(plan: Plan, resource: LimitedResource): number | null {
  return PLAN_LIMITS[plan][resource]
}

export const planLabel = (plan: Plan): string => PLAN_LIMITS[plan].label

/** "Gratis", "A cotizar", "US$25/mes" or "US$15/médico/mes". */
export function planPriceLabel(plan: Plan): string {
  const p = PLAN_LIMITS[plan]
  if (p.priceUsd === null) return 'A cotizar'
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
