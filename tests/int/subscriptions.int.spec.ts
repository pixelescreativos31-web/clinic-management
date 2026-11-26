import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, seedFixture, type Fixture } from './fixtures'
import { FakeGateway, setGatewayForTests } from '@/lib/billing/gateway'
import {
  billingView,
  cancelSubscription,
  completePackOrder,
  handleWebhook,
  runBillingJob,
  startCheckout,
  startPackCheckout,
  syncSubscription,
  trialEligible,
} from '@/lib/billing/service'
import { priceFor } from '@/lib/billing/prices'

// Fase 3 — trial + PayPal subscriptions (spec §3), driven through the in-memory
// FakeGateway: checkout, one trial per clinic/phone/PayPal account, verified and
// de-duplicated webhooks, out-of-order events, the dunning calendar, downgrade to
// Gratis (data kept, staff paused), win-back, cancel during trial, pack orders.

const DAY = 86_400_000
const T0 = new Date('2026-03-02T15:00:00Z')
const at = (days: number, base = T0) => new Date(base.getTime() + days * DAY)

describe('Fase 3 — prueba, suscripción PayPal y cobranza', () => {
  let payload: Payload
  let f: Fixture
  let fake: FakeGateway
  let seq = 0

  beforeAll(async () => {
    payload = await getTestPayload()
  })
  beforeEach(async () => {
    f = await seedFixture(payload)
    fake = new FakeGateway()
    setGatewayForTests(fake)
  })
  afterAll(() => setGatewayForTests(undefined))

  const tenantModel = () =>
    (payload.db as unknown as { collections: Record<string, { updateOne: (a: object, b: object) => Promise<unknown> }> }).collections.tenants

  const setPlan = (tenantID: string | number, plan: string) => tenantModel().updateOne({ _id: String(tenantID) }, { $set: { plan } })

  const tenant = (id: string | number) => payload.findByID({ collection: 'tenants', id, depth: 0, overrideAccess: true })
  const user = (id: string | number) => payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true })

  const subIdFrom = (url: string) => new URL(url).searchParams.get('subscription_id')!

  /** Subscribe clinic A (Gratis → plan) and approve at `now`. */
  async function subscribe(tenantID: string, plan = 'pro', now = T0, interval: 'month' | 'year' = 'month') {
    const { approveUrl, trial } = await startCheckout(payload, { tenantID, plan, interval })
    const id = subIdFrom(approveUrl)
    fake.approve(id, { now })
    const outcome = await syncSubscription(payload, id, now)
    return { id, trial, outcome }
  }

  function webhook(type: string, resource: Record<string, unknown>, createTime: Date, opts: { id?: string; sign?: boolean } = {}) {
    const body = JSON.stringify({ id: opts.id ?? `WH-${++seq}`, event_type: type, create_time: createTime.toISOString(), resource })
    const headers = new Headers()
    if (opts.sign !== false) headers.set('x-fake-signature', fake.sign(body))
    return { body, headers }
  }
  const deliver = (w: { body: string; headers: Headers }, now = new Date()) => handleWebhook(payload, w.headers, w.body, now)

  it('existing clinics on a manual plan are never touched by billing', async () => {
    const before = await tenant(f.a.tenant.id)
    expect(before.plan).toBe('plus')
    expect(billingView(before as never).kind).toBe('manual')
    await runBillingJob(payload, at(60))
    const after = await tenant(f.a.tenant.id)
    expect(after.plan).toBe('plus')
    expect((await user(f.a.doctor.id)).planSuspendedAt ?? null).toBeNull()
  })

  it('checkout with the 3-day trial: plan changes only once PayPal confirms', async () => {
    const A = String(f.a.tenant.id)
    await setPlan(A, 'free')
    const { approveUrl, trial } = await startCheckout(payload, { tenantID: A, plan: 'pro', interval: 'month' })
    expect(trial).toBe(true)
    const id = subIdFrom(approveUrl)
    expect(fake.subs.get(id)!.planKey).toBe('pro.month.trial')
    expect((await tenant(A)).plan).toBe('free') // nothing changes before approval
    expect(await syncSubscription(payload, id, T0)).toBe('pending')

    fake.approve(id, { now: T0 })
    expect(await syncSubscription(payload, id, T0)).toBe('trialing')
    const t = await tenant(A)
    expect(t.plan).toBe('pro')
    expect(t.billing).toMatchObject({ subscriptionId: id, status: 'trialing', billingPlan: 'pro', interval: 'month', trialUsed: true })
    expect(new Date(t.billing!.trialEndsAt!).getTime()).toBe(at(3).getTime())
    expect(t.billing!.payerEmailMasked).toBe('p•••@example.com')
    const view = billingView(t as never, T0)
    expect(view).toMatchObject({ kind: 'trialing', daysLeft: 3 })

    // Polling again (return page + webhook) changes nothing.
    expect(await syncSubscription(payload, id, T0)).toBe('trialing')
    const claims = await payload.find({ collection: 'trialClaims', overrideAccess: true })
    expect(claims.docs.map((c) => c.kind).sort()).toEqual(['email', 'payer', 'phone'])
  })

  it('one trial per clinic and per phone: a second checkout has no trial', async () => {
    const A = String(f.a.tenant.id)
    const B = String(f.b.tenant.id)
    await setPlan(A, 'free')
    await setPlan(B, 'free')
    await subscribe(A)
    expect(await trialEligible(payload, A)).toBe(false)
    // Fixture clinic B shares the clinic phone with A.
    expect(await trialEligible(payload, B)).toBe(false)
    const { approveUrl, trial } = await startCheckout(payload, { tenantID: B, plan: 'clinic', interval: 'year' })
    expect(trial).toBe(false)
    expect(fake.subs.get(subIdFrom(approveUrl))!.planKey).toBe('clinic.year')
  })

  it('one trial per PayPal account: the same payer on another clinic gets no trial and is not charged', async () => {
    const A = String(f.a.tenant.id)
    const B = String(f.b.tenant.id)
    await setPlan(A, 'free')
    await setPlan(B, 'free')
    await tenantModel().updateOne({ _id: B }, { $set: { phone: '8095550000' } })
    await subscribe(A)
    expect(await trialEligible(payload, B)).toBe(true)
    const { id, outcome } = await subscribe(B)
    expect(outcome).toBe('trial_denied')
    expect(fake.subs.get(id)!.status).toBe('cancelled')
    const tb = await tenant(B)
    expect(tb.plan).toBe('free')
    expect(tb.billing?.trialUsed).toBe(true)
    expect(tb.billing?.subscriptionId ?? null).toBeNull()
  })

  it('webhooks: unverified ones are ignored and not stored; a repeated event id is applied once', async () => {
    const A = String(f.a.tenant.id)
    await setPlan(A, 'free')
    const { id } = await subscribe(A)

    const forged = webhook('BILLING.SUBSCRIPTION.PAYMENT.FAILED', { id }, at(5), { sign: false, id: 'WH-real' })
    expect((await deliver(forged, at(5))).status).toBe(400)
    expect((await payload.find({ collection: 'billingEvents', overrideAccess: true })).totalDocs).toBe(0)
    expect((await tenant(A)).billing?.status).toBe('trialing')

    const real = webhook('BILLING.SUBSCRIPTION.PAYMENT.FAILED', { id }, at(5), { id: 'WH-real' })
    expect(await deliver(real, at(5))).toEqual({ status: 200, outcome: 'processed' })
    expect(await deliver(real, at(5))).toEqual({ status: 200, outcome: 'duplicate' })
    const t = await tenant(A)
    expect(t.billing).toMatchObject({ status: 'past_due', dunningStage: 1 })
    expect((await payload.find({ collection: 'billingEvents', overrideAccess: true })).totalDocs).toBe(1)
  })

  it('an old event never undoes a newer one; a newer payment clears the failure and issues a receipt', async () => {
    const A = String(f.a.tenant.id)
    await setPlan(A, 'free')
    const { id } = await subscribe(A)
    fake.setStatus(id, 'active', { inTrial: false, nextBillingTime: at(33).toISOString() })

    await deliver(webhook('BILLING.SUBSCRIPTION.PAYMENT.FAILED', { id }, at(4)), at(4))
    expect((await tenant(A)).billing?.status).toBe('past_due')

    // A sale that happened BEFORE the failure arrives late: receipt yes, recovery no.
    await deliver(webhook('PAYMENT.SALE.COMPLETED', { id: 'SALE-1', billing_agreement_id: id, amount: { total: '25.00' } }, at(3)), at(4))
    expect((await tenant(A)).billing?.status).toBe('past_due')

    // A later failure event that is older than the last applied one is stale.
    await deliver(webhook('PAYMENT.SALE.COMPLETED', { id: 'SALE-2', billing_agreement_id: id, amount: { total: '25.00' } }, at(6)), at(6))
    const t = await tenant(A)
    expect(t.billing?.status).toBe('active')
    expect(t.billing?.pastDueSince ?? null).toBeNull()
    const stale = await deliver(webhook('BILLING.SUBSCRIPTION.PAYMENT.FAILED', { id }, at(5)), at(6))
    expect(stale.outcome).toBe('stale')
    expect((await tenant(A)).billing?.status).toBe('active')

    const receipts = await payload.find({ collection: 'billingReceipts', sort: 'number', overrideAccess: true })
    expect(receipts.totalDocs).toBe(2)
    expect(receipts.docs[0]!.number).toMatch(/^MED-2026-\d{6}$/)
    expect(receipts.docs[0]).toMatchObject({ totalUsd: 25, method: 'PayPal', kind: 'plan', status: 'paid' })
  })

  it('dunning calendar: day 0/3/7/9 notices, day 10 to Gratis with data kept and staff paused', async () => {
    const A = String(f.a.tenant.id)
    await setPlan(A, 'free')
    const { id } = await subscribe(A, 'clinic')
    fake.setStatus(id, 'active', { inTrial: false })
    const patientsBefore = (await payload.count({ collection: 'patients', where: { tenant: { equals: A } }, overrideAccess: true })).totalDocs

    await deliver(webhook('BILLING.SUBSCRIPTION.PAYMENT.FAILED', { id }, at(10)), at(10))
    const failedAt = at(10)
    const stage = async () => (await tenant(A)).billing?.dunningStage

    await runBillingJob(payload, at(0.5, failedAt))
    expect(await stage()).toBe(1)
    await runBillingJob(payload, at(3, failedAt))
    expect(await stage()).toBe(2)
    await runBillingJob(payload, at(3.5, failedAt)) // same day again: nothing new
    expect(await stage()).toBe(2)
    await runBillingJob(payload, at(7, failedAt))
    expect(await stage()).toBe(3)
    expect(billingView(await tenant(A) as never, at(7, failedAt))).toMatchObject({ kind: 'past_due', days: 7 })
    await runBillingJob(payload, at(9, failedAt))
    expect(await stage()).toBe(4)
    expect((await tenant(A)).plan).toBe('clinic')

    const s10 = await runBillingJob(payload, at(10, failedAt))
    expect(s10.downgraded).toBe(1)
    const t = await tenant(A)
    expect(t.plan).toBe('free')
    expect(t.billing).toMatchObject({ downgradeReason: 'unpaid', downgradedFromPlan: 'clinic', status: 'cancelled' })
    expect(fake.subs.get(id)!.status).toBe('cancelled')
    expect((await runBillingJob(payload, at(10.2, failedAt))).downgraded).toBe(0)

    // Nothing is deleted; only the Titular keeps access.
    expect((await payload.count({ collection: 'patients', where: { tenant: { equals: A } }, overrideAccess: true })).totalDocs).toBe(patientsBefore)
    expect((await user(f.a.doctor.id)).planSuspendedAt).toBeTruthy()
    expect((await user(f.a.receptionist.id)).planSuspendedAt).toBeTruthy()
    expect((await user(f.a.owner.id)).planSuspendedAt ?? null).toBeNull()
    expect((await user(f.b.doctor.id)).planSuspendedAt ?? null).toBeNull()
    await expect(
      payload.login({ collection: 'users', data: { email: 'doctor-A@clinic.test', password: 'password123' } }),
    ).rejects.toThrow(/plan Gratis/)
    await expect(payload.login({ collection: 'users', data: { email: 'owner-A@clinic.test', password: 'password123' } })).resolves.toBeTruthy()

    // Win-back on days 17 and 40.
    expect((await runBillingJob(payload, at(17, failedAt))).winback).toBe(1)
    expect((await runBillingJob(payload, at(20, failedAt))).winback).toBe(0)
    expect((await runBillingJob(payload, at(40, failedAt))).winback).toBe(1)
    expect((await tenant(A)).billing?.winbackStage).toBe(2)

    // Paying again restores the plan and the team (no second trial).
    const again = await subscribe(A, 'clinic', at(41, failedAt))
    expect(again.trial).toBe(false)
    expect(again.outcome).toBe('active')
    const back = await tenant(A)
    expect(back.plan).toBe('clinic')
    expect(back.billing?.downgradedAt ?? null).toBeNull()
    expect((await user(f.a.doctor.id)).planSuspendedAt ?? null).toBeNull()
  })

  it('cancel during the trial: nothing is charged, the trial runs to its end, then Gratis', async () => {
    const A = String(f.a.tenant.id)
    await setPlan(A, 'free')
    const { id } = await subscribe(A)
    const { message } = await cancelSubscription(payload, A, 'Solo estaba probando')
    expect(message).toMatch(/^Su prueba sigue activa hasta el .+\. No se le cobrará nada\. Después su cuenta pasará a Gratis\.$/)
    expect(fake.subs.get(id)!.status).toBe('cancelled')
    expect(billingView(await tenant(A) as never, at(1))).toMatchObject({ kind: 'cancelled', inTrial: true })

    // PayPal's own CANCELLED webhook is harmless.
    await deliver(webhook('BILLING.SUBSCRIPTION.CANCELLED', { id }, at(0.1)), at(0.1))
    await runBillingJob(payload, at(2))
    expect((await tenant(A)).plan).toBe('pro')
    await runBillingJob(payload, at(3.01))
    const t = await tenant(A)
    expect(t.plan).toBe('free')
    expect(t.billing?.downgradeReason).toBe('cancelled')
  })

  it('trial-ending email is claimed once, 24 h before the first charge', async () => {
    const A = String(f.a.tenant.id)
    await setPlan(A, 'free')
    await subscribe(A)
    expect((await runBillingJob(payload, at(1))).trialReminders).toBe(0)
    expect((await runBillingJob(payload, at(2.5))).trialReminders).toBe(1)
    expect((await runBillingJob(payload, at(2.6))).trialReminders).toBe(0)
    expect((await tenant(A)).billing?.trialEndingNotifiedAt).toBeTruthy()
  })

  it('packs with PayPal Orders: granted once per capture, receipt issued; abandoned orders charge nothing', async () => {
    const A = String(f.a.tenant.id)
    await setPlan(A, 'pro')
    const { approveUrl } = await startPackCheckout(payload, A, 'whatsappMessages')
    const orderId = new URL(approveUrl).searchParams.get('token')!
    expect(fake.orders.get(orderId)).toMatchObject({ amountUsd: 10, customId: `pack:${A}:whatsappMessages` })

    expect(await completePackOrder(payload, A, orderId)).toEqual({ ok: false, message: 'No se completó la compra. No se cobró nada.' })
    fake.approveOrder(orderId)
    const first = await completePackOrder(payload, A, orderId)
    expect(first).toMatchObject({ ok: true, resource: 'whatsappMessages', units: 500 })
    await completePackOrder(payload, A, orderId) // reload of the return page
    await deliver(webhook('PAYMENT.CAPTURE.COMPLETED', { id: `CAP-${orderId}`, custom_id: `pack:${A}:whatsappMessages`, amount: { value: '10.00' } }, new Date()))
    const packs = await payload.find({ collection: 'quotaPacks', where: { tenant: { equals: A } }, overrideAccess: true })
    expect(packs.totalDocs).toBe(1)
    expect(packs.docs[0]).toMatchObject({ source: 'paypal', units: 500, used: 0 })
    const receipts = await payload.find({ collection: 'billingReceipts', where: { tenant: { equals: A } }, overrideAccess: true })
    expect(receipts.totalDocs).toBe(1)
    expect(receipts.docs[0]).toMatchObject({ kind: 'pack', totalUsd: 10 })

    // Another clinic cannot redeem it.
    expect((await completePackOrder(payload, String(f.b.tenant.id), orderId)).ok).toBe(false)
  })

  it('a refunded plan charge puts the account in Pago fallido; receipts stay per clinic', async () => {
    const A = String(f.a.tenant.id)
    await setPlan(A, 'free')
    const { id } = await subscribe(A)
    fake.setStatus(id, 'active', { inTrial: false })
    await deliver(webhook('PAYMENT.SALE.COMPLETED', { id: 'SALE-9', billing_agreement_id: id, amount: { total: '25.00' } }, at(3)), at(3))
    await deliver(webhook('PAYMENT.SALE.REFUNDED', { id: 'REF-1', sale_id: 'SALE-9' }, at(4)), at(4))
    const t = await tenant(A)
    expect(t.billing?.status).toBe('past_due')
    const receipt = (await payload.find({ collection: 'billingReceipts', overrideAccess: true })).docs[0]!
    expect(receipt.status).toBe('refunded')
    await expect(
      payload.findByID({ collection: 'billingReceipts', id: receipt.id, user: f.b.owner, overrideAccess: false }),
    ).rejects.toBeTruthy()
    const mine = await payload.findByID({ collection: 'billingReceipts', id: receipt.id, user: f.a.owner, overrideAccess: false })
    expect(mine.number).toBe(receipt.number)
  })

  it('without a configured gateway nothing changes: checkout explains, webhook is closed', async () => {
    setGatewayForTests(null)
    await expect(startCheckout(payload, { tenantID: String(f.a.tenant.id), plan: 'pro', interval: 'month' })).rejects.toThrow(
      /todavía no está disponible/,
    )
    expect((await handleWebhook(payload, new Headers(), '{}')).status).toBe(503)
  })

  it('prices: annual is 10 months, Clínica privada per doctor', () => {
    expect(priceFor('pro', 'month')).toBe(25)
    expect(priceFor('pro', 'year')).toBe(250)
    expect(priceFor('clinic', 'year')).toBe(500)
    expect(priceFor('plus', 'month', 4)).toBe(60)
  })
})
