import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, seedFixture, type Fixture } from './fixtures'

// v2 clinical-loop suite — Visits (consultation) and Invoices (billing math, payments,
// void/lock rules, currency snapshot) exercised end-to-end through the collection hooks.

const iso = (h: number, m = 0) => new Date(Date.UTC(2026, 5, 15, h, m)).toISOString()

describe('v2 — visits & invoices', () => {
  let payload: Payload
  let f: Fixture

  beforeAll(async () => {
    payload = await getTestPayload()
  })
  beforeEach(async () => {
    f = await seedFixture(payload)
  })

  /** Create an appointment for clinic A in the given status. */
  const appt = (status: string, over: Record<string, unknown> = {}) =>
    payload.create({
      collection: 'appointments',
      overrideAccess: true,
      data: {
        tenant: f.a.tenant.id,
        patient: f.a.patient.id,
        doctor: f.a.doctor.id,
        start: iso(10),
        durationMins: 30,
        status,
        ...over,
      } as never,
    })

  const recordVisit = (appointmentId: string, user = f.a.doctor, over: Record<string, unknown> = {}) =>
    payload.create({
      collection: 'visits',
      overrideAccess: false,
      user,
      data: { appointment: appointmentId, diagnosis: 'Viral fever', ...over } as never,
    })

  // ---------------- Visits ----------------

  it('records a visit on a checked-in appointment and auto-completes it', async () => {
    const a = await appt('checked-in')
    const visit = await recordVisit(String(a.id))
    expect(visit.id).toBeTruthy()
    const pid = (v: unknown) => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : String(v))
    expect(pid((visit as { patient: unknown }).patient)).toBe(String(f.a.patient.id))

    const after = await payload.findByID({ collection: 'appointments', id: a.id, overrideAccess: true })
    expect(after.status).toBe('completed')
  })

  it('rejects a visit on a scheduled (not checked-in) appointment', async () => {
    const a = await appt('scheduled')
    await expect(recordVisit(String(a.id))).rejects.toThrow()
  })

  it('rejects a second visit for the same appointment', async () => {
    const a = await appt('checked-in')
    await recordVisit(String(a.id))
    await expect(recordVisit(String(a.id))).rejects.toThrow()
  })

  it('forbids a receptionist from recording a visit, allows a doctor', async () => {
    const a1 = await appt('checked-in')
    await expect(recordVisit(String(a1.id), f.a.receptionist)).rejects.toThrow()
    // a fresh checked-in appointment for the doctor path
    const a2 = await appt('checked-in', { start: iso(11) })
    const ok = await recordVisit(String(a2.id), f.a.doctor)
    expect(ok.id).toBeTruthy()
  })

  it('forbids recording a visit on another clinic’s appointment', async () => {
    const a = await appt('checked-in')
    // clinic B's doctor tries to attach a visit to clinic A's appointment
    await expect(recordVisit(String(a.id), f.b.doctor)).rejects.toThrow()
  })

  // ---------------- Invoices: math ----------------

  const newInvoice = (over: Record<string, unknown> = {}) =>
    payload.create({
      collection: 'invoices',
      overrideAccess: true,
      data: {
        tenant: f.a.tenant.id,
        patient: f.a.patient.id,
        lineItems: [
          { description: 'Consultation', quantity: 1, unitAmount: 1500 },
          { description: 'Dressing', quantity: 2, unitAmount: 250 },
        ],
        totalAmount: 999999, // client lie — must be ignored
        ...over,
      } as never,
    })

  it('computes line amounts and total, ignoring any client-sent total', async () => {
    const inv = await newInvoice()
    expect(inv.totalAmount).toBe(2000) // 1500 + 2×250
    expect(inv.amountPaid).toBe(0)
    expect(inv.balanceDue).toBe(2000)
    expect(inv.paymentStatus).toBe('unpaid')
    expect(inv.invoiceNumber).toMatch(/^FAC-\d{4}$/)
    expect((inv.lineItems as { amount: number }[])[1].amount).toBe(500)
  })

  it('auto-numbers invoices per clinic (FAC-0001, FAC-0002)', async () => {
    const a = await newInvoice()
    const b = await newInvoice()
    expect(a.invoiceNumber).toBe('FAC-0001')
    expect(b.invoiceNumber).toBe('FAC-0002')
  })

  it('moves status unpaid → partial → paid as payments are recorded', async () => {
    const inv = await newInvoice()
    const partial = await payload.update({
      collection: 'invoices',
      id: inv.id,
      overrideAccess: true,
      data: { payments: [{ amount: 500, method: 'cash' }] } as never,
    })
    expect(partial.amountPaid).toBe(500)
    expect(partial.balanceDue).toBe(1500)
    expect(partial.paymentStatus).toBe('partial')

    const paid = await payload.update({
      collection: 'invoices',
      id: inv.id,
      overrideAccess: true,
      data: { payments: [{ amount: 500, method: 'cash' }, { amount: 1500, method: 'card' }] } as never,
    })
    expect(paid.amountPaid).toBe(2000)
    expect(paid.balanceDue).toBe(0)
    expect(paid.paymentStatus).toBe('paid')
  })

  it('rejects an overpayment', async () => {
    const inv = await newInvoice()
    await expect(
      payload.update({
        collection: 'invoices',
        id: inv.id,
        overrideAccess: true,
        data: { payments: [{ amount: 5000, method: 'cash' }] } as never,
      }),
    ).rejects.toThrow()
  })

  it('locks line items once a payment exists', async () => {
    const inv = await newInvoice()
    await payload.update({
      collection: 'invoices',
      id: inv.id,
      overrideAccess: true,
      data: { payments: [{ amount: 500, method: 'cash' }] } as never,
    })
    await expect(
      payload.update({
        collection: 'invoices',
        id: inv.id,
        overrideAccess: true,
        data: { lineItems: [{ description: 'Changed', quantity: 1, unitAmount: 9999 }] } as never,
      }),
    ).rejects.toThrow()
  })

  // ---------------- Invoices: void ----------------

  it('lets the owner void with a reason, then rejects further payments', async () => {
    const inv = await newInvoice()
    const voided = await payload.update({
      collection: 'invoices',
      id: inv.id,
      overrideAccess: false,
      user: f.a.owner,
      data: { voided: true, voidReason: 'Billed in error' } as never,
    })
    expect(voided.voided).toBe(true)
    await expect(
      payload.update({
        collection: 'invoices',
        id: inv.id,
        overrideAccess: false,
        user: f.a.owner,
        data: { payments: [{ amount: 100, method: 'cash' }] } as never,
      }),
    ).rejects.toThrow()
  })

  it('requires a reason to void', async () => {
    const inv = await newInvoice()
    await expect(
      payload.update({
        collection: 'invoices',
        id: inv.id,
        overrideAccess: false,
        user: f.a.owner,
        data: { voided: true } as never,
      }),
    ).rejects.toThrow()
  })

  // ---------------- Invoices: currency snapshot ----------------

  it('snapshots the clinic currency and keeps it after a later currency change', async () => {
    const inv = await newInvoice()
    expect(inv.currency).toBe('DOP')

    await payload.update({
      collection: 'tenants',
      id: f.a.tenant.id,
      overrideAccess: true,
      data: { settings: { ...(f.a.tenant.settings ?? {}), currency: 'USD' } } as never,
    })

    const reread = await payload.findByID({ collection: 'invoices', id: inv.id, overrideAccess: true })
    expect(reread.currency).toBe('DOP') // historical amount keeps its original currency
  })

  // ---------------- Invoices: tenant isolation ----------------

  it('does not let one clinic read another clinic’s invoice', async () => {
    const inv = await newInvoice()
    const asB = await payload
      .findByID({ collection: 'invoices', id: inv.id, overrideAccess: false, user: f.b.owner })
      .catch(() => null)
    expect(asB).toBeNull()
  })
})
