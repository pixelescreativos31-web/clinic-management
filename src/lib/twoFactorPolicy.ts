// Who must use two-step verification, and since when (spec §10).
//
// - Titular: always required.
// - Médico: required in Clínica privada and Hospital.
// - Everyone in the clinic: required when the Titular turns on «Exigir 2FA a todo el equipo».
// - Super admin: out of scope here (the spec asks for a hardware key; separate phase).
//
// Existing clinics are never locked out overnight: each clinic carries a grace
// date (settings.security.twoFactorGraceUntil). Before it, a required user who has
// not enrolled sees a reminder and keeps working; after it, the dashboard shows
// only the enrollment screen until they enrol. Clinics that sign up after this
// change get a grace date equal to their signup time, so they enrol on first login.
//
// Pure (no Payload imports): the layout, the security page and tests share it.

export const TWO_FACTOR_GRACE_DAYS = 14

type UserLike = {
  role?: string | null
  twoFactorEnabled?: boolean | null
}

type TenantLike = {
  plan?: string | null
  settings?: {
    security?: {
      require2faAll?: boolean | null
      twoFactorGraceUntil?: string | Date | null
    } | null
  } | null
} | null

const DOCTOR_REQUIRED_PLANS = new Set(['plus', 'public'])

/** Why this user must use 2FA, or null when it is optional for them. */
export function twoFactorRequirement(user: UserLike, tenant: TenantLike): 'owner' | 'plan' | 'clinic' | null {
  const role = user.role ?? ''
  if (role === 'superAdmin' || !role) return null
  if (role === 'owner') return 'owner'
  if (role === 'doctor' && DOCTOR_REQUIRED_PLANS.has(String(tenant?.plan ?? ''))) return 'plan'
  if (tenant?.settings?.security?.require2faAll === true) return 'clinic'
  return null
}

export type TwoFactorGate =
  /** Enrolled, or not required: nothing to show. */
  | { kind: 'ok' }
  /** Required but not enrolled; still inside the clinic's grace period. */
  | { kind: 'grace'; until: Date; daysLeft: number }
  /** Required, not enrolled, grace over: only the enrollment screen. */
  | { kind: 'enroll' }

/**
 * `graceUntil` missing means the clinic predates 2FA and nobody has started its
 * grace yet: the caller stores now + 14 days and calls again (see
 * ensureTwoFactorGrace in twoFactorServer.ts).
 */
export function twoFactorGate(user: UserLike, tenant: TenantLike, now: Date = new Date()): TwoFactorGate {
  if (user.twoFactorEnabled === true) return { kind: 'ok' }
  if (!twoFactorRequirement(user, tenant)) return { kind: 'ok' }
  const raw = tenant?.settings?.security?.twoFactorGraceUntil
  const until = raw ? new Date(raw) : null
  if (until && !Number.isNaN(until.getTime()) && until.getTime() > now.getTime()) {
    const daysLeft = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    return { kind: 'grace', until, daysLeft }
  }
  if (!until) {
    // Not started yet: treat as a fresh grace period (the caller persists it).
    return { kind: 'grace', until: graceFrom(now), daysLeft: TWO_FACTOR_GRACE_DAYS }
  }
  return { kind: 'enroll' }
}

export const graceFrom = (now: Date): Date => new Date(now.getTime() + TWO_FACTOR_GRACE_DAYS * 24 * 60 * 60 * 1000)

/** May this user turn 2FA off? Not when it is required for them. */
export const canDisableTwoFactor = (user: UserLike, tenant: TenantLike): boolean => !twoFactorRequirement(user, tenant)

export const REQUIREMENT_TEXT: Record<'owner' | 'plan' | 'clinic', string> = {
  owner: 'Es obligatoria para el Titular de la clínica.',
  plan: 'Es obligatoria para los médicos en su plan.',
  clinic: 'El Titular de la clínica la exige a todo el equipo.',
}
