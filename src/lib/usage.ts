// Usage metering (roadmap B1) — the server side of the metered quotas defined in
// src/lib/plans.ts. Later phases call these helpers:
//
//   B3 WhatsApp:  await assertQuota(payload, tenantID, 'whatsappMessages', 1, { req })
//                 …send the message; only after Meta accepts it:
//                 await recordUsage(payload, tenantID, 'whatsappMessages', 1, req)
//   B4 AI study:  same pattern with 'aiStudies' (count only successful drafts).
//   Dictation / AI summary / email reminder: 'aiDictations', 'aiSummaries', 'emailReminders'.
//   B2 storage:   recordUsage(…, 'storageBytes', +file.size) on upload and
//                 recordUsage(…, 'storageBytes', -file.size) on delete.
//
// Quota packs (spec §2, collection quotaPacks): `checkQuota` counts what is left
// in live packs; `recordUsage` spends the monthly quota first and takes the rest
// from the pack that expires soonest. Owners are emailed once per period at 80%
// and at 100% (flags on the counter row).
//
// Policy: SOFT cap. Over quota, `assertQuota` refuses only the metered action, with
// a Spanish message; it is never called from clinical record hooks, so visits,
// patients and prescriptions stay editable whatever the usage.
//
// Check-then-record is not one atomic step: two concurrent sends at 999/1000 can
// both pass and land at 1001. That overshoot is accepted (soft cap, igalenus
// bills overage the same way); the counter itself never loses an increment.

import type { Payload, PayloadRequest } from 'payload'
import { APIError } from 'payload'
import { getTenantID, isSuperAdmin } from '@/access'
import { DEFAULT_TIMEZONE, ERROR_CODES } from '@/lib/constants'
import { appBaseUrl, sendEmail } from '@/lib/email'
import {
  METERED_RESOURCES,
  NO_PACKS,
  asPlan,
  isMonthlyResource,
  isPackResource,
  quotaAllows,
  quotaExceededMessage,
  meteredUnit,
  quotaFor,
  quotaNearMessage,
  quotaStatus,
  usagePeriod,
  type MeteredResource,
  type PackBalance,
  type PackResource,
  type Plan,
  type QuotaStatus,
} from '@/lib/plans'

type TenantID = string | number

type Lean<T> = { lean: () => Promise<T> }

/** Minimal mongoose-model surface we use (the adapter exposes one per collection). */
type CounterModel = {
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => Lean<{ count?: number } | null> | Promise<{ count?: number } | null>
  find: (filter: Record<string, unknown>) => Lean<Array<{ resource: string; count?: number; period?: string }>>
}

type PackDoc = {
  _id: unknown
  resource: string
  units: number
  used?: number | null
  expiresAt?: Date | string | null
  source?: string
}

type PackModel = {
  find: (filter: Record<string, unknown>) => { sort: (s: Record<string, 1 | -1>) => Lean<PackDoc[]> }
  updateOne: (filter: Record<string, unknown>, update: Record<string, unknown>) => Promise<{ modifiedCount?: number }>
}

function counterModel(payload: Payload): CounterModel {
  const model = (payload.db as unknown as { collections?: Record<string, CounterModel> }).collections?.usageCounters
  if (!model) throw new Error('usageCounters model unavailable (is the mongoose adapter in use?)')
  return model
}

function packModel(payload: Payload): PackModel {
  const model = (payload.db as unknown as { collections?: Record<string, PackModel> }).collections?.quotaPacks
  if (!model) throw new Error('quotaPacks model unavailable (is the mongoose adapter in use?)')
  return model
}

async function run<T>(q: Lean<T> | Promise<T>): Promise<T> {
  return 'lean' in q ? q.lean() : q
}

/**
 * Tenant wall for server-side callers: a logged-in clinic user may only meter
 * their own clinic. No user (cron, webhook, system job) or a super admin may
 * meter any clinic — those paths decide the tenant themselves.
 */
export function assertSameTenant(req: Pick<PayloadRequest, 'user'> | undefined, tenantID: TenantID): void {
  const user = req?.user
  if (!user || isSuperAdmin(user)) return
  if (getTenantID(user) !== String(tenantID)) {
    throw new APIError('No tiene permiso para usar los recursos de otro consultorio.', 403, {
      code: ERROR_CODES.FORBIDDEN,
    })
  }
}

async function loadTenant(payload: Payload, tenantID: TenantID) {
  const tenant = await payload.findByID({ collection: 'tenants', id: tenantID, depth: 0, overrideAccess: true })
  return {
    plan: asPlan(tenant?.plan),
    timeZone: tenant?.settings?.timezone || DEFAULT_TIMEZONE,
  }
}

function assertAmount(resource: MeteredResource, n: number): void {
  if (!Number.isSafeInteger(n)) throw new Error(`recordUsage: n must be an integer (got ${n})`)
  // Monthly usage only grows; storage is a running total, so deletes subtract.
  if (isMonthlyResource(resource) && n < 0) throw new Error('recordUsage: monthly usage cannot decrease')
}

/**
 * Atomically add `n` to the clinic's counter for `resource` in the current period
 * and return the new total. A single Mongo `findOneAndUpdate` with `$inc` +
 * upsert: concurrent calls never lose an increment. The unique index on
 * (tenant, period, resource) makes a racing first insert fail with E11000 instead
 * of creating a duplicate; we retry, and the retry takes the `$inc` path.
 *
 * Units beyond the monthly quota are taken from packs (soonest expiry first), and
 * crossing 80% / 100% emails the owner once per period.
 *
 * Runs outside the request transaction on purpose: call it *after* the metered
 * action succeeded, so a rolled-back request never refunds a message Meta sent.
 */
export async function recordUsage(
  payload: Payload,
  tenantID: TenantID,
  resource: MeteredResource,
  n = 1,
  req?: Pick<PayloadRequest, 'user'>,
  opts: { now?: Date } = {},
): Promise<number> {
  if (!METERED_RESOURCES.includes(resource)) throw new Error(`recordUsage: unknown resource ${String(resource)}`)
  assertAmount(resource, n)
  assertSameTenant(req, tenantID)
  const now = opts.now ?? new Date()
  const { plan, timeZone } = await loadTenant(payload, tenantID) // also 404s on an unknown tenant
  const period = usagePeriod(resource, now, timeZone)
  const model = counterModel(payload)
  const filter = { tenant: String(tenantID), period, resource }
  const update = { $inc: { count: n } }

  let total = n
  for (let attempt = 0; ; attempt++) {
    try {
      const doc = await run(model.findOneAndUpdate(filter, update, { upsert: true, new: true, setDefaultsOnInsert: false }))
      total = doc?.count ?? n
      break
    } catch (err) {
      const dup = (err as { code?: number }).code === 11000
      if (!dup || attempt >= 3) throw err
    }
  }

  // Units beyond the monthly quota come out of packs, soonest expiry first.
  const monthly = quotaFor(plan, resource)
  if (n > 0 && monthly !== null && isPackResource(resource)) {
    const overflow = Math.max(0, total - monthly) - Math.max(0, total - n - monthly)
    if (overflow > 0) await consumePacks(payload, tenantID, resource, overflow, now)
  }

  // 80% / 100% notice to the owner, once per period (best effort, never fails the action).
  if (n > 0) {
    try {
      await notifyThresholds(payload, tenantID, plan, resource, period, total, now)
    } catch (err) {
      payload.logger?.error?.({ err, resource }, 'quota notice failed (non-fatal)')
    }
  }
  return total
}

/** Live packs (not expired, units left) of one or all resources, soonest expiry first. */
async function livePacks(payload: Payload, tenantID: TenantID, now: Date, resource?: PackResource): Promise<PackDoc[]> {
  const filter: Record<string, unknown> = { tenant: String(tenantID), expiresAt: { $gt: now } }
  if (resource) filter.resource = resource
  const rows = await packModel(payload).find(filter).sort({ expiresAt: 1, createdAt: 1 }).lean()
  return rows.filter((p) => (p.units ?? 0) - (p.used ?? 0) > 0)
}

/** What is left in the clinic's live packs for `resource`. */
export async function getPackBalance(
  payload: Payload,
  tenantID: TenantID,
  resource: MeteredResource,
  opts: { now?: Date } = {},
): Promise<PackBalance> {
  if (!isPackResource(resource)) return NO_PACKS
  const packs = await livePacks(payload, tenantID, opts.now ?? new Date(), resource)
  if (packs.length === 0) return NO_PACKS
  const remaining = packs.reduce((sum, p) => sum + (p.units - (p.used ?? 0)), 0)
  const first = packs[0]!.expiresAt
  return { remaining, nextExpiry: first ? new Date(first).toISOString() : null }
}

/**
 * Take `n` units from the clinic's packs, soonest expiry first. Each step is a
 * conditional `$inc` that only applies while `used + take <= units`, so two
 * concurrent consumers never spend the same unit; a step that no longer fits
 * re-reads and tries again. If the packs run dry the rest is a soft overshoot
 * (same policy as the monthly quota).
 */
async function consumePacks(
  payload: Payload,
  tenantID: TenantID,
  resource: PackResource,
  n: number,
  now: Date,
): Promise<number> {
  let left = n
  for (let round = 0; left > 0 && round < 25; round++) {
    const packs = await livePacks(payload, tenantID, now, resource)
    if (packs.length === 0) break
    let raced = false
    for (const p of packs) {
      if (left <= 0) break
      const take = Math.min(left, p.units - (p.used ?? 0))
      if (take <= 0) continue
      const res = await packModel(payload).updateOne(
        { _id: p._id, $expr: { $lte: [{ $add: [{ $ifNull: ['$used', 0] }, take] }, '$units'] } },
        { $inc: { used: take } },
      )
      if ((res.modifiedCount ?? 0) === 1) left -= take
      else {
        raced = true // someone else moved this pack: re-read
        break
      }
    }
    if (!raced) break
  }
  return n - left
}

/** Emails of the clinic's active owners. */
async function ownerEmails(payload: Payload, tenantID: TenantID): Promise<string[]> {
  const res = await payload.find({
    collection: 'users',
    where: {
      and: [{ tenant: { equals: tenantID } }, { role: { equals: 'owner' } }, { active: { not_equals: false } }],
    },
    depth: 0,
    limit: 5,
    overrideAccess: true,
  })
  return res.docs.map((u) => u.email).filter(Boolean)
}

/**
 * Spec §2: at 80% and at 100% of a quota the owner gets one email per period
 * (the panel shows the same notice). The flag is claimed with a conditional
 * update, so concurrent calls send it once.
 */
async function notifyThresholds(
  payload: Payload,
  tenantID: TenantID,
  plan: Plan,
  resource: MeteredResource,
  period: string,
  total: number,
  now: Date,
): Promise<void> {
  const status = quotaStatus(plan, resource, total, await getPackBalance(payload, tenantID, resource, { now }))
  if (!status.included || status.limit === null) return
  const level = status.atLimit ? 'notified100At' : status.near ? 'notified80At' : null
  if (!level) return
  const won = await run(
    counterModel(payload).findOneAndUpdate(
      { tenant: String(tenantID), period, resource, [level]: null },
      { $set: { [level]: now } },
      { new: true },
    ),
  )
  if (!won) return // already told this period
  const label = meteredUnit(resource, 2)
  const text = status.atLimit ? quotaExceededMessage(plan, resource, status) : quotaNearMessage(resource, status, period)
  const subject = status.atLimit ? `Se agotó su cuota de ${label}` : `Va por el 80 % de sus ${label}`
  const link = `${appBaseUrl()}/dashboard/plan`
  for (const to of await ownerEmails(payload, tenantID)) {
    await sendEmail({
      to,
      subject,
      html: `<p>${text}</p><p>La atención y los expedientes nunca se bloquean.</p><p><a href="${link}">Ver el uso de su plan</a></p>`,
    })
  }
}

/** Current raw usage for one resource (0 when nothing recorded yet). */
export async function getUsed(
  payload: Payload,
  tenantID: TenantID,
  resource: MeteredResource,
  opts: { now?: Date; timeZone?: string } = {},
): Promise<number> {
  const timeZone = opts.timeZone ?? (await loadTenant(payload, tenantID)).timeZone
  const period = usagePeriod(resource, opts.now ?? new Date(), timeZone)
  const rows = await counterModel(payload).find({ tenant: String(tenantID), period, resource }).lean()
  return rows[0]?.count ?? 0
}

export type QuotaCheck = QuotaStatus & {
  plan: Plan
  resource: MeteredResource
  /** Whether `n` more units fit in the quota (monthly + packs). */
  allowed: boolean
  /** Spanish refusal text when `allowed` is false. */
  message: string | null
}

/** Read-only: would `n` more units of `resource` fit in the clinic's quota and packs? */
export async function checkQuota(
  payload: Payload,
  tenantID: TenantID,
  resource: MeteredResource,
  n = 1,
  opts: { req?: Pick<PayloadRequest, 'user'>; now?: Date } = {},
): Promise<QuotaCheck> {
  assertSameTenant(opts.req, tenantID)
  const { plan, timeZone } = await loadTenant(payload, tenantID)
  const used = await getUsed(payload, tenantID, resource, { now: opts.now, timeZone })
  const status = quotaStatus(plan, resource, used, await getPackBalance(payload, tenantID, resource, { now: opts.now }))
  const allowed = quotaAllows(status, n)
  return { ...status, plan, resource, allowed, message: allowed ? null : quotaExceededMessage(plan, resource, status) }
}

/** `checkQuota` that throws a 403 `QUOTA_EXCEEDED` APIError when over quota. */
export async function assertQuota(
  payload: Payload,
  tenantID: TenantID,
  resource: MeteredResource,
  n = 1,
  opts: { req?: Pick<PayloadRequest, 'user'>; now?: Date } = {},
): Promise<QuotaCheck> {
  const check = await checkQuota(payload, tenantID, resource, n, opts)
  if (!check.allowed) {
    throw new APIError(check.message!, 403, { code: ERROR_CODES.QUOTA_EXCEEDED, resource })
  }
  return check
}

export type PackRow = {
  id: string
  resource: PackResource
  units: number
  used: number
  expiresAt: string | null
  source: string
}

export type UsageSummary = {
  plan: Plan
  period: string
  used: Record<MeteredResource, number>
  /** Live pack balance per resource (zero for resources without packs). */
  packs: Record<MeteredResource, PackBalance>
  /** Live packs, soonest expiry first («Mis paquetes»). */
  packList: PackRow[]
}

/** Usage of every metered resource for the clinic's current period (owner plan page). */
export async function getUsageSummary(
  payload: Payload,
  tenantID: TenantID,
  opts: { now?: Date } = {},
): Promise<UsageSummary> {
  const { plan, timeZone } = await loadTenant(payload, tenantID)
  const now = opts.now ?? new Date()
  const used = Object.fromEntries(METERED_RESOURCES.map((r) => [r, 0])) as Record<MeteredResource, number>
  const periods = [...new Set(METERED_RESOURCES.map((r) => usagePeriod(r, now, timeZone)))]
  const rows = await counterModel(payload)
    .find({ tenant: String(tenantID), period: { $in: periods } })
    .lean()
  for (const row of rows) {
    const r = row.resource as MeteredResource
    // A row from another period (e.g. "total" is only valid for storage) is ignored.
    if (r in used && row.period === usagePeriod(r, now, timeZone)) used[r] = row.count ?? 0
  }

  const live = await livePacks(payload, tenantID, now)
  const packs = Object.fromEntries(METERED_RESOURCES.map((r) => [r, { ...NO_PACKS }])) as Record<
    MeteredResource,
    PackBalance
  >
  const packList: PackRow[] = []
  for (const p of live) {
    if (!isPackResource(p.resource)) continue
    const left = p.units - (p.used ?? 0)
    const expiresAt = p.expiresAt ? new Date(p.expiresAt).toISOString() : null
    packs[p.resource].remaining += left
    if (!packs[p.resource].nextExpiry) packs[p.resource].nextExpiry = expiresAt
    packList.push({ id: String(p._id), resource: p.resource, units: p.units, used: p.used ?? 0, expiresAt, source: p.source ?? 'gift' })
  }
  return { plan, period: usagePeriod('aiStudies', now, timeZone), used, packs, packList }
}

export type QuotaAlert = { resource: MeteredResource; level: 'near' | 'full'; message: string }

/** The most pressing quota notice for the dashboard strip (owner only), or null. */
export async function getQuotaAlert(
  payload: Payload,
  tenantID: TenantID,
  opts: { now?: Date } = {},
): Promise<QuotaAlert | null> {
  const s = await getUsageSummary(payload, tenantID, opts)
  let near: QuotaAlert | null = null
  for (const r of METERED_RESOURCES) {
    const st = quotaStatus(s.plan, r, s.used[r], s.packs[r])
    // A feature that is simply not in the plan is not an alert.
    if (!st.included || st.limit === null) continue
    if (st.atLimit && s.used[r] > 0) return { resource: r, level: 'full', message: quotaExceededMessage(s.plan, r, st) }
    if (st.near && !near) near = { resource: r, level: 'near', message: quotaNearMessage(r, st, s.period) }
  }
  return near
}
