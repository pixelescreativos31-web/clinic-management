// The tenant wall lives here and nowhere else.
//
// Access functions return either a boolean or a Payload `where` constraint that
// Payload merges into every query. Everything is deny-by-default: any path that
// cannot positively determine a tenant returns `false`. The client can never
// influence scoping — tenant is always derived from the logged-in user.

import type { Access, FieldAccess, Where } from 'payload'
import type { User } from '@/payload-types'

/** Extract the tenant id from a user whose `tenant` may be an id or a populated doc. */
export function getTenantID(user?: User | null): string | null {
  if (!user) return null
  const t = user.tenant as unknown
  if (!t) return null
  if (typeof t === 'string') return t
  if (typeof t === 'object' && 'id' in (t as Record<string, unknown>)) {
    return String((t as { id: string | number }).id)
  }
  return String(t)
}

export const isSuperAdmin = (user?: User | null): boolean => user?.role === 'superAdmin'

/** Collection access: true for superAdmin, otherwise tenant-scoped query, deny if unknown. */
export const tenantScoped: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  const tenantID = getTenantID(user)
  if (!tenantID) return false // malformed user ⇒ deny, never default-allow
  return { tenant: { equals: tenantID } }
}

/** superAdmin only. */
export const superAdminOnly: Access = ({ req: { user } }) => isSuperAdmin(user)

/**
 * Visits write (create/update): tenant-scoped, but only clinical roles — a
 * receptionist never authors a clinical record (v2 spec §2.1). Read stays
 * tenant-wide (`tenantScoped`) so reception can print.
 */
export const visitsWriteAccess: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  const tenantID = getTenantID(user)
  if (!tenantID) return false
  if (user.role === 'doctor' || user.role === 'owner') return { tenant: { equals: tenantID } }
  return false
}

/**
 * Tenants collection read: superAdmin sees all; a tenant user may read only their
 * own tenant doc (for clinic name / settings in the UI).
 */
export const tenantSelfRead: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  const tenantID = getTenantID(user)
  if (!tenantID) return false
  return { id: { equals: tenantID } }
}

/**
 * Users read: superAdmin sees all; tenant users see staff within their own tenant.
 */
export const usersReadAccess: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  const tenantID = getTenantID(user)
  if (!tenantID) return false
  return { tenant: { equals: tenantID } }
}

/**
 * Users create: superAdmin anywhere; owner within their own tenant. (Role/tenant
 * restrictions are enforced in the hook — see collections/Users.ts.)
 */
export const usersCreateAccess: Access = ({ req: { user } }) => {
  if (!user) return false
  return isSuperAdmin(user) || user.role === 'owner'
}

/**
 * Users update: superAdmin anywhere; owner within their own tenant; everyone may
 * update their own record (field-level access narrows what self can change).
 */
export const usersUpdateAccess: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  const tenantID = getTenantID(user)
  if (!tenantID) return false
  if (user.role === 'owner') return { tenant: { equals: tenantID } } as Where
  return { id: { equals: user.id } } as Where // self only
}

/**
 * Audit logs read: superAdmin sees all; owner sees only their own clinic's log.
 * Doctors and receptionists never see the audit trail (spec §2.2).
 */
export const auditReadAccess: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  if (user.role !== 'owner') return false
  const tenantID = getTenantID(user)
  if (!tenantID) return false
  return { tenant: { equals: tenantID } }
}

/** Field-level: only superAdmin or owner may write this field (e.g. role, active). */
export const superAdminOrOwnerField: FieldAccess = ({ req: { user } }) =>
  isSuperAdmin(user) || user?.role === 'owner'

/**
 * Field-level read for the clinical narrative (history, exam, private notes):
 * clinical roles only. Receptionists/assistants can still read the visit itself
 * (date, diagnosis, prescription) so they can print and bill.
 */
export const clinicalReadField: FieldAccess = ({ req: { user } }) =>
  isSuperAdmin(user) || user?.role === 'doctor' || user?.role === 'owner'

/** Field-level: only superAdmin. */
export const superAdminField: FieldAccess = ({ req: { user } }) => isSuperAdmin(user)

/** Deny for everyone (used for delete policies). */
export const denyAll: Access = () => false
