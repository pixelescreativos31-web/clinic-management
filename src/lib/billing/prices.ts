// Client-safe billing constants (no server imports): which plans are sold online
// and their price per interval. Annual = 10 months (spec §3).

import { PLAN_LIMITS, type Plan } from '@/lib/plans'

export type Interval = 'month' | 'year'

export const TRIAL_DAYS = 3
export const PAID_PLANS = ['pro', 'clinic', 'plus'] as const satisfies readonly Plan[]
export type PaidPlan = (typeof PAID_PLANS)[number]
export const isPaidPlan = (p: unknown): p is PaidPlan => (PAID_PLANS as readonly unknown[]).includes(p)

/** Total charged per cycle. Clínica privada is per doctor. */
export function priceFor(plan: PaidPlan, interval: Interval, quantity = 1): number {
  const monthly = PLAN_LIMITS[plan].priceUsd * (PLAN_LIMITS[plan].perDoctor ? Math.max(1, quantity) : 1)
  return interval === 'year' ? monthly * 10 : monthly
}

/** "US$250/año", "US$150/médico/año", "US$25/mes". */
export function intervalPriceLabel(plan: PaidPlan, interval: Interval): string {
  const unit = interval === 'year' ? 'año' : 'mes'
  return PLAN_LIMITS[plan].perDoctor ? `US$${priceFor(plan, interval)}/médico/${unit}` : `US$${priceFor(plan, interval)}/${unit}`
}
