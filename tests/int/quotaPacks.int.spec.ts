import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, seedFixture, type Fixture } from './fixtures'
import { ERROR_CODES } from '@/lib/constants'
import { packAllowed, quotaStatus, resetLabel } from '@/lib/plans'
import { assertQuota, checkQuota, getPackBalance, getQuotaAlert, getUsageSummary, recordUsage } from '@/lib/usage'

// Fase 2 — quotas of spec §2 (dictations, summaries, email reminders), quota packs
// (90 days, monthly quota first, soonest expiry next) and the 80 % / 100 % notices.

describe('Fase 2 — cuotas nuevas, paquetes y avisos', () => {
  let payload: Payload
  let f: Fixture

  beforeAll(async () => {
    payload = await getTestPayload()
  })
  beforeEach(async () => {
    f = await seedFixture(payload)
  })

  const setPlan = (tenantID: string | number, plan: string) =>
    payload.update({ collection: 'tenants', id: tenantID, data: { plan } as never, overrideAccess: true })

  const DAY = 86_400_000

  const givePack = (tenantID: string | number, resource: string, units: number, expiresAt?: Date) =>
    payload.create({
      collection: 'quotaPacks',
      data: { tenant: tenantID, resource, units, source: 'gift', ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}) } as never,
      user: f.superAdmin,
      overrideAccess: false,
    })

  const rawCounter = async (tenantID: string | number, resource: string) => {
    const model = (payload.db as unknown as { collections: Record<string, { findOne: (q: object) => { lean: () => Promise<Record<string, unknown> | null> } }> }).collections.usageCounters
    return model.findOne({ tenant: String(tenantID), resource }).lean()
  }

  async function rejectsWithCode(promise: Promise<unknown>, code?: string) {
    let thrown: { data?: { code?: string }; status?: number } | undefined
    try {
      await promise
    } catch (e) {
      thrown = e as typeof thrown
    }
    expect(thrown, 'expected a rejection').toBeDefined()
    if (code) expect(thrown!.data?.code).toBe(code)
    return thrown!
  }

  it('the spec §2 quotas exist per plan (dictations, summaries, email reminders only on Gratis)', async () => {
    await setPlan(f.a.tenant.id, 'free')
    expect((await checkQuota(payload, f.a.tenant.id, 'aiDictations')).limit).toBe(5)
    expect((await checkQuota(payload, f.a.tenant.id, 'aiSummaries')).limit).toBe(10)
    expect((await checkQuota(payload, f.a.tenant.id, 'emailReminders')).limit).toBe(100)
    await setPlan(f.a.tenant.id, 'clinic')
    expect((await checkQuota(payload, f.a.tenant.id, 'aiDictations')).limit).toBe(300)
    expect((await checkQuota(payload, f.a.tenant.id, 'aiSummaries')).limit).toBe(400)
    expect((await checkQuota(payload, f.a.tenant.id, 'emailReminders')).limit).toBeNull()
  })

  it('a pack adds units after the monthly quota is spent, and its expiry is 90 days by default', async () => {
    await setPlan(f.a.tenant.id, 'pro') // aiStudies 60/month
    await recordUsage(payload, f.a.tenant.id, 'aiStudies', 60)
    await rejectsWithCode(assertQuota(payload, f.a.tenant.id, 'aiStudies'), ERROR_CODES.QUOTA_EXCEEDED)

    const pack = await givePack(f.a.tenant.id, 'aiStudies', 50)
    const days = (new Date(pack.expiresAt as string).getTime() - Date.now()) / DAY
    expect(days).toBeGreaterThan(89.9)
    expect(days).toBeLessThan(90.1)
    expect(pack.used).toBe(0)

    const c = await checkQuota(payload, f.a.tenant.id, 'aiStudies', 50)
    expect(c).toMatchObject({ allowed: true, packRemaining: 50, atLimit: false, near: false })
    expect((await checkQuota(payload, f.a.tenant.id, 'aiStudies', 51)).allowed).toBe(false)

    await recordUsage(payload, f.a.tenant.id, 'aiStudies', 10)
    expect((await getPackBalance(payload, f.a.tenant.id, 'aiStudies')).remaining).toBe(40)
  })

  it('the monthly quota is spent first; a batch that straddles it charges only the overflow', async () => {
    await setPlan(f.a.tenant.id, 'pro')
    await givePack(f.a.tenant.id, 'aiStudies', 50)
    await recordUsage(payload, f.a.tenant.id, 'aiStudies', 55) // all from the month
    expect((await getPackBalance(payload, f.a.tenant.id, 'aiStudies')).remaining).toBe(50)
    await recordUsage(payload, f.a.tenant.id, 'aiStudies', 8) // 5 from the month, 3 from the pack
    expect((await getPackBalance(payload, f.a.tenant.id, 'aiStudies')).remaining).toBe(47)
  })

  it('the pack that expires soonest is spent first; expired packs do not count', async () => {
    await setPlan(f.a.tenant.id, 'pro') // whatsapp 500
    const late = await givePack(f.a.tenant.id, 'whatsappMessages', 500, new Date(Date.now() + 80 * DAY))
    const soon = await givePack(f.a.tenant.id, 'whatsappMessages', 100, new Date(Date.now() + 10 * DAY))
    await givePack(f.a.tenant.id, 'whatsappMessages', 999, new Date(Date.now() - DAY)) // expired

    expect((await getPackBalance(payload, f.a.tenant.id, 'whatsappMessages')).remaining).toBe(600)
    await recordUsage(payload, f.a.tenant.id, 'whatsappMessages', 500 + 120)

    const read = (id: string | number) => payload.findByID({ collection: 'quotaPacks', id, overrideAccess: true })
    expect((await read(soon.id)).used).toBe(100) // drained first
    expect((await read(late.id)).used).toBe(20)
    const bal = await getPackBalance(payload, f.a.tenant.id, 'whatsappMessages')
    expect(bal.remaining).toBe(480)
    expect(new Date(bal.nextExpiry!).getTime()).toBe(new Date(late.expiresAt as string).getTime())
  })

  it('concurrent usage never spends the same pack unit twice', async () => {
    await setPlan(f.a.tenant.id, 'pro')
    await recordUsage(payload, f.a.tenant.id, 'aiSummaries', 150) // monthly quota spent
    const pack = await givePack(f.a.tenant.id, 'aiSummaries', 200)
    await Promise.all(Array.from({ length: 20 }, () => recordUsage(payload, f.a.tenant.id, 'aiSummaries', 1)))
    const after = await payload.findByID({ collection: 'quotaPacks', id: pack.id, overrideAccess: true })
    expect(after.used).toBe(20)
  })

  it('Gratis cannot get WhatsApp packs (not in the plan); unlimited resources take none', () => {
    expect(packAllowed('free', 'whatsappMessages')).toBe(false)
    expect(packAllowed('free', 'aiDictations')).toBe(true)
    expect(packAllowed('public', 'aiStudies')).toBe(false)
    expect(packAllowed('pro', 'emailReminders')).toBe(false) // not a pack resource
  })

  it('only the super admin creates packs; a clinic reads its own and nobody else’s', async () => {
    await rejectsWithCode(
      payload.create({
        collection: 'quotaPacks',
        data: { tenant: f.a.tenant.id, resource: 'aiStudies', units: 1000, source: 'gift' } as never,
        user: f.a.owner,
        overrideAccess: false,
      }),
    )
    const pack = await givePack(f.a.tenant.id, 'aiStudies', 50)
    const mine = await payload.find({ collection: 'quotaPacks', user: f.a.owner, overrideAccess: false })
    expect(mine.docs.map((d) => d.id)).toEqual([pack.id])
    const theirs = await payload.find({ collection: 'quotaPacks', user: f.b.owner, overrideAccess: false })
    expect(theirs.totalDocs).toBe(0)
    await rejectsWithCode(
      payload.update({ collection: 'quotaPacks', id: pack.id, data: { units: 5000 } as never, user: f.a.owner, overrideAccess: false }),
    )
  })

  it('`used` cannot be set by hand and non-pack resources are refused', async () => {
    const pack = await payload.create({
      collection: 'quotaPacks',
      data: { tenant: f.a.tenant.id, resource: 'aiStudies', units: 50, used: 49, source: 'admin' } as never,
      user: f.superAdmin,
      overrideAccess: false,
    })
    expect(pack.used).toBe(0)
    const upd = await payload.update({
      collection: 'quotaPacks',
      id: pack.id,
      data: { used: 50 } as never,
      user: f.superAdmin,
      overrideAccess: false,
    })
    expect(upd.used).toBe(0)
    await rejectsWithCode(givePack(f.a.tenant.id, 'storageBytes', 10), ERROR_CODES.VALIDATION)
  })

  it('a new pack is audited in the clinic’s log', async () => {
    const pack = await givePack(f.a.tenant.id, 'aiDictations', 100)
    const logs = await payload.find({
      collection: 'auditLogs',
      where: { and: [{ action: { equals: 'quota.pack-added' } }, { targetId: { equals: String(pack.id) } }] },
      overrideAccess: true,
    })
    expect(logs.totalDocs).toBe(1)
    expect(String((logs.docs[0]!.tenant as { id?: unknown })?.id ?? logs.docs[0]!.tenant)).toBe(String(f.a.tenant.id))
  })

  it('80 % and 100 % notices are claimed once per period', async () => {
    await setPlan(f.a.tenant.id, 'free') // aiDictations 5
    await recordUsage(payload, f.a.tenant.id, 'aiDictations', 3)
    expect((await rawCounter(f.a.tenant.id, 'aiDictations'))?.notified80At ?? null).toBeNull()
    await recordUsage(payload, f.a.tenant.id, 'aiDictations', 1) // 4/5 = 80 %
    const at80 = (await rawCounter(f.a.tenant.id, 'aiDictations'))?.notified80At
    expect(at80).toBeTruthy()
    expect((await rawCounter(f.a.tenant.id, 'aiDictations'))?.notified100At ?? null).toBeNull()
    await recordUsage(payload, f.a.tenant.id, 'aiDictations', 1) // 5/5
    const row = await rawCounter(f.a.tenant.id, 'aiDictations')
    expect(row?.notified100At).toBeTruthy()
    expect(new Date(row!.notified80At as string).getTime()).toBe(new Date(at80 as string).getTime()) // not re-sent
  })

  it('dashboard alert: the 100 % one wins over an 80 % one; a feature not in the plan is no alert', async () => {
    await setPlan(f.a.tenant.id, 'free')
    expect(await getQuotaAlert(payload, f.a.tenant.id)).toBeNull() // WhatsApp 0/0 is "not included", not an alert
    await recordUsage(payload, f.a.tenant.id, 'aiSummaries', 8) // 80 %
    let alert = await getQuotaAlert(payload, f.a.tenant.id)
    expect(alert).toMatchObject({ resource: 'aiSummaries', level: 'near' })
    expect(alert!.message).toMatch(/^Va por el 80 % de sus resúmenes con IA de este mes \(8 de 10\)\. Se reinician el 1 de /)
    await recordUsage(payload, f.a.tenant.id, 'aiDictations', 5) // 100 %
    alert = await getQuotaAlert(payload, f.a.tenant.id)
    expect(alert).toMatchObject({ resource: 'aiDictations', level: 'full' })
    expect(alert!.message).toContain('Se agotó su cuota de consultas dictadas con IA de este mes')
  })

  it('usage summary lists live packs for «Mis paquetes»', async () => {
    await setPlan(f.a.tenant.id, 'pro')
    await givePack(f.a.tenant.id, 'aiStudies', 50)
    await givePack(f.a.tenant.id, 'aiStudies', 50, new Date(Date.now() - DAY)) // expired: hidden
    const s = await getUsageSummary(payload, f.a.tenant.id)
    expect(s.packList).toHaveLength(1)
    expect(s.packs.aiStudies.remaining).toBe(50)
    expect(quotaStatus('pro', 'aiStudies', 60, s.packs.aiStudies)).toMatchObject({ atLimit: false, packRemaining: 50 })
  })

  it('reset label names the first day of the next month', () => {
    expect(resetLabel('2026-11')).toBe('1 de diciembre')
    expect(resetLabel('2026-12')).toBe('1 de enero')
  })
})
