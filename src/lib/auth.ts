import 'server-only'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { Tenant, User } from '@/payload-types'
import { getTenantID } from '@/access'

export async function getPayloadClient() {
  return getPayload({ config: await config })
}

export async function getCurrentUser(): Promise<User | null> {
  // Read the request headers first: it marks the route dynamic, so `next build`
  // never tries to prerender it (and boot Payload without a secret/DB).
  const headers = await nextHeaders()
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers })
  return (user as User) ?? null
}

export type Session = {
  user: User
  tenant: Tenant | null
}

/**
 * Loads the logged-in tenant user and their clinic. Redirects to /login when not
 * authenticated. SuperAdmins belong in /super, not the tenant dashboard.
 */
export async function requireDashboardSession(): Promise<Session> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role === 'superAdmin') redirect('/super')

  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)
  let tenant: Tenant | null = null
  if (tenantID) {
    tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantID,
      depth: 0,
      overrideAccess: true,
    })
  }
  return { user, tenant }
}

/** Require one of the given roles, else redirect to the dashboard home. */
export async function requireRole(session: Session, roles: User['role'][]) {
  if (!roles.includes(session.user.role)) redirect('/dashboard')
}

export async function requireSuperAdmin(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'superAdmin') redirect('/dashboard')
  return user
}
