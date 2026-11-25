// Local QA accounts, one per role, added on top of `pnpm seed` (never run in production).
// Password comes from TEST_USER_PASSWORD in the local .env (gitignored).
// Run: npx tsx src/seedTesters.ts
import 'dotenv/config'
import { getPayload } from 'payload'
import config from './payload.config'

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to create QA users in production')
  process.exit(1)
}

const password = process.env.TEST_USER_PASSWORD
if (!password) {
  console.error('Set TEST_USER_PASSWORD in .env')
  process.exit(1)
}

const run = async () => {
  const payload = await getPayload({ config: await config })
  // Own tenant on the per-doctor plan so the QA accounts never hit the seeded clinics' doctor caps.
  const found = await payload.find({ collection: 'tenants', where: { slug: { equals: 'clinica-qa' } }, limit: 1, overrideAccess: true })
  const clinic =
    found.docs[0] ??
    (await payload.create({
      collection: 'tenants',
      overrideAccess: true,
      data: {
        name: 'Clínica QA medira',
        slug: 'clinica-qa',
        phone: '+18095550100',
        city: 'Santo Domingo',
        country: 'DO',
        status: 'active',
        plan: 'plus',
        practiceType: 'clinic',
        onboardingSource: 'manual',
        settings: { appointmentDurationMins: 20, openTime: '08:00', closeTime: '18:00', currency: 'DOP', timezone: 'America/Santo_Domingo' },
      } as never,
    }))
  const users = [
    { email: 'qa.titular@medira.test', name: 'QA Titular', role: 'owner', practitioner: true, specialty: 'Medicina general' },
    { email: 'qa.medico@medira.test', name: 'QA Médico', role: 'doctor', specialty: 'Medicina general' },
    { email: 'qa.terapeuta@medira.test', name: 'QA Terapeuta', role: 'therapist' },
    { email: 'qa.asistente@medira.test', name: 'QA Asistente', role: 'receptionist' },
    { email: 'qa.super@medira.test', name: 'QA Súper admin', role: 'superAdmin' },
  ] as const
  for (const u of users) {
    const existing = await payload.find({ collection: 'users', where: { email: { equals: u.email } }, limit: 1, overrideAccess: true })
    if (existing.docs.length) continue
    await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        ...u,
        password,
        active: true,
        ...(u.role === 'superAdmin' ? {} : { tenant: clinic.id }),
        ...(u.role === 'doctor' || u.role === 'owner'
          ? { licenseNumber: '99999-01', consultationFee: 2000, availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], availableFrom: '08:00', availableTo: '18:00' }
          : {}),
      } as never,
    })
    payload.logger.info(`  ✓ ${u.email} (${u.role}) → ${u.role === 'superAdmin' ? 'plataforma' : clinic.name}`)
  }
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
