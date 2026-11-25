// Usage metering (roadmap B1) — the server side of the metered quotas defined in
// src/lib/plans.ts. Later phases call these helpers; nothing consumes quota yet:
//
//   B3 WhatsApp:  await assertQuota(payload, tenantID, 'whatsappMessages', 1, { req })
//                 …send the message; only after Meta accepts it:
//                 await recordUsage(payload, tenantID, 'whatsappMessages', 1, req)
//   B4 AI study:  same pattern with 'aiStudies' (count only successful drafts).
//   B2 storage:   recordUsage(…, 'storageBytes', +file.size) on upload and
//                 recordUsage(…, 'storageBytes', -file.size) on delete.
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
import {
  METERED_RESOURCES,
  asPlan,
  isMonthlyResource,
  quotaAllows,
  quotaExceededMessage,
  quotaStatus,
  usagePeriod,
  type MeteredResource,
  type Plan,
  type QuotaStatus,
} from '@/lib/plans'

type TenantID = string | number

/** Minimal mongoose-model surface we use (the adapter exposes one per collection). */
type CounterModel = {
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => { lean: () => Promise<{ count?: number } | null> } | Promise<{ count?: number } | null>
  find: (filter: Record<string, unknown>) => { lean: () => Promise<Array<{ resource: string; count?: number }>> }
}

function counterModel(payload: Payload): CounterModel {
  const model = (payload.db as unknown as { collections?: Record<string, CounterModel> }).collections?.usageCounters
  if (!model) throw new Error('usageCounters model unavailable (is the mongoose adapter in use?)')
  return model
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
  const { timeZone } = await loadTenant(payload, tenantID) // also 404s on an unknown tenant
  const period = usagePeriod(resource, opts.now ?? new Date(), timeZone)
  const model = counterModel(payload)
  const filter = { tenant: String(tenantID), period, resource }
  const update = { $inc: { count: n } }

  for (let attempt = 0; ; attempt++) {
    try {
      const q = model.findOneAndUpdate(filter, update, { upsert: true, new: true, setDefaultsOnInsert: false })
      const doc = await ('lean' in q ? q.lean() : q)
      return doc?.count ?? n
    } catch (err) {
      const dup = (err as { code?: number }).code === 11000
      if (!dup || attempt >= 3) throw err
    }
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
  /** Whether `n` more units fit in the quota. */
  allowed: boolean
  /** Spanish refusal text when `allowed` is false. */
  message: string | null
}

/** Read-only: would `n` more units of `resource` fit in the clinic's plan quota? */
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
  const status = quotaStatus(plan, resource, used)
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

/** Usage of every metered resource for the clinic's current period (owner plan page). */
export async function getUsageSummary(
  payload: Payload,
  tenantID: TenantID,
  opts: { now?: Date } = {},
): Promise<{ plan: Plan; period: string; used: Record<MeteredResource, number> }> {
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
    if (r in used && (row as { period?: string }).period === usagePeriod(r, now, timeZone)) used[r] = row.count ?? 0
  }
  return { plan, period: usagePeriod('aiStudies', now, timeZone), used }
}
