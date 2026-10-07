// Practitioner model. In Matab only `doctor` users saw patients; for an
// independent practice the account owner IS the doctor. Rather than a new role,
// an owner can be flagged `practitioner` — they keep owner powers (settings,
// billing, staff) and also appear wherever a doctor is expected (agenda, visits,
// prescriptions, plan limits). Clinics with several doctors keep working as before.
//
// Pure module (types only from payload) so client components can import it.

import type { Where } from 'payload'

type UserLike = { role?: string | null; practitioner?: boolean | null } | null | undefined
type TenantLike = { practiceType?: string | null } | null | undefined

/** Does this user see patients (bookable, can author visits/prescriptions)? */
export function isPractitioner(user: UserLike): boolean {
  if (!user) return false
  return user.role === 'doctor' || (user.role === 'owner' && user.practitioner === true)
}

/** May this user write clinical records (visits)? Owners always could in Matab. */
export function isClinical(user: UserLike): boolean {
  return user?.role === 'doctor' || user?.role === 'owner'
}

/** Payload `where` selecting a tenant's practitioners (doctors + practising owner). */
export function practitionerWhere(tenantID: string): Where {
  return {
    and: [
      { tenant: { equals: tenantID } },
      {
        or: [
          { role: { equals: 'doctor' } },
          { and: [{ role: { equals: 'owner' } }, { practitioner: { equals: true } }] },
        ],
      },
    ],
  }
}

/** Independent practice (one doctor) — the MVP default; hides multi-doctor tooling. */
export function isIndividualPractice(tenant: TenantLike): boolean {
  return (tenant?.practiceType ?? 'individual') === 'individual'
}
