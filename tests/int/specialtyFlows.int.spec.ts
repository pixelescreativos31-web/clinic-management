import { describe, it, expect, beforeAll } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, seedFixture, wipe, type Fixture } from './fixtures'
import { signupClinic } from '@/lib/signup'
import { ERROR_CODES } from '@/lib/constants'

// A0 — specialty profiles end to end: the server refuses formats outside the
// professional's specialty / clinic profile (flow and counter-flows), legacy
// visits stay editable, and signup stores both profile axes.

async function rejectsWithCode(promise: Promise<unknown>, code: string) {
  let thrown: { data?: { code?: string }; code?: string } | undefined
  try {
    await promise
  } catch (e) {
    thrown = e as typeof thrown
  }
  expect(thrown, 'expected the operation to reject').toBeTruthy()
  expect(thrown?.data?.code ?? thrown?.code).toBe(code)
}

describe('A0 — visit format guard', () => {
  let payload: Payload
  let f: Fixture
  let slot = 0
  const nextStart = () => new Date(Date.UTC(2033, 4, 2, 13, 0) + slot++ * 3600000).toISOString()

  const checkedIn = async () =>
    payload.create({
      collection: 'appointments',
      overrideAccess: true,
      data: { tenant: f.a.tenant.id, patient: f.a.patient.id, doctor: f.a.doctor.id, start: nextStart(), durationMins: 20, status: 'checked-in', isWalkIn: true } as never,
    })

  const visit = async (data: Record<string, unknown>, user: unknown = f.a.doctor) => {
    const appt = await checkedIn()
    return payload.create({ collection: 'visits', overrideAccess: false, user: user as never, data: { appointment: appt.id, chiefComplaint: 'Control', diagnosis: 'Dx', ...data } as never })
  }

  const setDoctorSpecialty = (specialtyKey: string | null) =>
    payload.update({ collection: 'users', id: f.a.doctor.id, data: { specialtyKey } as never, overrideAccess: true })

  const doctor = async () => payload.findByID({ collection: 'users', id: f.a.doctor.id, overrideAccess: true, depth: 0 })

  beforeAll(async () => {
    payload = await getTestPayload()
    f = await seedFixture(payload)
  })

  it('general clinic, doctor without specialty: general is allowed, massage and nutrition are refused', async () => {
    const ok = await visit({ format: 'general' })
    expect(ok.format).toBe('general')
    await rejectsWithCode(visit({ format: 'massage', massage: { services: ['relaxing'] } }), ERROR_CODES.VALIDATION)
    await rejectsWithCode(visit({ format: 'nutrition' }), ERROR_CODES.VALIDATION)
  })

  it('a visit with no format (older clients) is still accepted', async () => {
    const v = await visit({})
    expect(v.format ?? null).toBeNull()
  })

  it('aesthetic clinic: a doctor with no specialty records every aesthetic sheet', async () => {
    await payload.update({ collection: 'tenants', id: f.a.tenant.id, data: { settings: { consultTemplate: 'aesthetic' } } as never, overrideAccess: true })
    const v = await visit({ format: 'massage', massage: { services: ['relaxing'] } }, await doctor())
    expect(v.format).toBe('massage')
  })

  it('aesthetic clinic: an ophthalmologist is held to their own sheets', async () => {
    await setDoctorSpecialty('ophthalmology')
    const oph = await doctor()
    await rejectsWithCode(visit({ format: 'massage', massage: { services: ['relaxing'] } }, oph), ERROR_CODES.VALIDATION)
    await rejectsWithCode(visit({ format: 'nutrition' }, oph), ERROR_CODES.VALIDATION)
    expect((await visit({ format: 'general' }, oph)).format).toBe('general')
  })

  it('a specialty in a general clinic unlocks that specialty’s sheets', async () => {
    await payload.update({ collection: 'tenants', id: f.a.tenant.id, data: { settings: { consultTemplate: 'general' } } as never, overrideAccess: true })
    await setDoctorSpecialty('nutrition')
    expect((await visit({ format: 'nutrition' }, await doctor())).format).toBe('nutrition')
  })

  it('editing an old visit keeps its format even after the specialty changed', async () => {
    await setDoctorSpecialty('nutrition')
    const old = await visit({ format: 'nutrition' }, await doctor())
    await setDoctorSpecialty('ophthalmology')
    const oph = await doctor()
    const updated = await payload.update({ collection: 'visits', id: old.id, overrideAccess: false, user: oph, data: { format: 'nutrition', diagnosis: 'Corregido' } as never })
    expect(updated.diagnosis).toBe('Corregido')
    // …but switching it to a format the specialty doesn't have is refused.
    await rejectsWithCode(
      payload.update({ collection: 'visits', id: old.id, overrideAccess: false, user: oph, data: { format: 'massage' } as never }),
      ERROR_CODES.VALIDATION,
    )
  })

  it('a legacy visit with no stored format can be saved with the inferred format', async () => {
    await setDoctorSpecialty('ophthalmology')
    const legacy = await visit({}, await doctor())
    const saved = await payload.update({ collection: 'visits', id: legacy.id, overrideAccess: false, user: await doctor(), data: { format: 'nutrition' } as never })
    expect(saved.format).toBe('nutrition')
  })

  it('a therapist’s visit is always a massage sheet, whatever was sent', async () => {
    await payload.update({ collection: 'tenants', id: f.a.tenant.id, data: { settings: { consultTemplate: 'aesthetic' } } as never, overrideAccess: true })
    const therapist = await payload.create({
      collection: 'users',
      data: { name: 'Terapeuta A', email: 'therapist-a@clinic.test', password: 'password123', role: 'therapist', tenant: f.a.tenant.id, active: true } as never,
      overrideAccess: true,
    })
    const v = await visit({ format: 'general', massage: { services: ['relaxing'] } }, therapist)
    expect(v.format).toBe('massage')
  })

  it('rejects an unknown specialty key at the schema level', async () => {
    await rejectsWithCode(
      payload.update({ collection: 'users', id: f.a.doctor.id, data: { specialtyKey: 'astrology' } as never, overrideAccess: true }).catch((e) => {
        throw { data: { code: 'SCHEMA' }, cause: e }
      }),
      'SCHEMA',
    )
  })
})

describe('A0 — two-axis signup', () => {
  let payload: Payload
  let n = 0
  const base = () => {
    n += 1
    return {
      clinicName: `Consultorio ${n}`,
      phone: '+18095551234',
      currency: 'DOP',
      timezone: 'America/Santo_Domingo',
      ownerName: 'Dra. Prueba',
      email: `a0-${n}@signup.test`,
      password: 'password123',
    }
  }
  const load = async (tenantId: string, ownerId: string) => ({
    tenant: await payload.findByID({ collection: 'tenants', id: tenantId, overrideAccess: true, depth: 0 }),
    owner: await payload.findByID({ collection: 'users', id: ownerId, overrideAccess: true, depth: 0 }),
  })

  beforeAll(async () => {
    payload = await getTestPayload()
    await wipe(payload)
  })

  it('an independent ophthalmologist: consultorio, practitioner owner with the specialty and its title', async () => {
    const r = await signupClinic(payload, { ...base(), orgType: 'consultorio', specialtyKey: 'ophthalmology' }, { requireEmailVerification: false })
    const { tenant, owner } = await load(r.tenantId, r.ownerId)
    expect(tenant.practiceType).toBe('individual')
    expect(tenant.settings?.orgType).toBe('consultorio')
    expect(tenant.settings?.consultTemplate).toBe('general')
    expect(owner.practitioner).toBe(true)
    expect(owner.specialtyKey).toBe('ophthalmology')
    expect(owner.specialty).toBe('Oftalmología')
  })

  it('an independent nutritionist gets the nutrition base profile', async () => {
    const r = await signupClinic(payload, { ...base(), orgType: 'consultorio', specialtyKey: 'nutrition' }, { requireEmailVerification: false })
    const { tenant } = await load(r.tenantId, r.ownerId)
    expect(tenant.settings?.consultTemplate).toBe('nutrition')
  })

  it('an aesthetic clinic: clinic practice, aesthetic profile, owner is not a practitioner', async () => {
    const r = await signupClinic(payload, { ...base(), orgType: 'estetica', specialtyKey: 'ophthalmology' }, { requireEmailVerification: false })
    const { tenant, owner } = await load(r.tenantId, r.ownerId)
    expect(tenant.practiceType).toBe('clinic')
    expect(tenant.settings?.consultTemplate).toBe('aesthetic')
    expect(owner.practitioner).toBeFalsy()
    expect(owner.specialtyKey ?? null).toBeNull() // ignored for a non-practising owner
  })

  it('the org type wins over a contradicting practiceType, and junk falls back safely', async () => {
    const r = await signupClinic(payload, { ...base(), orgType: 'policlinica', practiceType: 'individual' }, { requireEmailVerification: false })
    expect((await load(r.tenantId, r.ownerId)).tenant.practiceType).toBe('clinic')
    const junk = await signupClinic(payload, { ...base(), orgType: 'spaceship', specialtyKey: 'astrology' }, { requireEmailVerification: false })
    const j = await load(junk.tenantId, junk.ownerId)
    expect(j.tenant.settings?.orgType).toBe('consultorio')
    expect(j.owner.specialtyKey ?? null).toBeNull()
  })

  it('older callers (practiceType only) keep working', async () => {
    const r = await signupClinic(payload, { ...base(), practiceType: 'clinic' }, { requireEmailVerification: false })
    const { tenant } = await load(r.tenantId, r.ownerId)
    expect(tenant.practiceType).toBe('clinic')
    expect(tenant.settings?.orgType).toBe('especialidades')
  })
})
