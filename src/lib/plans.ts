// Subscription plans & limits (v3 spec §2.1, §4). Limits live in code, not the DB:
// at this scale plans change rarely and a code review is an acceptable, simple gate
// for changing them. This file is deliberately PURE (no payload imports) so the
// owner-facing plan page can import it client-side; enforcement lives in
// src/hooks/planLimit.ts.

//
// Commercial model: ~US$10 per doctor per month. `free` is the trial tier, `pro` is
// the independent-doctor plan (the MVP's main product), `clinic`/`plus` keep the
// multi-doctor path open. Prices are display-only until a payment gateway lands —
// the plan itself is still switched by the super admin (upgrade workflow).
export const PLAN_LIMITS = {
  free: {
    doctors: 1,
    patients: 50,
    label: 'Prueba',
    priceUsd: 0,
    perDoctor: false,
    description: 'Para conocer el sistema. Hasta 50 pacientes.',
  },
  pro: {
    doctors: 1,
    patients: null, // null = unlimited
    label: 'Profesional',
    priceUsd: 10,
    perDoctor: false,
    description: 'Un médico independiente, pacientes ilimitados, asistente incluida.',
  },
  clinic: {
    doctors: 5,
    patients: null,
    label: 'Clínica',
    priceUsd: 10,
    perDoctor: true,
    description: 'Hasta 5 médicos en el mismo consultorio o clínica.',
  },
  plus: {
    doctors: null,
    patients: null,
    label: 'Plus',
    priceUsd: 10,
    perDoctor: true,
    description: 'Médicos ilimitados. Precio por médico.',
  },
} as const

export type Plan = keyof typeof PLAN_LIMITS
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

/** "Gratis", "US$10/mes" or "US$10/médico/mes". */
export function planPriceLabel(plan: Plan): string {
  const p = PLAN_LIMITS[plan]
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
