import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, seedFixture, type Fixture } from './fixtures'
import { ERROR_CODES } from '@/lib/constants'
import {
  bookableDates,
  bookOnline,
  freeSlots,
  getPublicClinic,
  requestOnline,
  type PublicClinic,
} from '@/lib/publicBooking'

// Public online booking (/agendar/<slug>). Clinic A's doctor works Mon–Fri
// 08:00–12:00 (Santo Domingo, UTC-4) with 20-minute appointments. "Now" is pinned
// to Monday 2030-01-07 08:00 local so lead time and the 30-day window are stable.
const NOW = new Date('2030-01-07T12:00:00Z')
const MON = '2030-01-07'
const TUE = '2030-01-08'
const SAT = '2030-01-12'

const contact = { name: 'María Pérez', phone: '809-555-1234', gender: 'female', ageYears: 34 }

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (err) {
    return (err as { data?: { code?: string } }).data?.code
  }
  return null
}

describe('public online booking', () => {
  let payload: Payload
  let f: Fixture
  let clinic: PublicClinic

  beforeAll(async () => {
    payload = await getTestPayload()
  })

  beforeEach(async () => {
    f = await seedFixture(payload)
    await payload.update({
      collection: 'users',
      id: f.a.doctor.id,
      overrideAccess: true,
      data: {
        availabilityType: 'regular',
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        availableFrom: '08:00',
        availableTo: '12:00',
      } as never,
    })
    await payload.update({
      collection: 'tenants',
      id: f.a.tenant.id,
      overrideAccess: true,
      data: { slug: 'clinica-a', settings: { appointmentDurationMins: 20, timezone: 'America/Santo_Domingo' } } as never,
    })
    clinic = (await getPublicClinic(payload, 'clinica-a'))!
  })

  it('publishes an active clinic with its scheduled doctors only', async () => {
    expect(clinic.name).toBe('City Care Clinic')
    expect(clinic.doctors.map((d) => d.id)).toEqual([String(f.a.doctor.id)])
    expect(await getPublicClinic(payload, 'no-existe')).toBeNull()
  })

  it('is hidden when the clinic turns online booking off or is suspended', async () => {
    await payload.update({ collection: 'tenants', id: f.a.tenant.id, overrideAccess: true, data: { settings: { onlineBookingEnabled: false } } as never })
    expect(await getPublicClinic(payload, 'clinica-a')).toBeNull()
    await payload.update({ collection: 'tenants', id: f.a.tenant.id, overrideAccess: true, data: { status: 'suspended', settings: { onlineBookingEnabled: true } } as never })
    expect(await getPublicClinic(payload, 'clinica-a')).toBeNull()
  })

  it('offers only working days within the next 30 days', () => {
    const dates = bookableDates(clinic, clinic.doctors[0], NOW)
    expect(dates[0]).toBe(MON)
    expect(dates).toContain(TUE)
    expect(dates).not.toContain(SAT)
    expect(dates.every((d) => d <= '2030-02-06')).toBe(true)
  })

  it('lists slots inside the schedule, after the 2-hour notice', async () => {
    const tuesday = await freeSlots(payload, clinic, String(f.a.doctor.id), TUE, NOW)
    expect(tuesday).toEqual(['08:00', '08:20', '08:40', '09:00', '09:20', '09:40', '10:00', '10:20', '10:40', '11:00', '11:20', '11:40'])
    // Today at 08:00 local: nothing before 10:00.
    const today = await freeSlots(payload, clinic, String(f.a.doctor.id), MON, NOW)
    expect(today[0]).toBe('10:00')
    expect(await freeSlots(payload, clinic, String(f.a.doctor.id), SAT, NOW)).toEqual([])
  })

  it('books a free slot (confirmed, marked online) and removes it from the list', async () => {
    const res = await bookOnline(payload, clinic, { ...contact, doctorId: String(f.a.doctor.id), date: TUE, time: '09:00', reason: 'Control' }, NOW)
    const appt = await payload.findByID({ collection: 'appointments', id: res.appointmentId, overrideAccess: true, depth: 0 })
    expect(appt.status).toBe('scheduled')
    expect(appt.source).toBe('online')
    expect(String(appt.tenant)).toBe(String(f.a.tenant.id))
    expect(await freeSlots(payload, clinic, String(f.a.doctor.id), TUE, NOW)).not.toContain('09:00')

    // The same slot cannot be taken twice.
    const again = bookOnline(payload, clinic, { ...contact, name: 'Otra Persona', doctorId: String(f.a.doctor.id), date: TUE, time: '09:00' }, NOW)
    expect(await codeOf(again)).toBe(ERROR_CODES.SLOT_TAKEN)
  })

  it('rejects times outside the schedule or the notice period', async () => {
    const outside = bookOnline(payload, clinic, { ...contact, doctorId: String(f.a.doctor.id), date: TUE, time: '13:00' }, NOW)
    expect(await codeOf(outside)).toBe(ERROR_CODES.SLOT_TAKEN)
    const tooSoon = bookOnline(payload, clinic, { ...contact, doctorId: String(f.a.doctor.id), date: MON, time: '08:20' }, NOW)
    expect(await codeOf(tooSoon)).toBe(ERROR_CODES.SLOT_TAKEN)
  })

  it('reuses an existing patient by phone + name, and keeps family members apart', async () => {
    await bookOnline(payload, clinic, { ...contact, doctorId: String(f.a.doctor.id), date: TUE, time: '08:00' }, NOW)
    await bookOnline(payload, clinic, { ...contact, name: 'maria  perez', doctorId: String(f.a.doctor.id), date: TUE, time: '08:20' }, NOW)
    await bookOnline(payload, clinic, { ...contact, name: 'Juan Pérez', gender: 'male', doctorId: String(f.a.doctor.id), date: TUE, time: '08:40' }, NOW)
    const patients = await payload.find({
      collection: 'patients',
      where: { tenant: { equals: f.a.tenant.id }, phone: { equals: '8095551234' } },
      overrideAccess: true,
    })
    expect(patients.docs.map((p) => p.name).sort()).toEqual(['Juan Pérez', 'María Pérez'])
  })

  it('validates the contact data', async () => {
    const bad = bookOnline(payload, clinic, { ...contact, phone: '123', doctorId: String(f.a.doctor.id), date: TUE, time: '08:00' }, NOW)
    expect(await codeOf(bad)).toBe(ERROR_CODES.VALIDATION)
  })

  it('accepts extra / emergency requests only when the clinic enables them', async () => {
    const input = { ...contact, reason: 'Dolor fuerte desde ayer', urgent: true }
    expect(await codeOf(requestOnline(payload, clinic, input))).toBe(ERROR_CODES.VALIDATION)

    await payload.update({ collection: 'tenants', id: f.a.tenant.id, overrideAccess: true, data: { settings: { onlineRequestsEnabled: true } } as never })
    const enabled = (await getPublicClinic(payload, 'clinica-a'))!
    const { requestId } = await requestOnline(payload, enabled, input)
    const req = await payload.findByID({ collection: 'bookingRequests', id: requestId, overrideAccess: true, depth: 0 })
    expect(req.status).toBe('pending')
    expect(req.urgent).toBe(true)

    // Clinic B never sees clinic A's requests.
    const asB = await payload.find({ collection: 'bookingRequests', user: f.b.owner, overrideAccess: false })
    expect(asB.totalDocs).toBe(0)
  })
})
