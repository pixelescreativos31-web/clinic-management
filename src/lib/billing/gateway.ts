// Payment gateway adapter (spec §3, plan Fase 3). One interface, two
// implementations:
//
//  - PayPal (Subscriptions API for plans, Orders API for one-off quota packs), used
//    when PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are set. Credentials live only in
//    .env. The PayPal plan ids (one per medira plan × interval × with/without trial)
//    come from PAYPAL_PLAN_IDS, a JSON map such as
//    {"pro.month.trial":"P-…","pro.month":"P-…","pro.year.trial":"P-…",…}.
//  - Fake (in memory, no network), selected with BILLING_GATEWAY=fake. Used by the
//    tests and by local demos; it is never picked implicitly.
//
// With neither configured, `getGateway()` returns null and the app keeps the
// manual flow (the super admin assigns plans) — existing clinics never notice.

import { createHash, randomUUID } from 'node:crypto'

export type Interval = 'month' | 'year'

/** Normalised subscription states (PayPal: APPROVAL_PENDING, APPROVED, ACTIVE, SUSPENDED, CANCELLED, EXPIRED). */
export type GatewaySubStatus = 'pending' | 'active' | 'suspended' | 'cancelled' | 'expired'

export type GatewaySubscription = {
  id: string
  status: GatewaySubStatus
  /** Our key "pro.month.trial" (resolved from the PayPal plan id). */
  planKey: string | null
  /** Next charge; during a trial, the first real charge. */
  nextBillingTime: string | null
  /** True while the trial cycle is running. */
  inTrial: boolean
  payerEmail: string | null
  /** The tenant id we sent as custom_id. */
  customId: string | null
}

export type GatewayOrder = {
  id: string
  status: 'created' | 'approved' | 'completed' | 'voided'
  amountUsd: number
  customId: string | null
  captureId: string | null
  payerEmail: string | null
}

export type WebhookEvent = {
  id: string
  type: string
  createTime: string
  resource: Record<string, unknown>
}

export interface BillingGateway {
  readonly name: 'paypal' | 'fake'
  createSubscription(input: {
    planKey: string
    customId: string
    returnUrl: string
    cancelUrl: string
    payerEmail?: string
    /** Seats (Clínica privada is priced per doctor). */
    quantity?: number
  }): Promise<{ id: string; approveUrl: string }>
  getSubscription(id: string): Promise<GatewaySubscription>
  cancelSubscription(id: string, reason: string): Promise<void>
  createOrder(input: {
    amountUsd: number
    description: string
    customId: string
    returnUrl: string
    cancelUrl: string
  }): Promise<{ id: string; approveUrl: string }>
  /** Capture an approved order; idempotent (a captured order returns its capture). */
  captureOrder(id: string): Promise<GatewayOrder>
  /** Verify a webhook with the provider before trusting it; returns the parsed event or null. */
  verifyWebhook(headers: Headers, rawBody: string): Promise<WebhookEvent | null>
  /** Where the payer changes their card (PayPal → Pagos automáticos). */
  manageUrl(): string
}

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly kind: 'unavailable' | 'rejected' = 'unavailable',
  ) {
    super(message)
  }
}

/** "pro.month.trial" / "pro.month". */
export const planKey = (plan: string, interval: Interval, trial: boolean) => `${plan}.${interval}${trial ? '.trial' : ''}`

export function parsePlanKey(key: string | null): { plan: string; interval: Interval; trial: boolean } | null {
  if (!key) return null
  const [plan, interval, trial] = key.split('.')
  if (!plan || (interval !== 'month' && interval !== 'year')) return null
  return { plan, interval, trial: trial === 'trial' }
}

/** "g•••@gmail.com" — the only payer detail we keep. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) return null
  const [user, domain] = email.split('@')
  return `${user!.charAt(0)}•••@${domain}`
}

export const hashValue = (v: string) => createHash('sha256').update(v.trim().toLowerCase()).digest('hex')

// ---------------------------------------------------------------- PayPal

class PayPalGateway implements BillingGateway {
  readonly name = 'paypal' as const
  private token: { value: string; exp: number } | null = null

  constructor(
    private readonly clientId: string,
    private readonly secret: string,
    private readonly webhookId: string,
    private readonly live: boolean,
    private readonly planIds: Record<string, string>,
  ) {}

  private get base() {
    return this.live ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.exp > Date.now() + 60_000) return this.token.value
    const res = await fetch(`${this.base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    }).catch(() => null)
    if (!res?.ok) throw new GatewayError('PayPal no responde. Intente en unos minutos; no se cobró nada.')
    const json = (await res.json()) as { access_token: string; expires_in: number }
    this.token = { value: json.access_token, exp: Date.now() + json.expires_in * 1000 }
    return json.access_token
  }

  private async call<T>(method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await this.accessToken()}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).catch(() => null)
    if (!res) throw new GatewayError('PayPal no responde. Intente en unos minutos; no se cobró nada.')
    if (res.status === 204) return undefined as T
    const json = (await res.json().catch(() => ({}))) as T & { name?: string; message?: string }
    if (!res.ok) {
      // 422 UNPROCESSABLE_ENTITY covers unsupported country / currency and declined captures.
      const kind = res.status >= 500 ? 'unavailable' : 'rejected'
      throw new GatewayError(
        kind === 'unavailable'
          ? 'PayPal no responde. Intente en unos minutos; no se cobró nada.'
          : 'PayPal rechazó la operación. Revise su cuenta de PayPal o use otra.',
        kind,
      )
    }
    return json
  }

  private keyFor(paypalPlanId: string | undefined): string | null {
    if (!paypalPlanId) return null
    return Object.entries(this.planIds).find(([, id]) => id === paypalPlanId)?.[0] ?? null
  }

  async createSubscription(input: { planKey: string; customId: string; returnUrl: string; cancelUrl: string; payerEmail?: string; quantity?: number }) {
    const planId = this.planIds[input.planKey]
    if (!planId) throw new GatewayError('Este plan todavía no está disponible para pago en línea.', 'rejected')
    const sub = await this.call<{ id: string; links: { rel: string; href: string }[] }>(
      'POST',
      '/v1/billing/subscriptions',
      {
        plan_id: planId,
        custom_id: input.customId,
        ...(input.quantity && input.quantity > 1 ? { quantity: String(input.quantity) } : {}),
        ...(input.payerEmail ? { subscriber: { email_address: input.payerEmail } } : {}),
        application_context: {
          brand_name: 'medira',
          locale: 'es-DO',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
        },
      },
      { 'PayPal-Request-Id': randomUUID() },
    )
    const approve = sub.links.find((l) => l.rel === 'approve')?.href
    if (!approve) throw new GatewayError('PayPal no devolvió el enlace de aprobación.')
    return { id: sub.id, approveUrl: approve }
  }

  async getSubscription(id: string): Promise<GatewaySubscription> {
    const s = await this.call<{
      id: string
      status: string
      plan_id?: string
      custom_id?: string
      subscriber?: { email_address?: string }
      billing_info?: { next_billing_time?: string; cycle_executions?: { tenure_type: string; cycles_completed: number; cycles_remaining?: number }[] }
    }>('GET', `/v1/billing/subscriptions/${encodeURIComponent(id)}`)
    const trialCycle = s.billing_info?.cycle_executions?.find((c) => c.tenure_type === 'TRIAL')
    const regular = s.billing_info?.cycle_executions?.find((c) => c.tenure_type === 'REGULAR')
    const map: Record<string, GatewaySubStatus> = {
      APPROVAL_PENDING: 'pending',
      APPROVED: 'pending',
      ACTIVE: 'active',
      SUSPENDED: 'suspended',
      CANCELLED: 'cancelled',
      EXPIRED: 'expired',
    }
    return {
      id: s.id,
      status: map[s.status] ?? 'pending',
      planKey: this.keyFor(s.plan_id),
      nextBillingTime: s.billing_info?.next_billing_time ?? null,
      inTrial: Boolean(trialCycle && (regular?.cycles_completed ?? 0) === 0 && s.status === 'ACTIVE'),
      payerEmail: s.subscriber?.email_address ?? null,
      customId: s.custom_id ?? null,
    }
  }

  async cancelSubscription(id: string, reason: string) {
    await this.call('POST', `/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, { reason: reason.slice(0, 127) || 'Cancelada' })
  }

  async createOrder(input: { amountUsd: number; description: string; customId: string; returnUrl: string; cancelUrl: string }) {
    const order = await this.call<{ id: string; links: { rel: string; href: string }[] }>(
      'POST',
      '/v2/checkout/orders',
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: input.customId,
            description: input.description.slice(0, 127),
            amount: { currency_code: 'USD', value: input.amountUsd.toFixed(2) },
          },
        ],
        application_context: {
          brand_name: 'medira',
          locale: 'es-DO',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
        },
      },
      { 'PayPal-Request-Id': randomUUID() },
    )
    const approve = order.links.find((l) => l.rel === 'approve' || l.rel === 'payer-action')?.href
    if (!approve) throw new GatewayError('PayPal no devolvió el enlace de pago.')
    return { id: order.id, approveUrl: approve }
  }

  async captureOrder(id: string): Promise<GatewayOrder> {
    type Order = {
      id: string
      status: string
      payer?: { email_address?: string }
      purchase_units?: { custom_id?: string; amount?: { value: string }; payments?: { captures?: { id: string; status: string; amount: { value: string }; custom_id?: string }[] } }[]
    }
    let o = await this.call<Order>('GET', `/v2/checkout/orders/${encodeURIComponent(id)}`)
    if (o.status === 'APPROVED') {
      o = await this.call<Order>('POST', `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {}, { 'PayPal-Request-Id': `capture-${id}` })
    }
    const unit = o.purchase_units?.[0]
    const capture = unit?.payments?.captures?.[0]
    return {
      id: o.id,
      status: o.status === 'COMPLETED' ? 'completed' : o.status === 'APPROVED' ? 'approved' : o.status === 'VOIDED' ? 'voided' : 'created',
      amountUsd: Number(capture?.amount.value ?? unit?.amount?.value ?? 0),
      customId: unit?.custom_id ?? capture?.custom_id ?? null,
      captureId: capture?.id ?? null,
      payerEmail: o.payer?.email_address ?? null,
    }
  }

  async verifyWebhook(headers: Headers, rawBody: string): Promise<WebhookEvent | null> {
    let event: { id?: string; event_type?: string; create_time?: string; resource?: Record<string, unknown> }
    try {
      event = JSON.parse(rawBody)
    } catch {
      return null
    }
    const h = (k: string) => headers.get(k) ?? ''
    const res = await this.call<{ verification_status?: string }>('POST', '/v1/notifications/verify-webhook-signature', {
      auth_algo: h('paypal-auth-algo'),
      cert_url: h('paypal-cert-url'),
      transmission_id: h('paypal-transmission-id'),
      transmission_sig: h('paypal-transmission-sig'),
      transmission_time: h('paypal-transmission-time'),
      webhook_id: this.webhookId,
      webhook_event: event,
    }).catch(() => null)
    if (res?.verification_status !== 'SUCCESS' || !event.id || !event.event_type) return null
    return { id: event.id, type: event.event_type, createTime: event.create_time ?? new Date().toISOString(), resource: event.resource ?? {} }
  }

  manageUrl() {
    return this.live ? 'https://www.paypal.com/myaccount/autopay/' : 'https://www.sandbox.paypal.com/myaccount/autopay/'
  }
}

// ---------------------------------------------------------------- Fake

type FakeSub = GatewaySubscription & { cancelReason?: string }

/**
 * In-memory gateway for tests and demos. Tests drive it through `fake` helpers
 * (approve, fail, charge) and feed the resulting events to the webhook handler.
 */
export class FakeGateway implements BillingGateway {
  readonly name = 'fake' as const
  readonly subs = new Map<string, FakeSub>()
  readonly orders = new Map<string, GatewayOrder & { description: string }>()
  /** Webhook bodies signed with this secret verify; anything else is rejected. */
  readonly secret = 'fake-webhook-secret'
  private seq = 0

  /**
   * Demo mode (BILLING_GATEWAY=fake on a local server): there is no PayPal page to
   * approve on, so a subscription or order counts as approved the first time it is
   * read back. Tests leave this off and drive approval explicitly.
   */
  constructor(private readonly autoApprove = false) {}

  async createSubscription(input: { planKey: string; customId: string; returnUrl: string; cancelUrl: string; payerEmail?: string; quantity?: number }) {
    const id = `I-FAKE${++this.seq}`
    this.subs.set(id, {
      id,
      status: 'pending',
      planKey: input.planKey,
      nextBillingTime: null,
      inTrial: false,
      payerEmail: input.payerEmail ?? 'pagador@example.com',
      customId: input.customId,
    })
    return { id, approveUrl: `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}subscription_id=${id}` }
  }

  async getSubscription(id: string) {
    const s = this.subs.get(id)
    if (!s) throw new GatewayError('Suscripción no encontrada.', 'rejected')
    if (this.autoApprove && s.status === 'pending') this.approve(id)
    return { ...s }
  }

  async cancelSubscription(id: string, reason: string) {
    const s = this.subs.get(id)
    if (s) Object.assign(s, { status: 'cancelled', cancelReason: reason })
  }

  async createOrder(input: { amountUsd: number; description: string; customId: string; returnUrl: string; cancelUrl: string }) {
    const id = `O-FAKE${++this.seq}`
    this.orders.set(id, { id, status: 'created', amountUsd: input.amountUsd, customId: input.customId, captureId: null, payerEmail: 'pagador@example.com', description: input.description })
    return { id, approveUrl: `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}token=${id}` }
  }

  async captureOrder(id: string) {
    const o = this.orders.get(id)
    if (!o) throw new GatewayError('Orden no encontrada.', 'rejected')
    if (this.autoApprove && o.status === 'created') o.status = 'approved'
    if (o.status === 'approved') Object.assign(o, { status: 'completed', captureId: `CAP-${id}` })
    return { ...o }
  }

  async verifyWebhook(headers: Headers, rawBody: string) {
    if (headers.get('x-fake-signature') !== this.sign(rawBody)) return null
    const e = JSON.parse(rawBody) as { id: string; event_type: string; create_time: string; resource: Record<string, unknown> }
    return { id: e.id, type: e.event_type, createTime: e.create_time, resource: e.resource }
  }

  manageUrl() {
    return 'https://www.sandbox.paypal.com/myaccount/autopay/'
  }

  sign(rawBody: string) {
    return createHash('sha256').update(`${this.secret}.${rawBody}`).digest('hex')
  }

  // ---- test controls
  approve(id: string, opts: { trialDays?: number; now?: Date } = {}) {
    const s = this.subs.get(id)!
    const now = opts.now ?? new Date()
    const trial = s.planKey?.endsWith('.trial') ?? false
    s.status = 'active'
    s.inTrial = trial
    s.nextBillingTime = new Date(now.getTime() + (trial ? (opts.trialDays ?? 3) : 30) * 86_400_000).toISOString()
  }
  approveOrder(id: string) {
    const o = this.orders.get(id)!
    o.status = 'approved'
  }
  setStatus(id: string, status: GatewaySubStatus, patch: Partial<GatewaySubscription> = {}) {
    Object.assign(this.subs.get(id)!, { status, ...patch })
  }
}

// ---------------------------------------------------------------- selection

let cached: BillingGateway | null | undefined
let override: BillingGateway | null | undefined

/** Tests (and demos) can install a gateway explicitly. */
export function setGatewayForTests(g: BillingGateway | null | undefined) {
  override = g
}

export function getGateway(): BillingGateway | null {
  if (override !== undefined) return override
  if (cached !== undefined) return cached
  if (process.env.BILLING_GATEWAY === 'fake') {
    // Never in production: the fake would grant plans for free.
    if (process.env.NODE_ENV === 'production') {
      cached = null
      return cached
    }
    // One instance per server process (Next dev may load this module more than once).
    const g = globalThis as { __medFakeGateway?: FakeGateway }
    g.__medFakeGateway ??= new FakeGateway(true)
    cached = g.__medFakeGateway
    return cached
  }
  const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret, PAYPAL_WEBHOOK_ID: hook, PAYPAL_ENV: env, PAYPAL_PLAN_IDS: plans } = process.env
  if (!id || !secret || !hook) {
    cached = null
    return cached
  }
  let planIds: Record<string, string> = {}
  try {
    planIds = plans ? (JSON.parse(plans) as Record<string, string>) : {}
  } catch {
    planIds = {}
  }
  cached = new PayPalGateway(id, secret, hook, env === 'live', planIds)
  return cached
}
