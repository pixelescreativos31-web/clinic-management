import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, seedFixture, type Fixture } from './fixtures'
import { ERROR_CODES } from '@/lib/constants'
import { assertQuota, checkQuota, getUsageSummary, getUsed, recordUsage } from '@/lib/usage'

// Roadmap B1 — usage metering against a real Mongo (replica set). The shared
// fixture puts both clinics on `plus`; each test sets the plan it exercises.

describe('B1 — usage counters and metered quotas', () => {
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

  const NOV_LAST_2330_DR = new Date('2026-12-01T03:30:00Z') // Nov 30 23:30 in Santo Domingo
  const DEC_FIRST_0000_DR = new Date('2026-12-01T04:00:00Z')

  async function rejectsWithCode(promise: Promise<unknown>, code: string) {
    let thrown: { data?: { code?: string }; status?: number; message?: string } | undefined
    try {
      await promise
    } catch (e) {
      thrown = e as typeof thrown
    }
    expect(thrown, 'expected a rejection').toBeDefined()
    expect(thrown!.data?.code).toBe(code)
    return thrown!
  }

  it('records usage atomically and reads it back through Payload (tenant relation stored as an id)', async () => {
    expect(await recordUsage(payload, f.a.tenant.id, 'aiStudies', 1)).toBe(1)
    expect(await recordUsage(payload, f.a.tenant.id, 'aiStudies', 2)).toBe(3)

    const { docs } = await payload.find({
      collection: 'usageCounters',
      where: { tenant: { equals: f.a.tenant.id } },
      overrideAccess: true,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({ resource: 'aiStudies', count: 3 })
    expect(docs[0]!.period).toMatch(/^\d{4}-\d{2}$/)
  })

  it('concurrent increments never lose a unit and never duplicate the counter', async () => {
    await Promise.all(Array.from({ length: 40 }, () => recordUsage(payload, f.a.tenant.id, 'whatsappMessages', 1)))
    expect(await getUsed(payload, f.a.tenant.id, 'whatsappMessages')).toBe(40)
    const { totalDocs } = await payload.count({
      collection: 'usageCounters',
      where: { and: [{ tenant: { equals: f.a.tenant.id } }, { resource: { equals: 'whatsappMessages' } }] },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(1)

    // The guarantee rests on the unique (tenant, period, resource) index.
    const native = (payload.db as unknown as { collections: Record<string, { collection: { indexes: () => Promise<Array<{ key: object; unique?: boolean }>> } }> })
      .collections.usageCounters!.collection
    const idx = await native.indexes()
    expect(idx.some((i) => JSON.stringify(i.key) === JSON.stringify({ tenant: 1, period: 1, resource: 1 }) && i.unique)).toBe(true)
  })

  it('month rollover in the clinic timezone: Nov 30 23:30 local counts for November', async () => {
    await recordUsage(payload, f.a.tenant.id, 'aiStudies', 5, undefined, { now: NOV_LAST_2330_DR })
    await recordUsage(payload, f.a.tenant.id, 'aiStudies', 2, undefined, { now: DEC_FIRST_0000_DR })

    expect(await getUsed(payload, f.a.tenant.id, 'aiStudies', { now: NOV_LAST_2330_DR })).toBe(5)
    expect(await getUsed(payload, f.a.tenant.id, 'aiStudies', { now: DEC_FIRST_0000_DR })).toBe(2)

    const nov = await getUsageSummary(payload, f.a.tenant.id, { now: NOV_LAST_2330_DR })
    expect(nov.period).toBe('2026-11')
    expect(nov.used.aiStudies).toBe(5)
    const dec = await getUsageSummary(payload, f.a.tenant.id, { now: DEC_FIRST_0000_DR })
    expect(dec.period).toBe('2026-12')
    expect(dec.used.aiStudies).toBe(2) // a new month starts from its own count
  })

  it('storage is a running total across months; deletes subtract', async () => {
    const MB = 1024 ** 2
    await recordUsage(payload, f.a.tenant.id, 'storageBytes', 300 * MB, undefined, { now: NOV_LAST_2330_DR })
    await recordUsage(payload, f.a.tenant.id, 'storageBytes', -100 * MB, undefined, { now: DEC_FIRST_0000_DR })
    const s = await getUsageSummary(payload, f.a.tenant.id, { now: DEC_FIRST_0000_DR })
    expect(s.used.storageBytes).toBe(200 * MB)
  })

  it('rejects bad amounts: fractional, and negative for monthly resources', async () => {
    await expect(recordUsage(payload, f.a.tenant.id, 'aiStudies', 1.5)).rejects.toThrow(/integer/)
    await expect(recordUsage(payload, f.a.tenant.id, 'aiStudies', -1)).rejects.toThrow(/cannot decrease/)
    await expect(recordUsage(payload, f.a.tenant.id, 'bogus' as never, 1)).rejects.toThrow(/unknown resource/)
  })

  it('soft cap: allowed up to the quota, then only the metered action is refused', async () => {
    await setPlan(f.a.tenant.id, 'free') // 10 AI studies / month
    await recordUsage(payload, f.a.tenant.id, 'aiStudies', 7)
    let c = await checkQuota(payload, f.a.tenant.id, 'aiStudies')
    expect(c).toMatchObject({ used: 7, limit: 10, near: false, allowed: true })

    await recordUsage(payload, f.a.tenant.id, 'aiStudies', 1) // 8 → 80%
    c = await checkQuota(payload, f.a.tenant.id, 'aiStudies')
    expect(c).toMatchObject({ used: 8, near: true, atLimit: false, allowed: true })
    expect((await checkQuota(payload, f.a.tenant.id, 'aiStudies', 3)).allowed).toBe(false) // batch of 3 overshoots

    await recordUsage(payload, f.a.tenant.id, 'aiStudies', 2) // 10 → 100%
    const err = await rejectsWithCode(assertQuota(payload, f.a.tenant.id, 'aiStudies'), ERROR_CODES.QUOTA_EXCEEDED)
    expect(err.status).toBe(403)
    expect(err.message).toContain('expedientes siguen disponibles')

    // …and care is not blocked: the owner still edits and registers patients.
    const edited = await payload.update({
      collection: 'patients',
      id: f.a.patient.id,
      data: { name: 'Patient A editado' } as never,
      overrideAccess: false,
      user: f.a.owner,
    })
    expect(edited.name).toBe('Patient A editado')
    const created = await payload.create({
      collection: 'patients',
      overrideAccess: false,
      user: f.a.owner,
      data: { name: 'Nuevo', phone: '8095550000', gender: 'female', ageYears: 40 } as never,
    })
    expect(created.id).toBeDefined()
  })

  it('WhatsApp on the free plan is not included: refused from the first message', async () => {
    await setPlan(f.a.tenant.id, 'free')
    const err = await rejectsWithCode(
      assertQuota(payload, f.a.tenant.id, 'whatsappMessages'),
      ERROR_CODES.QUOTA_EXCEEDED,
    )
    expect(err.message).toContain('no incluye mensajes de WhatsApp')
  })

  it('downgrade leaves the clinic over quota: usage kept, shown as over, further sends refused', async () => {
    await recordUsage(payload, f.a.tenant.id, 'whatsappMessages', 1500) // on plus (2,000)
    expect((await checkQuota(payload, f.a.tenant.id, 'whatsappMessages')).allowed).toBe(true)

    await setPlan(f.a.tenant.id, 'pro') // 500
    const c = await checkQuota(payload, f.a.tenant.id, 'whatsappMessages')
    expect(c).toMatchObject({ used: 1500, limit: 500, over: 1000, atLimit: true, allowed: false, plan: 'pro' })
    expect(await getUsed(payload, f.a.tenant.id, 'whatsappMessages')).toBe(1500) // nothing reset or lost
  })

  it('unlimited (public) and unknown plan values', async () => {
    await setPlan(f.a.tenant.id, 'public')
    await recordUsage(payload, f.a.tenant.id, 'aiStudies', 10_000)
    expect(await checkQuota(payload, f.a.tenant.id, 'aiStudies')).toMatchObject({ limit: null, allowed: true })

    // A plan value outside the select (legacy/corrupted row) falls back to free.
    const tenants = (
      payload.db as unknown as {
        collections: Record<string, { updateOne: (f: object, u: object) => Promise<{ modifiedCount: number }> }>
      }
    ).collections.tenants!
    const res = await tenants.updateOne({ _id: f.b.tenant.id }, { $set: { plan: 'toString' } })
    expect(res.modifiedCount).toBe(1)
    const c = await checkQuota(payload, f.b.tenant.id, 'aiStudies')
    expect(c).toMatchObject({ plan: 'free', limit: 10 })
  })

  describe('tenant isolation', () => {
    it('clinic A reads only its own counters; B is invisible', async () => {
      await recordUsage(payload, f.a.tenant.id, 'aiStudies', 3)
      await recordUsage(payload, f.b.tenant.id, 'aiStudies', 9)

      for (const user of [f.a.owner, f.a.doctor, f.a.receptionist]) {
        const { docs } = await payload.find({ collection: 'usageCounters', overrideAccess: false, user })
        expect(docs).toHaveLength(1)
        expect(docs[0]!.count).toBe(3)
      }
      const bRow = (
        await payload.find({ collection: 'usageCounters', where: { tenant: { equals: f.b.tenant.id } }, overrideAccess: true })
      ).docs[0]!
      await expect(
        payload.findByID({ collection: 'usageCounters', id: bRow.id, overrideAccess: false, user: f.a.owner }),
      ).rejects.toThrow()
    })

    it('nobody can create, edit or delete counters through Payload (not even an owner for their own clinic)', async () => {
      await recordUsage(payload, f.a.tenant.id, 'aiStudies', 3)
      const row = (await payload.find({ collection: 'usageCounters', overrideAccess: true })).docs[0]!

      await expect(
        payload.create({
          collection: 'usageCounters',
          overrideAccess: false,
          user: f.a.owner,
          data: { tenant: f.a.tenant.id, period: '2026-11', resource: 'aiStudies', count: 0 } as never,
        }),
      ).rejects.toThrow()
      await expect(
        payload.update({ collection: 'usageCounters', id: row.id, data: { count: 0 } as never, overrideAccess: false, user: f.a.owner }),
      ).rejects.toThrow()
      await expect(
        payload.delete({ collection: 'usageCounters', id: row.id, overrideAccess: false, user: f.a.owner }),
      ).rejects.toThrow()
      await expect(
        payload.update({ collection: 'usageCounters', id: row.id, data: { count: 0 } as never, overrideAccess: false, user: f.superAdmin }),
      ).rejects.toThrow()
      expect(await getUsed(payload, f.a.tenant.id, 'aiStudies')).toBe(3)
    })

    it("a clinic user cannot increment or check another clinic's quota", async () => {
      await rejectsWithCode(
        recordUsage(payload, f.b.tenant.id, 'aiStudies', 1, { user: f.a.owner }),
        ERROR_CODES.FORBIDDEN,
      )
      await rejectsWithCode(checkQuota(payload, f.b.tenant.id, 'aiStudies', 1, { req: { user: f.a.doctor } }), ERROR_CODES.FORBIDDEN)
      expect(await getUsed(payload, f.b.tenant.id, 'aiStudies')).toBe(0)

      // Own clinic works; system jobs (no user) and super admin may meter any clinic.
      expect(await recordUsage(payload, f.a.tenant.id, 'aiStudies', 1, { user: f.a.owner })).toBe(1)
      expect(await recordUsage(payload, f.b.tenant.id, 'aiStudies', 1)).toBe(1)
      expect(await recordUsage(payload, f.b.tenant.id, 'aiStudies', 1, { user: f.superAdmin })).toBe(2)
      expect(await getUsed(payload, f.a.tenant.id, 'aiStudies')).toBe(1)
    })

    it('an unknown tenant id is rejected instead of creating an orphan counter', async () => {
      await expect(recordUsage(payload, '000000000000000000000000', 'aiStudies', 1)).rejects.toThrow()
      expect((await payload.count({ collection: 'usageCounters', overrideAccess: true })).totalDocs).toBe(0)
    })
  })
})
