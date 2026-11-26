import { describe, it, expect, beforeAll } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, seedFixture, type Fixture } from './fixtures'

// MVP hardening: cross-clinic relationship guards, clinical-field privacy for the
// assistant role, the practising-owner model and the clinical audit trail.

describe('MVP — independent practice & clinical privacy', () => {
  let payload: Payload
  let f: Fixture
  let slot = 0
  // Distinct, far-future slots so the double-booking guard never interferes.
  const nextStart = () => new Date(Date.UTC(2031, 0, 5, 13, (slot++ % 8) * 30) + Math.floor(slot / 8) * 86400000).toISOString()

  beforeAll(async () => {
    payload = await getTestPayload()
    f = await seedFixture(payload)
  })

  it("rejects an appointment that points at another clinic's patient", async () => {
    await expect(
      payload.create({
        collection: 'appointments',
        overrideAccess: false,
        user: f.a.receptionist,
        data: { patient: f.b.patient.id, doctor: f.a.doctor.id, start: nextStart(), durationMins: 20, status: 'scheduled' } as never,
      }),
    ).rejects.toThrow(/Paciente no encontrado/)
  })

  it("rejects an appointment that points at another clinic's doctor", async () => {
    await expect(
      payload.create({
        collection: 'appointments',
        overrideAccess: false,
        user: f.a.receptionist,
        data: { patient: f.a.patient.id, doctor: f.b.doctor.id, start: nextStart(), durationMins: 20, status: 'scheduled' } as never,
      }),
    ).rejects.toThrow(/Médico no encontrado/)
  })

  it('rejects booking with a non-practising user as the doctor', async () => {
    await expect(
      payload.create({
        collection: 'appointments',
        overrideAccess: false,
        user: f.a.receptionist,
        data: { patient: f.a.patient.id, doctor: f.a.receptionist.id, start: nextStart(), durationMins: 20, status: 'scheduled' } as never,
      }),
    ).rejects.toThrow(/Médico no encontrado/)
  })

  it("rejects an invoice for another clinic's patient", async () => {
    await expect(
      payload.create({
        collection: 'invoices',
        overrideAccess: false,
        user: f.a.owner,
        data: { patient: f.b.patient.id, lineItems: [{ description: 'Consulta', quantity: 1, unitAmount: 100 }] } as never,
      }),
    ).rejects.toThrow(/Paciente no encontrado/)
  })

  it('lets a practising owner be booked and record the consultation', async () => {
    await payload.update({
      collection: 'users',
      id: f.a.owner.id,
      data: { practitioner: true, specialty: 'Medicina interna', licenseNumber: '999-01' } as never,
      overrideAccess: true,
    })
    const owner = await payload.findByID({ collection: 'users', id: f.a.owner.id, overrideAccess: true })

    const appt = await payload.create({
      collection: 'appointments',
      overrideAccess: false,
      user: owner,
      data: {
        patient: f.a.patient.id,
        doctor: owner.id,
        start: nextStart(),
        durationMins: 20,
        status: 'checked-in',
        isWalkIn: true,
      } as never,
    })
    const visit = await payload.create({
      collection: 'visits',
      overrideAccess: false,
      user: owner,
      data: {
        appointment: appt.id,
        chiefComplaint: 'Cefalea',
        symptoms: 'Dolor de cabeza de 2 días',
        physicalExam: 'Sin hallazgos',
        diagnosis: 'Cefalea tensional',
        notes: 'Nota privada',
        vitals: { bpSystolic: 120, bpDiastolic: 80, heightCm: 165, oxygenSaturation: 98 },
        prescription: [{ medicine: 'Acetaminofén', dosage: '500 mg', frequency: 'tds', quantity: '1 caja' }],
      } as never,
    })
    expect(visit.diagnosis).toBe('Cefalea tensional')

    // The assistant sees the prescription and diagnosis (to print) but never the
    // clinical narrative.
    const seenByAssistant = await payload.findByID({
      collection: 'visits',
      id: visit.id,
      overrideAccess: false,
      user: f.a.receptionist,
    })
    expect(seenByAssistant.diagnosis).toBe('Cefalea tensional')
    expect(seenByAssistant.prescription?.length).toBe(1)
    expect(seenByAssistant.symptoms).toBeUndefined()
    expect(seenByAssistant.physicalExam).toBeUndefined()
    expect(seenByAssistant.notes).toBeUndefined()

    const seenByOwner = await payload.findByID({ collection: 'visits', id: visit.id, overrideAccess: false, user: owner })
    expect(seenByOwner.notes).toBe('Nota privada')

    // Creating and editing the consultation is audited.
    await payload.update({
      collection: 'visits',
      id: visit.id,
      overrideAccess: false,
      user: owner,
      data: { treatmentPlan: 'Reposo' } as never,
    })
    const logs = await payload.find({
      collection: 'auditLogs',
      where: { targetId: { equals: String(visit.id) } },
      overrideAccess: true,
      sort: 'createdAt',
    })
    expect(logs.docs.map((l) => l.action)).toEqual(['visit.created', 'visit.updated'])
    expect((logs.docs[1].meta as { fields: string[] }).fields).toContain('treatmentPlan')
  })

  it("hides the patient's medical background from the assistant and keeps it on their edits", async () => {
    await payload.update({
      collection: 'patients',
      id: f.a.patient.id,
      overrideAccess: false,
      user: f.a.owner,
      data: { history: { chronicConditions: 'Hipertensión' }, documentNumber: '001-1234567-8' } as never,
    })

    const asAssistant = await payload.findByID({ collection: 'patients', id: f.a.patient.id, overrideAccess: false, user: f.a.receptionist })
    expect(asAssistant.history).toBeUndefined()
    expect(asAssistant.documentNumber).toBe('00112345678') // cédula normalised to digits

    // An assistant editing demographics can't wipe (or write) the background.
    await payload.update({
      collection: 'patients',
      id: f.a.patient.id,
      overrideAccess: false,
      user: f.a.receptionist,
      data: { occupation: 'Docente', history: { chronicConditions: '' } } as never,
    })
    const fresh = await payload.findByID({ collection: 'patients', id: f.a.patient.id, overrideAccess: true })
    expect(fresh.history?.chronicConditions).toBe('Hipertensión')
    expect(fresh.occupation).toBe('Docente')
  })

  it('counts a practising owner toward the plan doctor limit', async () => {
    await payload.update({ collection: 'tenants', id: f.b.tenant.id, data: { plan: 'free' } as never, overrideAccess: true })
    // Clinic B already has one active doctor (the free plan's only slot): a new
    // practising owner must be rejected.
    await expect(
      payload.create({
        collection: 'users',
        overrideAccess: false,
        user: f.b.owner,
        data: { name: 'Dra. Nueva', email: 'nueva@clinic.test', password: 'password123', role: 'owner', practitioner: true } as never,
      }),
    ).rejects.toThrow()
    await payload.update({ collection: 'tenants', id: f.b.tenant.id, data: { plan: 'plus' } as never, overrideAccess: true })
  })
})
