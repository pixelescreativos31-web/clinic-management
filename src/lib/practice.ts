// Practitioner model. In Matab only `doctor` users saw patients; for an
// independent practice the account owner IS the doctor. Rather than a new role,
// an owner can be flagged `practitioner` — they keep owner powers (settings,
// billing, staff) and also appear wherever a doctor is expected (agenda, visits,
// prescriptions, plan limits). Clinics with several doctors keep working as before.
//
// Therapists (masajistas, cosmetólogas) are bookable too — agenda, public booking,
// their own session sheets — but they are not doctors: they never count toward the
// plan's doctor cap and never read the medical history (see isClinical).
//
// Pure module (types only from payload) so client components can import it.

import type { Where } from 'payload'

type UserLike = { role?: string | null; practitioner?: boolean | null } | null | undefined
type TenantLike = { practiceType?: string | null } | null | undefined

/** Does this user see patients (bookable, appears in the agenda)? */
export function isPractitioner(user: UserLike): boolean {
  if (!user) return false
  return user.role === 'doctor' || user.role === 'therapist' || (user.role === 'owner' && user.practitioner === true)
}

/** A doctor (or practising owner) — what the plan's doctor cap counts. */
export function isDoctor(user: UserLike): boolean {
  return isPractitioner(user) && user?.role !== 'therapist'
}

export function isTherapist(user: UserLike): boolean {
  return user?.role === 'therapist'
}

/** May this user read and write the medical record (history, exam, prescriptions)? */
export function isClinical(user: UserLike): boolean {
  return user?.role === 'doctor' || user?.role === 'owner'
}

/** May this user record sessions/consultations at all (clinical roles + therapists)? */
export function canRecordVisits(user: UserLike): boolean {
  return isClinical(user) || isTherapist(user)
}

/**
 * May this user START a new consultation/session? Only someone who sees patients:
 * an owner who doesn't practise is an administrator (not counted as a doctor by the
 * plan), so they may read and correct records but not open new ones. Mirrors the
 * Visits create guard.
 */
export function canStartVisits(user: UserLike): boolean {
  if (user?.role === 'owner') return user.practitioner === true
  return canRecordVisits(user)
}

const PRACTISING_OWNER: Where = { and: [{ role: { equals: 'owner' } }, { practitioner: { equals: true } }] }

/** Payload `where` selecting a tenant's bookable staff (doctors, therapists, practising owner). */
export function practitionerWhere(tenantID: string): Where {
  return {
    and: [{ tenant: { equals: tenantID } }, { or: [{ role: { in: ['doctor', 'therapist'] } }, PRACTISING_OWNER] }],
  }
}

/** Payload `where` selecting a tenant's doctors only — the plan's doctor cap. */
export function doctorWhere(tenantID: string): Where {
  return {
    and: [{ tenant: { equals: tenantID } }, { or: [{ role: { equals: 'doctor' } }, PRACTISING_OWNER] }],
  }
}

/** Independent practice (one doctor) — the MVP default; hides multi-doctor tooling. */
export function isIndividualPractice(tenant: TenantLike): boolean {
  return (tenant?.practiceType ?? 'individual') === 'individual'
}
