import { describe, it, expect, beforeAll } from 'vitest'
import type { Payload } from 'payload'
import sharp from 'sharp'
import { getTestPayload, seedFixture, type Fixture } from './fixtures'
import { bmi, bmiLabel, bodyLine, cmToIn, inToCm, isMeasureWeek, kgToLb, lbToKg, parseMetric, weekLabel, withProgress } from '@/lib/program'
import { formatsFor, initialFormat } from '@/lib/profiles'

// Weight-management programme («Impulso Vital»): enrolment (episode of care),
// weekly controls as consultations, progress photos and the shared history.

// A real 8×8 JPEG (Payload inspects uploaded images with sharp).
let JPEG: Buffer
beforeAll(async () => {
  JPEG = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } }).jpeg().toBuffer()
})

describe('Programa — lógica pura', () => {
  it('converts units and computes BMI', () => {
    expect(kgToLb(100)).toBe(220.5)
    expect(lbToKg(220.462)).toBe(100)
    expect(cmToIn(254)).toBe(100)
    expect(inToCm(64)).toBe(162.6)
    expect(bmi(80, 170)).toBe(27.7)
    expect(bmiLabel(27.7)).toBe('Sobrepeso')
    expect(bmiLabel(22)).toBe('Normal')
    expect(bmi(null, 170)).toBeNull()
  })

  it('numbers weeks and schedules measurements every 4 weeks', () => {
    expect(weekLabel(0)).toBe('Evaluación inicial')
    expect(weekLabel(3)).toBe('Semana 3')
    expect([0, 1, 4, 7, 8, 12].map(isMeasureWeek)).toEqual([false, false, true, false, true, true])
  })

  it('computes change versus the previous control and the start, skipping unweighed controls', () => {
    const rows = withProgress([
      { week: 2, weightKg: 88 },
      { week: 0, weightKg: 90, heightCm: 165 },
      { week: 1, weightKg: null },
      { week: 3, weightKg: 87.5 },
    ])
    expect(rows.map((r) => r.week)).toEqual([0, 1, 2, 3])
    expect(rows[0].deltaStart).toBe(0)
    expect(rows[1].deltaPrev).toBeNull()
    expect(rows[2].deltaPrev).toBe(-2) // vs week 0: week 1 had no weight
    expect(rows[3].deltaPrev).toBe(-0.5)
    expect(rows[3].deltaStart).toBe(-2.5)
    expect(rows[3].bmi).toBe(32.1) // height carried from week 0
  })

  it('parses typed numbers and rejects out-of-range values', () => {
    expect(parseMetric('72,5', 2, 400)).toBe(72.5)
    expect(parseMetric('', 2, 400)).toBeUndefined()
    expect(parseMetric('900', 2, 400)).toBeUndefined()
    expect(parseMetric('abc', 2, 400)).toBeUndefined()
  })

  it('summarises body metrics in one line', () => {
    expect(bodyLine({ bodyFatPct: 32, waistCm: 90, muscleMass: 25, muscleMassUnit: 'kg' })).toBe('Músculo 25 kg · Grasa 32% · Cintura 90 cm')
    expect(bodyLine({})).toBeNull()
  })

  it('opens enrolled patients on the programme control, otherwise the doctor default', () => {
    const aesthetic = { settings: { consultTemplate: 'aesthetic' } }
    const formats = formatsFor(aesthetic, { role: 'doctor' })
    expect(formats).toContain('program')
    expect(initialFormat(formats, { activeProgram: true, userDefault: 'nutrition' })).toBe('program')
    expect(initialFormat(formats, { activeProgram: false, userDefault: 'nutrition' })).toBe('nutrition')
    expect(initialFormat(formats, { activeProgram: false })).toBe('general')
    // A default the clinic does not offer is ignored.
    expect(initialFormat(formatsFor({ settings: { consultTemplate: 'general' } }, { role: 'doctor' }), { activeProgram: true, userDefault: 'massage' })).toBe('general')
    expect(formatsFor(aesthetic, { role: 'therapist' })).toEqual(['massage'])
  })
})

describe('Programa — inscripción, controles, fotos y permisos', () => {
  let payload: Payload
  let f: Fixture
  let slot = 0
  const nextStart = () => new Date(Date.UTC(2032, 2, 1, 13, 0) + slot++ * 3600000).toISOString()
  let programId: string

  const checkedIn = async (user = f.a.doctor, patient = f.a.patient.id) =>
    payload.create({
      collection: 'appointments',
      overrideAccess: false,
      user,
      data: { patient, doctor: f.a.doctor.id, start: nextStart(), durationMins: 20, status: 'checked-in', isWalkIn: true } as never,
    })

  const control = async (data: Record<string, unknown>, user = f.a.doctor) => {
    const appt = await checkedIn(user)
    return payload.create({ collection: 'visits', overrideAccess: false, user, data: { appointment: appt.id, format: 'program', ...data } as never })
  }

  beforeAll(async () => {
    payload = await getTestPayload()
    f = await seedFixture(payload)
    await payload.update({ collection: 'tenants', id: f.a.tenant.id, data: { settings: { consultTemplate: 'aesthetic', programName: 'Impulso Vital' } } as never, overrideAccess: true })
    await payload.update({ collection: 'patients', id: f.a.patient.id, data: { gender: 'female' } as never, overrideAccess: true })
  })

  it('stores the structured background (by relative, childhood/adulthood, E-A-P-C) in the patient history', async () => {
    await payload.update({
      collection: 'patients',
      id: f.a.patient.id,
      overrideAccess: false,
      user: f.a.doctor,
      data: {
        history: {
          childhood: 'Asma',
          personal: 'Hipotiroidismo',
          familyMother: 'Diabetes tipo 2',
          familyFather: 'HTA',
          familySiblings: 'Ninguno',
          otherFindings: 'Acantosis nigricans en cuello',
          obstetric: { pregnancies: 3, abortions: 1, births: 1, cesareans: 1 },
        },
      } as never,
    })
    const seen = await payload.findByID({ collection: 'patients', id: f.a.patient.id, overrideAccess: false, user: f.a.doctor })
    expect(seen.history?.familyMother).toBe('Diabetes tipo 2')
    expect(seen.history?.obstetric).toMatchObject({ pregnancies: 3, abortions: 1, births: 1, cesareans: 1 })
    // The assistant never sees the clinical history.
    const asAssistant = await payload.findByID({ collection: 'patients', id: f.a.patient.id, overrideAccess: false, user: f.a.receptionist })
    expect(asAssistant.history).toBeUndefined()
  })

  it('enrols a patient once (one active programme at a time)', async () => {
    const p = await payload.create({
      collection: 'programs',
      overrideAccess: false,
      user: f.a.doctor,
      data: { patient: f.a.patient.id, name: 'Impulso Vital', status: 'active', startDate: '2032-03-01T12:00:00.000Z' } as never,
    })
    programId = String(p.id)
    expect(String(typeof p.tenant === 'object' ? p.tenant.id : p.tenant)).toBe(String(f.a.tenant.id))
    await expect(
      payload.create({
        collection: 'programs',
        overrideAccess: false,
        user: f.a.doctor,
        data: { patient: f.a.patient.id, name: 'Impulso Vital', status: 'active', startDate: '2032-03-02T12:00:00.000Z' } as never,
      }),
    ).rejects.toThrow(/programa activo/)
  })

  it('keeps programmes away from the assistant and from other clinics', async () => {
    await expect(
      payload.create({
        collection: 'programs',
        overrideAccess: false,
        user: f.a.receptionist,
        data: { patient: f.a.patient.id, name: 'X', status: 'active', startDate: '2032-03-01T12:00:00.000Z' } as never,
      }),
    ).rejects.toThrow()
    const asAssistant = await payload.find({ collection: 'programs', overrideAccess: false, user: f.a.receptionist }).catch(() => ({ docs: [] }))
    expect(asAssistant.docs).toHaveLength(0)
    const asOther = await payload.find({ collection: 'programs', overrideAccess: false, user: f.b.doctor })
    expect(asOther.docs).toHaveLength(0)
    await expect(
      payload.create({
        collection: 'programs',
        overrideAccess: false,
        user: f.b.doctor,
        data: { patient: f.a.patient.id, name: 'X', status: 'active', startDate: '2032-03-01T12:00:00.000Z' } as never,
      }),
    ).rejects.toThrow(/Paciente no encontrado/)
    await expect(payload.delete({ collection: 'programs', id: programId, overrideAccess: false, user: f.a.owner })).rejects.toThrow()
  })

  it('refuses a control without an enrolment', async () => {
    await expect(control({})).rejects.toThrow(/Inscriba al paciente/)
  })

  it('records the initial evaluation as week 0, then numbers the following weeks', async () => {
    const w0 = await control({
      program: programId,
      vitals: { weightKg: 90, heightCm: 165, bpSystolic: 130, bpDiastolic: 85, pulse: 80, respiratoryRate: 16 },
      body: { bodyFatPct: 38, bodyWaterPct: 45, muscleMass: 24, muscleMassUnit: 'kg', waistCm: 102, chestCm: 108, hipCm: 115, armRightCm: 34 },
      notes: 'Ingreso al programa',
    })
    expect(w0.programWeek).toBe(0)
    expect(w0.chiefComplaint).toBe('Impulso Vital · Evaluación inicial')
    expect(w0.body?.waistCm).toBe(102)

    const w1 = await control({ program: programId, vitals: { weightKg: 88.5 } })
    expect(w1.programWeek).toBe(1)
    // A late control can be recorded for an explicit, unused week.
    const w3 = await control({ program: programId, programWeek: 3, vitals: { weightKg: 87 } })
    expect(w3.programWeek).toBe(3)
    const next = await control({ program: programId, vitals: { weightKg: 86.4 } })
    expect(next.programWeek).toBe(4)
  })

  it('never overwrites a week: a duplicate week is rejected', async () => {
    await expect(control({ program: programId, programWeek: 1, vitals: { weightKg: 80 } })).rejects.toThrow(/Ya existe el control de semana 1/)
    const all = await payload.find({ collection: 'visits', where: { program: { equals: programId } }, overrideAccess: true, sort: 'programWeek' })
    expect(all.docs.map((d) => d.programWeek)).toEqual([0, 1, 3, 4])
    expect(all.docs.find((d) => d.programWeek === 1)?.vitals?.weightKg).toBe(88.5)
  })

  it("rejects a control pointing at another patient's programme", async () => {
    const other = await payload.create({
      collection: 'patients',
      data: { tenant: f.a.tenant.id, name: 'Otra paciente', phone: '8095550000', gender: 'female', ageYears: 40 } as never,
      overrideAccess: true,
    })
    const appt = await checkedIn(f.a.doctor, String(other.id))
    await expect(
      payload.create({
        collection: 'visits',
        overrideAccess: false,
        user: f.a.doctor,
        data: { appointment: appt.id, format: 'program', program: programId, vitals: { weightKg: 70 } } as never,
      }),
    ).rejects.toThrow(/no corresponde/)
  })

  it('edits a control in place without changing its week or programme', async () => {
    const w1 = (await payload.find({ collection: 'visits', where: { program: { equals: programId }, programWeek: { equals: 1 } }, overrideAccess: true })).docs[0]
    const updated = await payload.update({
      collection: 'visits',
      id: w1.id,
      overrideAccess: false,
      user: f.a.doctor,
      data: { format: 'program', vitals: { weightKg: 88.2 }, body: { waistCm: 100 } } as never,
    })
    expect(updated.programWeek).toBe(1)
    expect(updated.vitals?.weightKg).toBe(88.2)
    expect(updated.body?.waistCm).toBe(100)
  })

  it('hides body metrics from the assistant, like the rest of the clinical narrative', async () => {
    const w0 = (await payload.find({ collection: 'visits', where: { program: { equals: programId }, programWeek: { equals: 0 } }, overrideAccess: true })).docs[0]
    const asAssistant = await payload.findByID({ collection: 'visits', id: w0.id, overrideAccess: false, user: f.a.receptionist })
    expect(asAssistant.body).toBeUndefined()
    expect(asAssistant.notes).toBeUndefined()
  })

  it('does not let a therapist write programme data', async () => {
    const therapist = await payload.create({
      collection: 'users',
      data: { name: 'Terapeuta A', email: 'therapist-prog@clinic.test', password: 'password123', role: 'therapist', tenant: f.a.tenant.id, active: true } as never,
      overrideAccess: true,
    })
    const appt = await payload.create({
      collection: 'appointments',
      overrideAccess: true,
      data: { tenant: f.a.tenant.id, patient: f.a.patient.id, doctor: therapist.id, start: nextStart(), durationMins: 60, status: 'checked-in' } as never,
    })
    const v = await payload.create({
      collection: 'visits',
      overrideAccess: false,
      user: therapist,
      data: { appointment: appt.id, format: 'program', program: programId, programWeek: 9, body: { waistCm: 1 }, massage: { services: ['relaxing'] } } as never,
    })
    expect(v.format).toBe('massage')
    expect(v.program ?? null).toBeNull()
    expect(v.programWeek ?? null).toBeNull()
  })

  it('stores progress photos privately, tied to the programme and patient', async () => {
    const photo = await payload.create({
      collection: 'progressPhotos',
      overrideAccess: false,
      user: f.a.doctor,
      data: { program: programId, week: 0, view: 'front', takenAt: '2032-03-01T12:00:00.000Z' } as never,
      file: { data: JPEG, mimetype: 'image/jpeg', name: 'p-test.jpg', size: JPEG.length },
    })
    expect(String(typeof photo.patient === 'object' ? photo.patient.id : photo.patient)).toBe(String(f.a.patient.id))
    expect(photo.url).toMatch(/^\/api\/progressPhotos\/file\//)

    const asAssistant = await payload.find({ collection: 'progressPhotos', overrideAccess: false, user: f.a.receptionist }).catch(() => ({ docs: [] }))
    expect(asAssistant.docs).toHaveLength(0)
    const asOther = await payload.find({ collection: 'progressPhotos', overrideAccess: false, user: f.b.doctor })
    expect(asOther.docs).toHaveLength(0)
    await expect(
      payload.create({
        collection: 'progressPhotos',
        overrideAccess: false,
        user: f.b.doctor,
        data: { program: programId, week: 0, view: 'back', takenAt: '2032-03-01T12:00:00.000Z' } as never,
        file: { data: JPEG, mimetype: 'image/jpeg', name: 'p-test2.jpg', size: JPEG.length },
      }),
    ).rejects.toThrow(/Programa no encontrado/)

    await payload.delete({ collection: 'progressPhotos', id: photo.id, overrideAccess: false, user: f.a.doctor })
  })

  it('closes and reopens the programme; a closed one takes no new controls', async () => {
    const closed = await payload.update({ collection: 'programs', id: programId, overrideAccess: false, user: f.a.doctor, data: { status: 'completed' } as never })
    expect(closed.endDate).toBeTruthy()
    await expect(control({ program: programId, vitals: { weightKg: 85 } })).rejects.toThrow(/cerrado/)
    const reopened = await payload.update({ collection: 'programs', id: programId, overrideAccess: false, user: f.a.doctor, data: { status: 'active' } as never })
    expect(reopened.endDate ?? null).toBeNull()
  })

  it('audits enrolment, status changes and photos', async () => {
    const logs = await payload.find({ collection: 'auditLogs', where: { tenant: { equals: f.a.tenant.id } }, limit: 200, overrideAccess: true })
    const actions = logs.docs.map((d) => d.action)
    expect(actions).toContain('program.enrolled')
    expect(actions).toContain('program.updated')
    expect(actions).toContain('photo.added')
    expect(actions).toContain('photo.deleted')
  })
})
