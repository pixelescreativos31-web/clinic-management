/**
 * Seed script — demo quality is portfolio quality.
 *
 *   pnpm seed
 *
 * Idempotent: wipes and recreates. Refuses to run in production unless FORCE_SEED=1.
 * All appointment dates are relative to "today" so the dashboard and Day Rail are
 * alive on demo day (spec §10).
 */
import 'dotenv/config'
import { getPayload, type Payload } from 'payload'
import config from './payload.config'
import type { Plan } from './lib/plans'
import { wallTimeToUTC } from './lib/reports'

const PASSWORD = 'password123'

const FIRST_NAMES = {
  female: ['María', 'Ana', 'Carmen', 'Rosa', 'Altagracia', 'Yokasta', 'Mercedes', 'Yolanda', 'Esperanza', 'Josefina', 'Margarita', 'Isabel', 'Lucía'],
  male: ['José', 'Luis', 'Juan', 'Pedro', 'Miguel', 'Rafael', 'Francisco', 'Ramón', 'Manuel', 'Julio', 'Félix', 'Héctor'],
} as const
const LAST_NAMES = [
  'Rodríguez', 'Pérez', 'Martínez', 'Santos', 'Peña', 'Reyes', 'Jiménez', 'Díaz',
  'Núñez', 'Almonte', 'Batista', 'Castillo', 'Guzmán', 'Vásquez', 'Rosario',
]
const REASONS = [
  'Fiebre', 'Seguimiento', 'Tos y gripe', 'Control de presión', 'Dolor de cabeza',
  'Control de diabetes', 'Erupción en la piel', 'Dolor abdominal', 'Vacunación', 'Chequeo general',
]
const ALLERGIES = ['Penicilina', 'Sulfas', 'Aspirina', 'Polen']
const INSURERS = ['ARS Humano', 'ARS Universal', 'ARS Palic', 'SeNaSa', 'ARS Mapfre Salud']
const BLOOD = ['A+', 'B+', 'O+', 'AB+', 'A-', 'O-'] as const
const GENDERS = ['male', 'female'] as const

// Deterministic pseudo-random so seeds are repeatable without Math.random.
let _s = 7
const rnd = () => {
  _s = (_s * 1103515245 + 12345) & 0x7fffffff
  return _s / 0x7fffffff
}
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1))

/** Local calendar date (YYYY-MM-DD) of a Date built with setDate on startOfToday. */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** Wall-clock time in the clinic's timezone → UTC Date (so demo hours look right). */
const at = (tz: string, day: Date, h: number, m: number) =>
  wallTimeToUTC(tz, ymd(day), `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

type DoctorSpec = {
  name: string
  specialty: string
  fee: number
  type?: 'regular' | 'onCall' | 'byAppointment'
  days?: string[]
  from?: string
  to?: string
}

type ClinicSpec = {
  name: string
  slug: string
  /** Demo e-mail domain key: owner@<key>.app, asistente@<key>.app, doctorN@<key>.app */
  emailKey: string
  practiceType: 'individual' | 'clinic'
  /** Independent practice: the owner IS the doctor (doctors[0] describes them). */
  ownerPractises?: boolean
  ownerEmail: string
  city: string
  country: string
  phone: string
  currency: string
  timezone: string
  plan: Plan
  doctors: DoctorSpec[]
}

const CLINICS: ClinicSpec[] = [
  {
    // The MVP persona: one independent doctor + her assistant.
    name: 'Consultorio Dra. Carmen Rosario',
    slug: 'consultorio-dra-carmen-rosario',
    emailKey: 'demo',
    practiceType: 'individual',
    ownerPractises: true,
    ownerEmail: 'doctora@demo.app',
    city: 'Santo Domingo',
    country: 'República Dominicana',
    phone: '+18095551234',
    currency: 'DOP',
    timezone: 'America/Santo_Domingo',
    plan: 'pro',
    doctors: [
      { name: 'Dra. Carmen Rosario', specialty: 'Medicina interna', fee: 2500, type: 'regular', days: ['mon','tue','wed','thu','fri','sat'], from: '08:00', to: '17:00' },
    ],
  },
  {
    // Growth path: a small clinic with several doctors (clinic mode).
    name: 'Centro Médico Los Prados',
    slug: 'centro-medico-los-prados',
    emailKey: 'clinica',
    practiceType: 'clinic',
    ownerEmail: 'owner@clinica.app',
    city: 'Santiago de los Caballeros',
    country: 'República Dominicana',
    phone: '+18095557890',
    currency: 'DOP',
    timezone: 'America/Santo_Domingo',
    plan: 'clinic',
    doctors: [
      { name: 'Dr. Luis Almonte', specialty: 'Medicina general', fee: 1500, type: 'regular', days: ['mon','tue','wed','thu','fri'], from: '08:00', to: '12:00' },
      { name: 'Dra. Ana Batista', specialty: 'Pediatría', fee: 2000, type: 'regular', days: ['mon','wed','fri'], from: '14:00', to: '18:00' },
      { name: 'Dr. Rafael Guzmán', specialty: 'Cardiología', fee: 3500, type: 'onCall' },
    ],
  },
]

async function wipe(payload: Payload) {
  // Children before parents.
  for (const collection of ['invoices', 'visits', 'appointments', 'patients', 'users', 'tenants'] as const) {
    await payload.delete({ collection, where: {}, overrideAccess: true })
  }
}

const DIAGNOSES = [
  'Faringitis aguda', 'Síndrome febril viral', 'Hipertensión arterial', 'Diabetes mellitus tipo 2 en control',
  'Migraña', 'Gastroenteritis aguda', 'Rinitis alérgica', 'Lumbalgia mecánica',
]
const MEDICINES = [
  { medicine: 'Amoxicilina', dosage: '500 mg', frequency: 'tds', durationDays: 7, quantity: '21 cápsulas', instructions: 'Después de las comidas' },
  { medicine: 'Acetaminofén', dosage: '500 mg', frequency: 'qid', durationDays: 3, quantity: '12 tabletas', instructions: 'Si hay fiebre o dolor' },
  { medicine: 'Loratadina', dosage: '10 mg', frequency: 'od', durationDays: 7, quantity: '7 tabletas', instructions: 'En la noche' },
  { medicine: 'Omeprazol', dosage: '20 mg', frequency: 'od', durationDays: 14, quantity: '14 cápsulas', instructions: 'En ayunas' },
  { medicine: 'Metformina', dosage: '850 mg', frequency: 'bd', durationDays: 30, quantity: '60 tabletas', instructions: 'Con las comidas' },
] as const

export async function seed(payload: Payload) {
  payload.logger.info('Seeding demo data…')
  await wipe(payload)

  // Platform super admin
  await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      name: 'Administrador de plataforma',
      email: 'super@clinic.app',
      password: PASSWORD,
      role: 'superAdmin',
    },
  })

  const today = startOfToday()

  for (const clinic of CLINICS) {
    const tenant = await payload.create({
      collection: 'tenants',
      overrideAccess: true,
      data: {
        name: clinic.name,
        slug: clinic.slug,
        phone: clinic.phone,
        city: clinic.city,
        country: clinic.country,
        status: 'active',
        plan: clinic.plan,
        practiceType: clinic.practiceType,
        onboardingSource: 'manual',
        settings: {
          appointmentDurationMins: 20,
          openTime: '08:00',
          closeTime: '18:00',
          currency: clinic.currency as never,
          timezone: clinic.timezone as never,
        },
      },
    })

    const emailKey = clinic.emailKey
    const ALL = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const doctorObjs: { id: string; type: string; fromH: number; toH: number; days: string[]; fee: number }[] = []

    // Owner — in an independent practice the owner is also the (only) doctor.
    const lead = clinic.ownerPractises ? clinic.doctors[0] : null
    const owner = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        name: lead ? lead.name : `Administración — ${clinic.name}`,
        email: clinic.ownerEmail,
        password: PASSWORD,
        role: 'owner',
        tenant: tenant.id,
        ...(lead
          ? {
              practitioner: true,
              specialty: lead.specialty,
              licenseNumber: '12345-06',
              consultationFee: lead.fee,
              availabilityType: (lead.type || 'regular') as never,
              availableDays: (lead.days || ALL) as never,
              availableFrom: lead.from || '09:00',
              availableTo: lead.to || '17:00',
            }
          : {}),
      },
    })
    if (lead) {
      doctorObjs.push({
        id: String(owner.id),
        type: lead.type || 'regular',
        fromH: parseInt((lead.from || '09:00').split(':')[0], 10),
        toH: parseInt((lead.to || '17:00').split(':')[0], 10),
        days: lead.days || ALL,
        fee: lead.fee,
      })
    }

    // Assistant (receptionist role)
    await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        name: 'Yokasta Peña (asistente)',
        email: `asistente@${emailKey}.app`,
        password: PASSWORD,
        role: 'receptionist',
        tenant: tenant.id,
      },
    })

    // Doctors (with varied availability patterns)
    for (let i = lead ? 1 : 0; i < clinic.doctors.length; i++) {
      const d = clinic.doctors[i]
      const type = d.type || 'regular'
      const doc = await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: {
          name: d.name,
          email: `doctor${i + 1}@${emailKey}.app`,
          password: PASSWORD,
          role: 'doctor',
          tenant: tenant.id,
          active: true,
          specialty: d.specialty,
          licenseNumber: `${10000 + i * 137}-0${i + 1}`,
          consultationFee: d.fee,
          availabilityType: type as never,
          availableDays: (d.days || ALL) as never,
          availableFrom: d.from || '09:00',
          availableTo: d.to || '17:00',
        },
      })
      doctorObjs.push({
        id: String(doc.id),
        type,
        fromH: parseInt((d.from || '09:00').split(':')[0], 10),
        toH: parseInt((d.to || '17:00').split(':')[0], 10),
        days: d.days || ALL,
        fee: d.fee,
      })
    }

    // Patients (~20). A couple share a phone number to demo the dedupe warning.
    const patientIds: string[] = []
    const sharedPhone = `+1809${int(2000000, 9999999)}`
    for (let p = 0; p < 20; p++) {
      const gender = pick(GENDERS)
      const phone = p < 2 ? sharedPhone : `+1${pick(['809', '829', '849'])}${int(2000000, 9999999)}`
      const patient = await payload.create({
        collection: 'patients',
        overrideAccess: true,
        data: {
          tenant: tenant.id,
          name: `${pick(FIRST_NAMES[gender])} ${pick(LAST_NAMES)}`,
          phone,
          gender,
          ageYears: int(3, 78),
          documentType: 'cedula',
          documentNumber: `${int(1, 402)}`.padStart(3, '0') + `${int(1000000, 9999999)}${int(0, 9)}`,
          bloodGroup: pick(BLOOD),
          allergies: rnd() < 0.18 ? pick(ALLERGIES) : undefined,
          insurance: rnd() < 0.7 ? { provider: pick(INSURERS), affiliateNumber: String(int(10000000, 99999999)) } : undefined,
          history: rnd() < 0.4 ? { chronicConditions: pick(['Hipertensión arterial', 'Diabetes tipo 2', 'Asma']), medications: pick(['Losartán 50 mg diario', 'Metformina 850 mg c/12h', 'Salbutamol inhalado SOS']) } : undefined,
        },
      })
      patientIds.push(String(patient.id))
    }

    // Appointments across past 14 days + next 3 days, each within the doctor's
    // own availability window (so the Day Rail shading lines up).
    const generalHours = [9, 10, 11, 12, 14, 15, 16, 17, 18, 19]
    const dayCode = (dt: Date) => ALL[dt.getDay()]
    let made = 0
    const completedAppts: { id: string; patientId: string; doctorId: string; fee: number }[] = []
    for (let dayOffset = -14; dayOffset <= 3 && made < 70; dayOffset++) {
      for (const doc of doctorObjs) {
        const probeDate = new Date(today)
        probeDate.setDate(probeDate.getDate() + dayOffset)
        // Regular doctors only see patients on their available weekdays.
        if (doc.type === 'regular' && !doc.days.includes(dayCode(probeDate))) continue

        const hours =
          doc.type === 'regular'
            ? Array.from({ length: Math.max(1, doc.toH - doc.fromH) }, (_, i) => doc.fromH + i)
            : generalHours

        const used = new Set<number>()
        const count = int(1, Math.min(3, hours.length))
        for (let k = 0; k < count && made < 70; k++) {
          let hour = pick(hours)
          let guard = 0
          while (used.has(hour) && guard++ < 10) hour = pick(hours)
          used.add(hour)

          const start = at(clinic.timezone, probeDate, hour, rnd() < 0.5 ? 0 : 30)

          let status: string
          if (dayOffset < 0) status = pick(['completed', 'completed', 'completed', 'no-show', 'cancelled'])
          else if (dayOffset === 0) status = pick(['completed', 'checked-in', 'scheduled', 'scheduled'])
          else status = 'scheduled'

          const patientId = pick(patientIds)
          try {
            const appt = await payload.create({
              collection: 'appointments',
              overrideAccess: true,
              data: {
                tenant: tenant.id,
                patient: patientId,
                doctor: doc.id,
                start: start.toISOString(),
                durationMins: 20,
                reason: pick(REASONS),
                status: status as never,
                cancellationReason: status === 'cancelled' ? 'El paciente reprogramó' : undefined,
              },
            })
            made++
            if (status === 'completed') {
              completedAppts.push({ id: String(appt.id), patientId, doctorId: doc.id, fee: doc.fee })
            }
          } catch {
            // skip rare slot collisions
          }
        }
      }
    }

    // A few walk-ins today (first-come-first-serve) to demo token numbers — only
    // when today is one of that doctor's working days.
    const regularToday = doctorObjs.find((d) => d.type === 'regular' && d.days.includes(dayCode(today)))
    if (regularToday) {
      for (let w = 0; w < 3; w++) {
        const start = at(clinic.timezone, today, regularToday.fromH, 10 + w * 5)
        try {
          await payload.create({
            collection: 'appointments',
            overrideAccess: true,
            data: {
              tenant: tenant.id,
              patient: pick(patientIds),
              doctor: regularToday.id,
              start: start.toISOString(),
              durationMins: 20,
              reason: 'Sin cita',
              status: 'checked-in' as never,
              isWalkIn: true,
            },
          })
          made++
        } catch {
          // ignore
        }
      }
    }

    // v2 — visits + invoices for completed appointments (so the clinical loop,
    // patient timeline and revenue/outstanding cards are alive on demo day).
    let visitsMade = 0
    let invoicesMade = 0
    for (let i = 0; i < completedAppts.length && visitsMade < 16; i++) {
      const ca = completedAppts[i]
      try {
        const visit = await payload.create({
          collection: 'visits',
          overrideAccess: true,
          data: {
            tenant: tenant.id,
            appointment: ca.id,
            visitDate: new Date().toISOString(),
            chiefComplaint: pick(REASONS),
            diagnosis: pick(DIAGNOSES),
            treatmentPlan: 'Reposo relativo, hidratación abundante. Volver si presenta signos de alarma.',
            vitals: {
              bpSystolic: int(110, 135),
              bpDiastolic: int(70, 90),
              temperatureC: 36 + Math.round(rnd() * 20) / 10,
              pulse: int(64, 92),
              weightKg: int(55, 95),
              heightCm: int(150, 185),
              oxygenSaturation: int(95, 99),
            },
            prescription: [pick(MEDICINES), ...(rnd() < 0.5 ? [pick(MEDICINES)] : [])] as never,
          } as never,
        })
        visitsMade++

        // ~80% of visits get billed; statuses mixed (paid / partial / unpaid).
        if (rnd() < 0.8) {
          const roll = rnd()
          const payments =
            roll < 0.5
              ? [{ amount: ca.fee, method: 'cash' as never, receivedAt: new Date().toISOString() }]
              : roll < 0.75
                ? [{ amount: Math.round(ca.fee / 2), method: 'card' as never, receivedAt: new Date().toISOString() }]
                : []
          await payload.create({
            collection: 'invoices',
            overrideAccess: true,
            data: {
              tenant: tenant.id,
              visit: String(visit.id),
              patient: ca.patientId,
              lineItems: [{ description: 'Consulta', quantity: 1, unitAmount: ca.fee }],
              payments,
            } as never,
          })
          invoicesMade++
        }
      } catch {
        // skip (e.g. a visit already exists for this appointment)
      }
    }

    payload.logger.info(
      `  ✓ ${clinic.name}: ${doctorObjs.length} médico(s), 20 pacientes, ~${made} citas, ${visitsMade} consultas, ${invoicesMade} facturas`,
    )
  }

  payload.logger.info('Datos de demostración listos.')
  payload.logger.info('Accesos demo (contraseña: password123):')
  payload.logger.info('  doctora@demo.app  ·  asistente@demo.app  ·  owner@clinica.app  ·  doctor1@clinica.app  ·  super@clinic.app')
}

// Allow running directly: `tsx src/seed.ts`
const isProd = process.env.NODE_ENV === 'production'
if (isProd && process.env.FORCE_SEED !== '1') {
  console.error('Refusing to seed in production without FORCE_SEED=1')
  process.exit(1)
}

const run = async () => {
  const payload = await getPayload({ config: await config })
  await seed(payload)
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
