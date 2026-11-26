'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { toActionError, type ActionResult } from '@/lib/errors'
import { isPlan } from '@/lib/plans'
import { GatewayError } from '@/lib/billing/gateway'
import {
  cancelSubscription,
  startCheckout,
  startPackCheckout,
  syncSubscription,
  type SyncOutcome,
} from '@/lib/billing/service'

/**
 * Owner asks for a plan change (v3 spec §5). No billing — this just stamps
 * `upgradeRequest` on the tenant; a super admin approves or declines it from
 * /super. The audit entry is written by the auditTenants hook.
 */
export async function requestUpgrade(
  requestedPlan: string,
  note?: string,
): Promise<ActionResult<null>> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'owner') {
    return { ok: false, code: 'FORBIDDEN', message: 'No tiene permiso para realizar esta acción.' }
  }
  const tenantID = getTenantID(user)
  if (!tenantID) {
    return { ok: false, code: 'FORBIDDEN', message: 'Su usuario no está vinculado a ningún consultorio.' }
  }
  if (!isPlan(requestedPlan)) {
    return { ok: false, code: 'VALIDATION', message: 'Seleccione un plan válido.' }
  }

  try {
    const payload = await getPayloadClient()
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantID,
      depth: 0,
      overrideAccess: true,
    })
    if (tenant.plan === requestedPlan) {
      return { ok: false, code: 'VALIDATION', message: 'Ya tiene ese plan.' }
    }
    if (tenant.upgradeRequest?.requestedPlan) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: 'Ya tiene una solicitud pendiente. Nuestro equipo se comunicará con usted.',
      }
    }

    await payload.update({
      collection: 'tenants',
      id: tenantID,
      user,
      overrideAccess: false,
      data: {
        upgradeRequest: {
          requestedPlan,
          requestedAt: new Date().toISOString(),
          note: note?.trim() || null,
        },
      } as never,
    })
    revalidatePath('/dashboard/plan')
    return { ok: true, data: null }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}

// ---------------------------------------------------------------- Fase 3: PayPal


async function ownerTenant(): Promise<{ tenantID: string; email: string } | { error: ActionResult<never> }> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'owner') {
    return { error: { ok: false, code: 'FORBIDDEN', message: 'Solo el Titular de la clínica puede cambiar el plan.' } }
  }
  const tenantID = getTenantID(user)
  if (!tenantID) return { error: { ok: false, code: 'FORBIDDEN', message: 'Su usuario no está vinculado a ningún consultorio.' } }
  return { tenantID: String(tenantID), email: user.email }
}

const gatewayFailure = (err: unknown): ActionResult<never> =>
  err instanceof GatewayError
    ? { ok: false, code: 'BILLING', message: err.message }
    : { ok: false, code: 'BILLING', message: 'PayPal no responde. Intente en unos minutos; no se cobró nada.' }

/** Start a PayPal subscription; the client sends the browser to the returned link. */
export async function startSubscription(plan: string, interval: string): Promise<ActionResult<{ url: string }>> {
  const who = await ownerTenant()
  if ('error' in who) return who.error
  if (interval !== 'month' && interval !== 'year') return { ok: false, code: 'VALIDATION', message: 'Elija mensual o anual.' }
  try {
    const payload = await getPayloadClient()
    const { approveUrl } = await startCheckout(payload, { tenantID: who.tenantID, plan, interval, userEmail: who.email })
    return { ok: true, data: { url: approveUrl } }
  } catch (err) {
    return gatewayFailure(err)
  }
}

/** Polled by the return page every 3 s. */
export async function checkSubscription(subscriptionId: string): Promise<ActionResult<{ outcome: SyncOutcome }>> {
  const who = await ownerTenant()
  if ('error' in who) return who.error
  try {
    const payload = await getPayloadClient()
    const tenant = await payload.findByID({ collection: 'tenants', id: who.tenantID, depth: 0, overrideAccess: true })
    const b = tenant.billing
    if (b?.pendingSubscriptionId !== subscriptionId && b?.subscriptionId !== subscriptionId) {
      return { ok: false, code: 'VALIDATION', message: 'Esta suscripción no corresponde a su consultorio.' }
    }
    const outcome = await syncSubscription(payload, subscriptionId)
    if (outcome !== 'pending') revalidatePath('/dashboard', 'layout')
    return { ok: true, data: { outcome } }
  } catch (err) {
    return gatewayFailure(err)
  }
}

export async function cancelMySubscription(reason: string): Promise<ActionResult<{ message: string }>> {
  const who = await ownerTenant()
  if ('error' in who) return who.error
  try {
    const payload = await getPayloadClient()
    const res = await cancelSubscription(payload, who.tenantID, reason.trim().slice(0, 300))
    revalidatePath('/dashboard', 'layout')
    return { ok: true, data: res }
  } catch (err) {
    return gatewayFailure(err)
  }
}

export async function buyPack(resource: string): Promise<ActionResult<{ url: string }>> {
  const who = await ownerTenant()
  if ('error' in who) return who.error
  try {
    const payload = await getPayloadClient()
    const { approveUrl } = await startPackCheckout(payload, who.tenantID, resource)
    return { ok: true, data: { url: approveUrl } }
  } catch (err) {
    return gatewayFailure(err)
  }
}
