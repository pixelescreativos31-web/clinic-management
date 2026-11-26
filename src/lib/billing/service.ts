// Subscriptions and pack purchases with PayPal (spec §3, plan Fase 3).
//
// Source of truth: PayPal. Every subscription webhook makes us re-read the
// subscription from PayPal (`syncSubscription`), so a late or repeated event can
// never undo a newer state. Money events (sale completed / failed / refunded)
// carry their own time and are compared with `billing.lastEventAt`.
//
// Safety for existing clinics: a clinic with no `billing.subscriptionId` (every
// clinic created before this phase, and any plan set by the super admin) is
// "manual": no trial, no dunning, no downgrade, no suspension — nothing here
// touches it.
//
// All tenant/user writes go through the native mongoose models with
// conditional filters, so concurrent webhook + return page + daily job runs
// apply each transition once and never run collection hooks on clinic data.

import type { Payload, Where } from 'payload'
import { appBaseUrl, sendEmail } from '@/lib/email'
import { PLAN_LIMITS, QUOTA_PACKS, asPlan, isPackResource, meteredUnit, planLabel, type PackResource, type Plan } from '@/lib/plans'
import { doctorWhere } from '@/lib/practice'
import { isPaidPlan, priceFor } from './prices'
import { dateTimeLabel, endSentence, regionalOf } from '@/lib/regional'
import {
  GatewayError,
  getGateway,
  hashValue,
  maskEmail,
  parsePlanKey,
  planKey,
  type GatewaySubscription,
  type Interval,
  type WebhookEvent,
} from './gateway'

/** Days after the failed charge: 0 amber, 3 red, 7 "quedan 3 días", 9 "mañana", 10 downgrade. */
export const DUNNING_DAYS = [0, 3, 7, 9, 10] as const
export const DOWNGRADE_DAY = 10
/** "Recupere su plan en un clic" reminders, counted from the failed charge (spec: days 17 and 40). */
export const WINBACK_DAYS = [17, 40] as const
export { TRIAL_DAYS, PAID_PLANS, isPaidPlan, priceFor, type PaidPlan } from './prices'

const DAY = 86_400_000

export type BillingStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'cancelled'

export type TenantBilling = {
  subscriptionId?: string | null
  pendingSubscriptionId?: string | null
  pendingSince?: Date | string | null
  status?: BillingStatus | null
  billingPlan?: string | null
  interval?: Interval | null
  quantity?: number | null
  trialUsed?: boolean | null
  trialEndsAt?: Date | string | null
  trialEndingNotifiedAt?: Date | string | null
  currentPeriodEnd?: Date | string | null
  pastDueSince?: Date | string | null
  dunningStage?: number | null
  downgradedAt?: Date | string | null
  downgradeReason?: 'unpaid' | 'cancelled' | null
  downgradedFromPlan?: string | null
  winbackStage?: number | null
  payerEmailMasked?: string | null
  cancelReason?: string | null
  lastEventAt?: Date | string | null
}

type TenantDoc = {
  _id: unknown
  name?: string
  plan?: string
  phone?: string
  taxId?: string
  settings?: { timezone?: string | null } | null
  billing?: TenantBilling | null
}

type Model = {
  findOne: (f: Record<string, unknown>) => { lean: () => Promise<TenantDoc | null> }
  find: (f: Record<string, unknown>) => { limit: (n: number) => { lean: () => Promise<TenantDoc[]> } }
  updateOne: (f: Record<string, unknown>, u: Record<string, unknown>) => Promise<{ modifiedCount?: number }>
  updateMany: (f: Record<string, unknown>, u: Record<string, unknown>) => Promise<{ modifiedCount?: number }>
}

function model(payload: Payload, slug: string): Model {
  const m = (payload.db as unknown as { collections?: Record<string, Model> }).collections?.[slug]
  if (!m) throw new Error(`${slug} model unavailable (is the mongoose adapter in use?)`)
  return m
}

const tenants = (p: Payload) => model(p, 'tenants')
const users = (p: Payload) => model(p, 'users')

async function loadTenant(payload: Payload, tenantID: string): Promise<TenantDoc | null> {
  return tenants(payload).findOne({ _id: tenantID }).lean()
}

const asDate = (v: Date | string | null | undefined): Date | null => (v ? new Date(v) : null)

/** Set billing.* fields (dotted) with an optional extra condition; true when applied. */
async function setBilling(
  payload: Payload,
  tenantID: string,
  patch: Partial<Record<keyof TenantBilling, unknown>>,
  opts: { where?: Record<string, unknown>; plan?: Plan; unset?: (keyof TenantBilling)[] } = {},
): Promise<boolean> {
  const $set: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) $set[`billing.${k}`] = v
  if (opts.plan) $set.plan = opts.plan
  const update: Record<string, unknown> = { $set }
  if (opts.unset?.length) update.$unset = Object.fromEntries(opts.unset.map((k) => [`billing.${k}`, '']))
  const res = await tenants(payload).updateOne({ _id: tenantID, ...(opts.where ?? {}) }, update)
  return (res.modifiedCount ?? 0) > 0
}

// ---------------------------------------------------------------- people & mail

async function owners(payload: Payload, tenantID: string) {
  const res = await payload.find({
    collection: 'users',
    where: { and: [{ tenant: { equals: tenantID } }, { role: { equals: 'owner' } }] },
    depth: 0,
    limit: 5,
    overrideAccess: true,
  })
  return res.docs
}

async function mailOwners(payload: Payload, tenantID: string, subject: string, paragraphs: string[], cta?: { label: string; href: string }) {
  const html =
    paragraphs.map((p) => `<p>${p}</p>`).join('') +
    (cta ? `<p><a href="${appBaseUrl()}${cta.href}">${cta.label}</a></p>` : '') +
    '<p>Sus expedientes y datos nunca se borran.</p>'
  for (const o of await owners(payload, tenantID)) {
    if (o.email) await sendEmail({ to: o.email, subject, html }).catch(() => null)
  }
}

/** System audit rows are attributed to the Titular (the account holder), meta.actor = 'paypal' | 'sistema'. */
async function audit(payload: Payload, tenantID: string, action: string, summary: string, meta: Record<string, unknown> = {}) {
  try {
    const owner = (await owners(payload, tenantID))[0]
    if (!owner) return
    await payload.create({
      collection: 'auditLogs',
      overrideAccess: true,
      data: { tenant: tenantID, user: owner.id, action, targetCollection: 'tenants', targetId: tenantID, summary, meta } as never,
    })
  } catch (err) {
    payload.logger?.error?.({ err, action }, 'billing audit failed (non-fatal)')
  }
}

export const formatDate = (d: Date | string, timeZone = 'America/Santo_Domingo') =>
  new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(new Date(d))

/** Date and time in the clinic's zone and clock format (12 h by default). */
const formatWhen = (d: Date | string, tenant: TenantDoc) =>
  dateTimeLabel(d, tenant.settings?.timezone || 'America/Santo_Domingo', regionalOf(tenant as never).timeFormat)

// ---------------------------------------------------------------- trial uniqueness

type ClaimKind = 'email' | 'phone' | 'taxId' | 'payer'

async function trialClaimsFor(payload: Payload, values: { kind: ClaimKind; value?: string | null }[]) {
  const ors = values.filter((v) => v.value && v.value.trim()).map((v): Where => ({ and: [{ kind: { equals: v.kind } }, { valueHash: { equals: hashValue(v.value!) } }] as Where[] }))
  if (!ors.length) return []
  const res = await payload.find({ collection: 'trialClaims', where: { or: ors }, depth: 0, limit: 10, overrideAccess: true })
  return res.docs
}

async function trialIdentity(payload: Payload, tenant: TenantDoc) {
  const owner = (await owners(payload, String(tenant._id)))[0]
  return [
    { kind: 'email' as const, value: owner?.email },
    { kind: 'phone' as const, value: (owner as { phone?: string } | undefined)?.phone || tenant.phone },
    { kind: 'taxId' as const, value: tenant.taxId },
  ]
}

/** One trial per clinic, owner email, owner phone and RNC (the PayPal account is checked on approval). */
export async function trialEligible(payload: Payload, tenantID: string): Promise<boolean> {
  const tenant = await loadTenant(payload, tenantID)
  if (!tenant || tenant.billing?.trialUsed) return false
  const claims = await trialClaimsFor(payload, await trialIdentity(payload, tenant))
  return !claims.some((c) => String(typeof c.tenant === 'object' ? c.tenant.id : c.tenant) !== tenantID)
}

async function recordTrialClaims(payload: Payload, tenant: TenantDoc, payerEmail: string | null) {
  const values = [...(await trialIdentity(payload, tenant)), { kind: 'payer' as const, value: payerEmail }]
  for (const v of values) {
    if (!v.value || !v.value.trim()) continue
    await payload
      .create({ collection: 'trialClaims', overrideAccess: true, data: { kind: v.kind, valueHash: hashValue(v.value), tenant: String(tenant._id) } })
      .catch(() => null) // unique (kind, valueHash): already claimed
  }
}

// ---------------------------------------------------------------- checkout

export type CheckoutResult = { approveUrl: string; trial: boolean }

/**
 * Start (or change) a subscription. Returns PayPal's approval link. The current
 * plan stays as it is until PayPal confirms; nothing is charged on our side.
 */
export async function startCheckout(
  payload: Payload,
  input: { tenantID: string; plan: string; interval: Interval; userEmail?: string },
): Promise<CheckoutResult> {
  const gateway = getGateway()
  if (!gateway) throw new GatewayError('El pago en línea todavía no está disponible. Escríbanos y le ayudamos.', 'rejected')
  if (!isPaidPlan(input.plan)) throw new GatewayError('Ese plan no se contrata en línea.', 'rejected')
  const tenant = await loadTenant(payload, input.tenantID)
  if (!tenant) throw new GatewayError('Consultorio no encontrado.', 'rejected')

  const trial = await trialEligible(payload, input.tenantID)
  let quantity = 1
  if (PLAN_LIMITS[input.plan].perDoctor) {
    const doctors = await payload.count({
      collection: 'users',
      where: { and: [doctorWhere(input.tenantID), { active: { not_equals: false } }] },
      overrideAccess: true,
    })
    quantity = Math.max(1, doctors.totalDocs)
  }
  const base = appBaseUrl()
  const { id, approveUrl } = await gateway.createSubscription({
    planKey: planKey(input.plan, input.interval, trial),
    customId: input.tenantID,
    returnUrl: `${base}/dashboard/plan/regreso`,
    cancelUrl: `${base}/dashboard/plan/cancelado`,
    payerEmail: input.userEmail,
    quantity,
  })
  await setBilling(payload, input.tenantID, { pendingSubscriptionId: id, pendingSince: new Date(), quantity })
  return { approveUrl, trial }
}

export type SyncOutcome = 'pending' | 'active' | 'trialing' | 'past_due' | 'cancelled' | 'trial_denied' | 'ignored'

/**
 * Re-read a subscription from PayPal and apply its state. Safe to call any
 * number of times (return page polling, webhooks, daily job).
 */
export async function syncSubscription(payload: Payload, subscriptionId: string, now = new Date()): Promise<SyncOutcome> {
  const gateway = getGateway()
  if (!gateway) return 'ignored'
  const sub = await gateway.getSubscription(subscriptionId)
  const tenantID = sub.customId
  if (!tenantID) return 'ignored'
  const tenant = await loadTenant(payload, tenantID).catch(() => null)
  if (!tenant) return 'ignored'
  const b = tenant.billing ?? {}
  const isCurrent = b.subscriptionId === sub.id
  const isPending = b.pendingSubscriptionId === sub.id
  if (!isCurrent && !isPending) return 'ignored' // an old subscription we already replaced

  if (sub.status === 'pending') return 'pending'

  if (sub.status === 'active' && isPending) return activate(payload, tenant, sub, now)

  if (!isCurrent) {
    // A pending subscription that was cancelled / expired before approval.
    await setBilling(payload, tenantID, {}, { where: { 'billing.pendingSubscriptionId': sub.id }, unset: ['pendingSubscriptionId', 'pendingSince'] })
    return 'cancelled'
  }

  if (sub.status === 'active') {
    const inTrial = sub.inTrial
    await setBilling(payload, tenantID, {
      currentPeriodEnd: asDate(sub.nextBillingTime),
      ...(b.status === 'trialing' && !inTrial ? { status: 'active' } : {}),
    })
    return b.status === 'past_due' ? 'past_due' : inTrial ? 'trialing' : 'active'
  }
  if (sub.status === 'suspended') {
    await markPastDue(payload, tenantID, now)
    return 'past_due'
  }
  // cancelled / expired: the plan lasts until the paid period (or trial) ends; the
  // daily job moves the clinic to Gratis then. A clinic already past due keeps its
  // dunning calendar.
  if (b.status !== 'past_due' && b.status !== 'cancelled') {
    await setBilling(payload, tenantID, { status: 'cancelled' })
    await audit(payload, tenantID, 'billing.cancelled', 'Suscripción cancelada en PayPal', { actor: 'paypal' })
  }
  return 'cancelled'
}

async function activate(payload: Payload, tenant: TenantDoc, sub: GatewaySubscription, now: Date): Promise<SyncOutcome> {
  const tenantID = String(tenant._id)
  const parsed = parsePlanKey(sub.planKey)
  if (!parsed || !isPaidPlan(parsed.plan)) return 'ignored'
  const gateway = getGateway()!

  // One trial per PayPal account as well.
  if (parsed.trial && sub.payerEmail) {
    const claims = await trialClaimsFor(payload, [{ kind: 'payer', value: sub.payerEmail }])
    if (claims.some((c) => String(typeof c.tenant === 'object' ? c.tenant.id : c.tenant) !== tenantID)) {
      await gateway.cancelSubscription(sub.id, 'Esta cuenta de PayPal ya usó su prueba').catch(() => null)
      await setBilling(payload, tenantID, { trialUsed: true }, { where: { 'billing.pendingSubscriptionId': sub.id }, unset: ['pendingSubscriptionId', 'pendingSince'] })
      return 'trial_denied'
    }
  }

  const previous = tenant.billing?.subscriptionId
  const trialEndsAt = parsed.trial && sub.inTrial ? asDate(sub.nextBillingTime) : null
  const applied = await setBilling(
    payload,
    tenantID,
    {
      subscriptionId: sub.id,
      status: trialEndsAt ? 'trialing' : 'active',
      billingPlan: parsed.plan,
      interval: parsed.interval,
      currentPeriodEnd: asDate(sub.nextBillingTime),
      trialEndsAt,
      payerEmailMasked: maskEmail(sub.payerEmail),
      dunningStage: 0,
      winbackStage: 0,
      ...(parsed.trial ? { trialUsed: true } : {}),
    },
    {
      plan: parsed.plan,
      where: { 'billing.pendingSubscriptionId': sub.id },
      unset: ['pendingSubscriptionId', 'pendingSince', 'pastDueSince', 'downgradedAt', 'downgradeReason', 'downgradedFromPlan', 'cancelReason', 'trialEndingNotifiedAt'],
    },
  )
  if (!applied) return trialEndsAt ? 'trialing' : 'active' // another caller got here first

  if (parsed.trial) await recordTrialClaims(payload, tenant, sub.payerEmail)
  // Plan change: the old subscription stops so the clinic is never charged twice.
  if (previous && previous !== sub.id) await gateway.cancelSubscription(previous, 'Cambio de plan').catch(() => null)
  await unsuspendUsers(payload, tenantID)
  await audit(payload, tenantID, 'billing.subscribed', `Plan ${planLabel(parsed.plan)} (${parsed.interval === 'year' ? 'anual' : 'mensual'})${trialEndsAt ? ', en prueba' : ''}`, {
    actor: 'paypal',
    subscriptionId: sub.id,
  })
  const tz = tenant.settings?.timezone ?? undefined
  await mailOwners(
    payload,
    tenantID,
    trialEndsAt ? `Su prueba del plan ${planLabel(parsed.plan)} empezó` : `Su plan ${planLabel(parsed.plan)} está activo`,
    trialEndsAt
      ? [`${endSentence(`Su prueba gratis dura hasta el ${formatWhen(trialEndsAt, tenant)}`)} No se le cobrará nada antes; le avisaremos un día antes del primer cobro.`]
      : [`Gracias. Su plan ${planLabel(parsed.plan)} ya está activo.`],
    { label: 'Ver mi plan', href: '/dashboard/plan' },
  )
  return trialEndsAt ? 'trialing' : 'active'
}

/** Owner cancels. During the trial nothing is charged; otherwise the plan lasts until the paid period ends. */
export async function cancelSubscription(payload: Payload, tenantID: string, reason: string): Promise<{ message: string }> {
  const gateway = getGateway()
  const tenant = await loadTenant(payload, tenantID)
  const b = tenant?.billing ?? {}
  if (!gateway || !tenant || !b.subscriptionId) throw new GatewayError('No hay una suscripción para cancelar.', 'rejected')
  await gateway.cancelSubscription(b.subscriptionId, reason || 'Cancelada por el titular')
  const wasTrial = b.status === 'trialing'
  if (b.status !== 'past_due') await setBilling(payload, tenantID, { status: 'cancelled', cancelReason: reason || null })
  await audit(payload, tenantID, 'billing.cancelled', wasTrial ? 'Prueba cancelada por el titular' : 'Suscripción cancelada por el titular', { actor: 'titular', reason })
  const tz = tenant.settings?.timezone ?? undefined
  const message = wasTrial && b.trialEndsAt
    ? `${endSentence(`Su prueba sigue activa hasta el ${formatWhen(b.trialEndsAt, tenant)}`)} No se le cobrará nada. Después su cuenta pasará a Gratis.`
    : b.currentPeriodEnd
      ? `Su plan termina el ${formatDate(b.currentPeriodEnd, tz)}. Después su cuenta pasará a Gratis; sus datos se conservan.`
      : 'Su suscripción quedó cancelada.'
  return { message }
}

// ---------------------------------------------------------------- dunning & downgrade

async function markPastDue(payload: Payload, tenantID: string, at: Date) {
  const claimed = await setBilling(payload, tenantID, { status: 'past_due', pastDueSince: at, dunningStage: 1 }, { where: { 'billing.status': { $ne: 'past_due' } } })
  if (!claimed) return
  await audit(payload, tenantID, 'billing.payment-failed', 'PayPal no pudo cobrar el plan', { actor: 'paypal' })
  await mailOwners(payload, tenantID, 'No pudimos cobrar su plan de medira', [
    'PayPal no pudo cobrar su plan. Revise su método de pago en PayPal para seguir usando todas las funciones.',
  ], { label: 'Ver mi plan', href: '/dashboard/plan' })
}

async function clearPastDue(payload: Payload, tenantID: string) {
  const cleared = await setBilling(payload, tenantID, { status: 'active', dunningStage: 0 }, { where: { 'billing.status': 'past_due' }, unset: ['pastDueSince'] })
  if (cleared) await audit(payload, tenantID, 'billing.recovered', 'Cobro recuperado', { actor: 'paypal' })
}

const DUNNING_MAIL: Record<number, { subject: string; body: (d: string) => string }> = {
  3: { subject: 'Su pago de medira sigue pendiente', body: () => 'Todavía no hemos podido cobrar su plan. Actualice su método de pago en PayPal.' },
  7: { subject: 'Quedan 3 días para que su cuenta pase a Gratis', body: (d) => `Quedan 3 días. Si no se recibe el pago, el ${d} su cuenta pasará al plan Gratis. Sus datos se conservan.` },
  9: { subject: 'Mañana su cuenta pasa a Gratis', body: () => 'Mañana su cuenta pasa a Gratis si no se recibe el pago. Solo el Titular podrá entrar hasta que pague.' },
}

/** Move a clinic to Gratis. Only billing-managed clinics; staff are paused, nothing is deleted. */
export async function downgradeToFree(payload: Payload, tenantID: string, reason: 'unpaid' | 'cancelled', now = new Date()): Promise<boolean> {
  const tenant = await loadTenant(payload, tenantID)
  const b = tenant?.billing ?? {}
  if (!tenant || !b.subscriptionId || tenant.plan === 'free') return false
  const from = asPlan(tenant.plan)
  const done = await setBilling(
    payload,
    tenantID,
    { status: 'cancelled', downgradedAt: now, downgradeReason: reason, downgradedFromPlan: from, winbackStage: 0 },
    { plan: 'free', where: { plan: { $ne: 'free' }, 'billing.subscriptionId': b.subscriptionId } },
  )
  if (!done) return false
  if (reason === 'unpaid') await getGateway()?.cancelSubscription(b.subscriptionId, 'Impago').catch(() => null)
  await suspendUsers(payload, tenantID, now)
  await audit(payload, tenantID, 'billing.downgraded', `Pasó de ${planLabel(from)} a Gratis (${reason === 'unpaid' ? 'impago' : 'cancelación'})`, { actor: 'sistema', from, reason })
  await mailOwners(
    payload,
    tenantID,
    'Su cuenta pasó a Gratis',
    [
      `Su cuenta pasó del plan ${planLabel(from)} al plan Gratis. No se borró nada: sus pacientes, consultas y archivos siguen ahí.`,
      'Mientras tanto solo el Titular puede entrar. Al volver a un plan pagado, su equipo recupera el acceso al instante.',
    ],
    { label: 'Recuperar mi plan', href: '/dashboard/plan#planes' },
  )
  return true
}

async function suspendUsers(payload: Payload, tenantID: string, now: Date) {
  await users(payload).updateMany(
    { tenant: tenantID, role: { $nin: ['owner', 'superAdmin'] }, planSuspendedAt: null },
    // Clearing the sessions signs them out everywhere; login then explains why.
    { $set: { planSuspendedAt: now, sessions: [] } },
  )
}

async function unsuspendUsers(payload: Payload, tenantID: string) {
  await users(payload).updateMany({ tenant: tenantID, planSuspendedAt: { $ne: null } }, { $unset: { planSuspendedAt: '' } })
}

// ---------------------------------------------------------------- receipts & packs

async function nextReceiptNumber(payload: Payload, at: Date): Promise<string> {
  const conn = (payload.db as unknown as { connection: { collection: (n: string) => { findOneAndUpdate: (...a: unknown[]) => Promise<unknown> } } }).connection
  const year = at.getUTCFullYear()
  const res = (await conn
    .collection('billing_sequences')
    .findOneAndUpdate({ _id: `receipt-${year}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' })) as
    | { seq?: number; value?: { seq?: number } }
    | null
  const seq = res?.seq ?? res?.value?.seq ?? 1
  return `MED-${year}-${String(seq).padStart(6, '0')}`
}

async function createReceipt(
  payload: Payload,
  data: { tenantID: string; transactionId: string; kind: 'plan' | 'pack'; concept: string; totalUsd: number; paidAt: Date; payerEmail?: string | null; periodStart?: Date | null; periodEnd?: Date | null },
) {
  const existing = await payload.find({ collection: 'billingReceipts', where: { transactionId: { equals: data.transactionId } }, limit: 1, depth: 0, overrideAccess: true })
  if (existing.docs[0]) return existing.docs[0]
  return payload
    .create({
      collection: 'billingReceipts',
      overrideAccess: true,
      data: {
        number: await nextReceiptNumber(payload, data.paidAt),
        tenant: data.tenantID,
        paidAt: data.paidAt.toISOString(),
        kind: data.kind,
        concept: data.concept,
        totalUsd: data.totalUsd,
        status: 'paid',
        method: 'PayPal',
        payerEmailMasked: maskEmail(data.payerEmail ?? null),
        transactionId: data.transactionId,
        periodStart: data.periodStart?.toISOString(),
        periodEnd: data.periodEnd?.toISOString(),
      },
    })
    .catch(() => null) // unique transactionId: a concurrent delivery created it
}

const packCustomId = (tenantID: string, resource: PackResource) => `pack:${tenantID}:${resource}`
function parsePackCustomId(v: string | null | undefined): { tenantID: string; resource: PackResource } | null {
  const [kind, tenantID, resource] = (v ?? '').split(':')
  if (kind !== 'pack' || !tenantID || !isPackResource(resource)) return null
  return { tenantID, resource }
}

export async function startPackCheckout(payload: Payload, tenantID: string, resource: string): Promise<{ approveUrl: string }> {
  const gateway = getGateway()
  if (!gateway) throw new GatewayError('El pago en línea todavía no está disponible. Escríbanos y le ayudamos.', 'rejected')
  const offer = QUOTA_PACKS.find((p) => p.resource === resource)
  if (!offer) throw new GatewayError('Ese paquete no existe.', 'rejected')
  const base = appBaseUrl()
  return gateway.createOrder({
    amountUsd: offer.priceUsd,
    description: `medira · paquete de ${meteredUnit(offer.resource, offer.units)}`,
    customId: packCustomId(tenantID, offer.resource),
    returnUrl: `${base}/dashboard/plan/paquete`,
    cancelUrl: `${base}/dashboard/plan/paquete?cancelado=1`,
  })
}

/** Grant a paid pack once per PayPal capture. */
async function grantPack(payload: Payload, input: { tenantID: string; resource: PackResource; captureId: string; amountUsd: number; payerEmail: string | null; at: Date }) {
  const offer = QUOTA_PACKS.find((p) => p.resource === input.resource)!
  const existing = await payload.find({ collection: 'quotaPacks', where: { and: [{ tenant: { equals: input.tenantID } }, { note: { equals: `PayPal ${input.captureId}` } }] }, limit: 1, depth: 0, overrideAccess: true })
  let pack = existing.docs[0]
  if (!pack) {
    pack = await payload.create({
      collection: 'quotaPacks',
      overrideAccess: true,
      data: { tenant: input.tenantID, resource: input.resource, units: offer.units, source: 'paypal', note: `PayPal ${input.captureId}` } as never,
    })
    await audit(payload, input.tenantID, 'billing.pack-bought', `Paquete de ${meteredUnit(input.resource, offer.units)}`, { actor: 'paypal', captureId: input.captureId })
  }
  await createReceipt(payload, {
    tenantID: input.tenantID,
    transactionId: input.captureId,
    kind: 'pack',
    concept: `Paquete de ${meteredUnit(input.resource, offer.units)}`,
    totalUsd: input.amountUsd || offer.priceUsd,
    paidAt: input.at,
    payerEmail: input.payerEmail,
  })
  return pack
}

export type PackReturn = { ok: true; resource: PackResource; units: number; expiresAt: string } | { ok: false; message: string }

/** Return from PayPal after a pack purchase: capture (idempotent) and grant. */
export async function completePackOrder(payload: Payload, tenantID: string, orderId: string, now = new Date()): Promise<PackReturn> {
  const gateway = getGateway()
  if (!gateway) return { ok: false, message: 'El pago en línea todavía no está disponible.' }
  let order
  try {
    order = await gateway.captureOrder(orderId)
  } catch (err) {
    return { ok: false, message: err instanceof GatewayError ? err.message : 'PayPal no responde. Intente en unos minutos; no se cobró nada.' }
  }
  const parsed = parsePackCustomId(order.customId)
  if (!parsed || parsed.tenantID !== tenantID) return { ok: false, message: 'Esta compra no corresponde a su consultorio.' }
  if (order.status !== 'completed' || !order.captureId) return { ok: false, message: 'No se completó la compra. No se cobró nada.' }
  const pack = await grantPack(payload, { tenantID, resource: parsed.resource, captureId: order.captureId, amountUsd: order.amountUsd, payerEmail: order.payerEmail, at: now })
  return { ok: true, resource: parsed.resource, units: pack.units, expiresAt: String(pack.expiresAt) }
}

// ---------------------------------------------------------------- webhooks

export type WebhookResult = { status: number; outcome: string }

const str = (v: unknown) => (typeof v === 'string' ? v : null)

async function tenantForSubscription(payload: Payload, subscriptionId: string): Promise<string | null> {
  const t = await tenants(payload).findOne({ $or: [{ 'billing.subscriptionId': subscriptionId }, { 'billing.pendingSubscriptionId': subscriptionId }] }).lean()
  return t ? String(t._id) : null
}

async function isStale(payload: Payload, tenantID: string, at: Date) {
  const t = await loadTenant(payload, tenantID)
  const last = asDate(t?.billing?.lastEventAt)
  return Boolean(last && at.getTime() < last.getTime())
}

/**
 * Verify, de-duplicate (by PayPal event id) and apply one webhook delivery.
 * Unverified deliveries are logged and ignored; they are not stored, so a forged
 * id can never block the real event.
 */
export async function handleWebhook(payload: Payload, headers: Headers, rawBody: string, now = new Date()): Promise<WebhookResult> {
  const gateway = getGateway()
  if (!gateway) return { status: 503, outcome: 'disabled' }
  const event = await gateway.verifyWebhook(headers, rawBody).catch(() => null)
  if (!event) {
    payload.logger?.warn?.({ bytes: rawBody.length }, 'PayPal webhook rejected: signature not verified')
    return { status: 400, outcome: 'rejected' }
  }

  const prior = await payload.find({ collection: 'billingEvents', where: { eventId: { equals: event.id } }, limit: 1, depth: 0, overrideAccess: true })
  const priorDoc = prior.docs[0]
  if (priorDoc && priorDoc.status !== 'error') return { status: 200, outcome: 'duplicate' }

  let status: 'processed' | 'stale' | 'ignored' | 'error' = 'processed'
  let tenantID: string | null = null
  let error: string | undefined
  try {
    const r = await applyEvent(payload, event, now)
    status = r.status
    tenantID = r.tenantID
  } catch (err) {
    status = 'error'
    error = err instanceof Error ? err.message.slice(0, 300) : String(err)
  }

  const data = {
    eventId: event.id,
    type: event.type,
    eventTime: event.createTime,
    tenant: tenantID ?? undefined,
    resourceId: str(event.resource.id) ?? undefined,
    status,
    error,
  }
  if (priorDoc) {
    await payload.update({ collection: 'billingEvents', id: priorDoc.id, data, overrideAccess: true })
  } else {
    const created = await payload.create({ collection: 'billingEvents', data, overrideAccess: true }).catch(() => null)
    if (!created) return { status: 200, outcome: 'duplicate' } // a concurrent delivery stored it first
  }
  // A 500 makes PayPal retry the delivery later.
  return { status: status === 'error' ? 500 : 200, outcome: status }
}

async function applyEvent(payload: Payload, event: WebhookEvent, now: Date): Promise<{ status: 'processed' | 'stale' | 'ignored'; tenantID: string | null }> {
  const r = event.resource
  const at = new Date(event.createTime)

  if (event.type.startsWith('BILLING.SUBSCRIPTION.')) {
    const subId = str(r.id)
    if (!subId) return { status: 'ignored', tenantID: null }
    const tenantID = (await tenantForSubscription(payload, subId)) ?? str(r.custom_id)
    if (event.type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') {
      if (!tenantID) return { status: 'ignored', tenantID: null }
      if (await isStale(payload, tenantID, at)) return { status: 'stale', tenantID }
      const t = await loadTenant(payload, tenantID)
      if (t?.billing?.subscriptionId !== subId) return { status: 'ignored', tenantID }
      await markPastDue(payload, tenantID, at < now ? at : now)
      await setBilling(payload, tenantID, { lastEventAt: at })
      return { status: 'processed', tenantID }
    }
    const outcome = await syncSubscription(payload, subId, now)
    return { status: outcome === 'ignored' ? 'ignored' : 'processed', tenantID }
  }

  if (event.type === 'PAYMENT.SALE.COMPLETED') {
    const subId = str(r.billing_agreement_id)
    const saleId = str(r.id)
    if (!subId || !saleId) return { status: 'ignored', tenantID: null }
    const tenantID = await tenantForSubscription(payload, subId)
    if (!tenantID) return { status: 'ignored', tenantID: null }
    const t = await loadTenant(payload, tenantID)
    const b = t?.billing ?? {}
    const amount = Number((r.amount as { total?: string } | undefined)?.total ?? 0)
    const plan = isPaidPlan(b.billingPlan) ? b.billingPlan : null
    await syncSubscription(payload, subId, now).catch(() => null)
    const fresh = (await loadTenant(payload, tenantID))?.billing ?? {}
    await createReceipt(payload, {
      tenantID,
      transactionId: saleId,
      kind: 'plan',
      concept: plan ? `Plan ${planLabel(plan)} · ${b.interval === 'year' ? 'anual' : 'mensual'}` : 'Plan medira',
      totalUsd: amount,
      paidAt: at,
      payerEmail: null,
      periodStart: at,
      periodEnd: asDate(fresh.currentPeriodEnd),
    })
    // A payment newer than the failure clears the dunning; an older one cannot.
    const since = asDate(b.pastDueSince)
    if (b.status === 'past_due' && (!since || at.getTime() >= since.getTime())) await clearPastDue(payload, tenantID)
    if (b.status === 'trialing') await setBilling(payload, tenantID, { status: 'active' }, { where: { 'billing.status': 'trialing' } })
    if (!(await isStale(payload, tenantID, at))) await setBilling(payload, tenantID, { lastEventAt: at })
    return { status: 'processed', tenantID }
  }

  if (event.type === 'PAYMENT.SALE.REFUNDED' || event.type === 'PAYMENT.SALE.REVERSED' || event.type === 'PAYMENT.CAPTURE.REFUNDED' || event.type === 'PAYMENT.CAPTURE.REVERSED' || event.type === 'CUSTOMER.DISPUTE.CREATED') {
    const txId =
      str(r.sale_id) ??
      str((r.links as { rel: string; href: string }[] | undefined)?.find((l) => l.rel === 'up')?.href?.split('/').pop()) ??
      str((r.disputed_transactions as { seller_transaction_id?: string }[] | undefined)?.[0]?.seller_transaction_id) ??
      str(r.id)
    if (!txId) return { status: 'ignored', tenantID: null }
    const found = await payload.find({ collection: 'billingReceipts', where: { transactionId: { equals: txId } }, limit: 1, depth: 0, overrideAccess: true })
    const receipt = found.docs[0]
    if (!receipt) return { status: 'ignored', tenantID: null }
    const tenantID = String(typeof receipt.tenant === 'object' ? receipt.tenant.id : receipt.tenant)
    if (event.type !== 'CUSTOMER.DISPUTE.CREATED') {
      await payload.update({ collection: 'billingReceipts', id: receipt.id, data: { status: 'refunded' }, overrideAccess: true })
    }
    // Spec: refund / reversal / dispute of a plan charge ⇒ Pago fallido.
    if (receipt.kind === 'plan') {
      const t = await loadTenant(payload, tenantID)
      if (t?.billing?.subscriptionId && t.plan !== 'free') await markPastDue(payload, tenantID, now)
    }
    return { status: 'processed', tenantID }
  }

  if (event.type === 'CHECKOUT.ORDER.APPROVED' || event.type === 'PAYMENT.CAPTURE.COMPLETED') {
    const unit = (r.purchase_units as { custom_id?: string }[] | undefined)?.[0]
    const parsed = parsePackCustomId(str(r.custom_id) ?? unit?.custom_id)
    if (!parsed) return { status: 'ignored', tenantID: null }
    if (event.type === 'CHECKOUT.ORDER.APPROVED') {
      const res = await completePackOrder(payload, parsed.tenantID, String(r.id), now)
      return { status: res.ok ? 'processed' : 'ignored', tenantID: parsed.tenantID }
    }
    await grantPack(payload, {
      tenantID: parsed.tenantID,
      resource: parsed.resource,
      captureId: String(r.id),
      amountUsd: Number((r.amount as { value?: string } | undefined)?.value ?? 0),
      payerEmail: null,
      at,
    })
    return { status: 'processed', tenantID: parsed.tenantID }
  }

  return { status: 'ignored', tenantID: null }
}

// ---------------------------------------------------------------- daily job

export type BillingJobSummary = { dunning: number; downgraded: number; trialReminders: number; winback: number; synced: number }

/** Hourly/daily housekeeping. Every step is claimed with a conditional update, so reruns are harmless. */
export async function runBillingJob(payload: Payload, now = new Date()): Promise<BillingJobSummary> {
  const summary: BillingJobSummary = { dunning: 0, downgraded: 0, trialReminders: 0, winback: 0, synced: 0 }
  const managed = { 'billing.subscriptionId': { $exists: true, $nin: [null, ''] } }

  // 1. Dunning calendar. Only the latest step that is due is sent (no email bursts after downtime).
  for (const t of await tenants(payload).find({ ...managed, 'billing.status': 'past_due' }).limit(500).lean()) {
    const tenantID = String(t._id)
    const since = asDate(t.billing?.pastDueSince)
    if (!since) continue
    const days = Math.floor((now.getTime() - since.getTime()) / DAY)
    const stage = t.billing?.dunningStage ?? 0
    let due = -1
    DUNNING_DAYS.forEach((d, i) => {
      if (days >= d) due = i
    })
    if (due < stage) continue
    const claimed = await setBilling(payload, tenantID, { dunningStage: due + 1 }, { where: { 'billing.dunningStage': t.billing?.dunningStage ?? { $in: [null, 0] }, 'billing.status': 'past_due' } })
    if (!claimed) continue
    summary.dunning++
    const day = DUNNING_DAYS[due]!
    if (day >= DOWNGRADE_DAY) {
      if (await downgradeToFree(payload, tenantID, 'unpaid', now)) summary.downgraded++
    } else if (DUNNING_MAIL[day]) {
      const m = DUNNING_MAIL[day]!
      await mailOwners(payload, tenantID, m.subject, [m.body(formatDate(new Date(since.getTime() + DOWNGRADE_DAY * DAY), t.settings?.timezone ?? undefined))], { label: 'Ver mi plan', href: '/dashboard/plan' })
    }
  }

  // 2. Cancelled plans whose paid period (or trial) is over ⇒ Gratis.
  for (const t of await tenants(payload).find({ ...managed, 'billing.status': 'cancelled', plan: { $ne: 'free' } }).limit(500).lean()) {
    // During a trial the paid period ends with the trial (PayPal's next billing time).
    const end = asDate(t.billing?.currentPeriodEnd) ?? asDate(t.billing?.trialEndsAt)
    if (!end || end.getTime() > now.getTime()) continue
    if (await downgradeToFree(payload, String(t._id), 'cancelled', now)) summary.downgraded++
  }

  // 3. "Su prueba termina mañana" — 24 h before the first charge.
  for (const t of await tenants(payload)
    .find({ ...managed, 'billing.status': 'trialing', 'billing.trialEndsAt': { $lte: new Date(now.getTime() + DAY), $gt: now }, 'billing.trialEndingNotifiedAt': null })
    .limit(500)
    .lean()) {
    const tenantID = String(t._id)
    if (!(await setBilling(payload, tenantID, { trialEndingNotifiedAt: now }, { where: { 'billing.trialEndingNotifiedAt': null } }))) continue
    summary.trialReminders++
    const plan = asPlan(t.billing?.billingPlan)
    const interval = t.billing?.interval === 'year' ? 'year' : 'month'
    const amount = isPaidPlan(plan) ? priceFor(plan, interval, t.billing?.quantity ?? 1) : 0
    await mailOwners(payload, tenantID, 'Su prueba de medira termina mañana', [
      `${endSentence(`Su prueba termina el ${formatWhen(t.billing!.trialEndsAt!, t)}`)} Ese día PayPal cobrará US$${amount} por el plan ${planLabel(plan)} (${interval === 'year' ? 'anual' : 'mensual'}).`,
      'Si no desea continuar, cancele antes desde Mi plan y no se le cobrará nada.',
    ], { label: 'Ver mi plan', href: '/dashboard/plan' })
  }

  // 4. Missed webhooks: re-read pending subscriptions (last 2 days) and trials that should have charged.
  const pendings = await tenants(payload).find({ 'billing.pendingSubscriptionId': { $exists: true, $nin: [null, ''] }, 'billing.pendingSince': { $gte: new Date(now.getTime() - 2 * DAY) } }).limit(200).lean()
  const lateTrials = await tenants(payload).find({ ...managed, 'billing.status': 'trialing', 'billing.trialEndsAt': { $lte: new Date(now.getTime() - 3_600_000) } }).limit(200).lean()
  for (const t of [...pendings, ...lateTrials]) {
    const id = t.billing?.pendingSubscriptionId ?? t.billing?.subscriptionId
    if (!id) continue
    await syncSubscription(payload, id, now).then(() => summary.synced++).catch(() => null)
  }

  // 5. "Recupere su plan en un clic" on days 17 and 40 after the failed charge.
  for (const t of await tenants(payload).find({ 'billing.downgradedAt': { $exists: true, $ne: null }, plan: 'free' }).limit(500).lean()) {
    const tenantID = String(t._id)
    const start = asDate(t.billing?.pastDueSince) ?? new Date(asDate(t.billing!.downgradedAt)!.getTime() - DOWNGRADE_DAY * DAY)
    const days = Math.floor((now.getTime() - start.getTime()) / DAY)
    const stage = t.billing?.winbackStage ?? 0
    let due = -1
    WINBACK_DAYS.forEach((d, i) => {
      if (days >= d) due = i
    })
    if (due < stage) continue
    if (!(await setBilling(payload, tenantID, { winbackStage: due + 1 }, { where: { 'billing.winbackStage': t.billing?.winbackStage ?? { $in: [null, 0] } } }))) continue
    summary.winback++
    const from = t.billing?.downgradedFromPlan ? planLabel(asPlan(t.billing.downgradedFromPlan)) : 'su plan'
    await mailOwners(payload, tenantID, 'Recupere su plan en un clic', [
      `Sus datos siguen intactos. Vuelva a ${from} cuando quiera y su equipo recupera el acceso al instante.`,
    ], { label: 'Recuperar mi plan', href: '/dashboard/plan#planes' })
  }

  return summary
}

// ---------------------------------------------------------------- view model

export type BillingView =
  | { kind: 'manual' }
  | { kind: 'free'; downgradedAt: string | null; downgradedFrom: Plan | null }
  | { kind: 'pending' }
  | { kind: 'trialing'; plan: Plan; interval: Interval; endsAt: string; daysLeft: number }
  | { kind: 'active'; plan: Plan; interval: Interval; renewsAt: string | null }
  | { kind: 'past_due'; plan: Plan; days: number; downgradeAt: string }
  | { kind: 'cancelled'; plan: Plan; endsAt: string | null; inTrial: boolean }

/** What the plan page and the banners show. */
export function billingView(tenant: { plan?: string | null; billing?: TenantBilling | null }, now = new Date()): BillingView & { payer: string | null; pending: boolean } {
  const b = tenant.billing ?? {}
  const plan = asPlan(tenant.plan)
  const payer = b.payerEmailMasked ?? null
  const pendingRecent = Boolean(b.pendingSubscriptionId && b.pendingSince && now.getTime() - new Date(b.pendingSince).getTime() < 30 * 60_000)
  const extra = { payer, pending: pendingRecent }
  const interval: Interval = b.interval === 'year' ? 'year' : 'month'
  if (!b.subscriptionId) {
    if (pendingRecent) return { kind: 'pending', ...extra }
    return plan === 'free' ? { kind: 'free', downgradedAt: null, downgradedFrom: null, ...extra } : { kind: 'manual', ...extra }
  }
  if (plan === 'free') {
    return { kind: 'free', downgradedAt: b.downgradedAt ? new Date(b.downgradedAt).toISOString() : null, downgradedFrom: b.downgradedFromPlan ? asPlan(b.downgradedFromPlan) : null, ...extra }
  }
  switch (b.status) {
    case 'trialing': {
      const endsAt = asDate(b.trialEndsAt) ?? now
      return { kind: 'trialing', plan, interval, endsAt: endsAt.toISOString(), daysLeft: Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY)), ...extra }
    }
    case 'past_due': {
      const since = asDate(b.pastDueSince) ?? now
      return { kind: 'past_due', plan, days: Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY)), downgradeAt: new Date(since.getTime() + DOWNGRADE_DAY * DAY).toISOString(), ...extra }
    }
    case 'cancelled': {
      const end = asDate(b.currentPeriodEnd) ?? asDate(b.trialEndsAt)
      const trialEnd = asDate(b.trialEndsAt)
      const inTrial = Boolean(trialEnd && end && Math.abs(end.getTime() - trialEnd.getTime()) < 3_600_000 && trialEnd.getTime() > now.getTime())
      return { kind: 'cancelled', plan, endsAt: end ? end.toISOString() : null, inTrial, ...extra }
    }
    default:
      return { kind: 'active', plan, interval, renewsAt: b.currentPeriodEnd ? new Date(b.currentPeriodEnd).toISOString() : null, ...extra }
  }
}

/** PayPal's cancel_url: the payer closed PayPal without approving. Nothing was charged. */
export async function clearPendingCheckout(payload: Payload, tenantID: string): Promise<void> {
  await setBilling(payload, tenantID, {}, { where: { 'billing.pendingSubscriptionId': { $exists: true } }, unset: ['pendingSubscriptionId', 'pendingSince'] })
}
