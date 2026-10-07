// Self-serve onboarding core (v3 spec §3). Kept separate from the server action so
// the transaction logic is unit-testable without Next's cookies()/headers(). The
// action wraps this with rate-limiting and auto-login; the int suite calls it
// directly. Everything here runs with overrideAccess (there is no logged-in user
// yet) — abuse guards live in the action, atomicity lives here.

import type { Payload } from 'payload'
import { APIError } from 'payload'
import {
  ERROR_CODES,
  DEFAULT_APPOINTMENT_DURATION,
  DEFAULT_OPEN_TIME,
  DEFAULT_CLOSE_TIME,
  DEFAULT_TIMEZONE,
} from './constants'
import { wallTimeToUTC } from './reports'
import { emailEnabled } from './email'
import { createVerificationToken } from './verification'

export type SignupInput = {
  clinicName: string
  phone: string
  city?: string
  country?: string
  currency: string
  timezone: string
  ownerName: string
  email: string
  password: string
  /** `individual` (default): the owner is the practice's doctor. */
  practiceType?: 'individual' | 'clinic'
  specialty?: string
  licenseNumber?: string
}

export type SignupOptions = {
  /**
   * Whether the owner must confirm their email before the clinic queues for
   * approval (BACKLOG §1.1). Defaults to whether email can actually be sent —
   * with no RESEND_API_KEY the step is skipped, or nobody could ever verify.
   */
  requireEmailVerification?: boolean
}

export type SignupResult = {
  tenantId: string
  ownerId: string
  slug: string
  /** Present only when verification is required — the action emails this link out. */
  verificationToken?: string
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** First free slug for `name`: `acme`, then `acme-2`, `acme-3`… (spec §3.1.b). */
async function uniqueSlug(payload: Payload, name: string): Promise<string> {
  const base = slugify(name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) || 'consultorio'
  let candidate = base
  let n = 1
  // Bounded loop — a clinic name colliding 50 times is not a real scenario.
  while (n <= 50) {
    const existing = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: candidate } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.totalDocs === 0) return candidate
    n += 1
    candidate = `${base}-${n}`
  }
  // Fall back to a name that the unique index will accept.
  return `${base}-${Date.now()}`
}

/** Validate untrusted input; throws VALIDATION with a friendly-ish message. */
function validate(input: SignupInput): void {
  const fail = (message: string) =>
    new APIError(message, 400, { code: ERROR_CODES.VALIDATION })
  if (!input.clinicName?.trim()) throw fail('El nombre del consultorio es obligatorio.')
  if (!input.phone?.trim()) throw fail('El teléfono del consultorio es obligatorio.')
  if (!input.ownerName?.trim()) throw fail('Su nombre es obligatorio.')
  if (!EMAIL_RE.test(input.email ?? '')) throw fail('Ingrese un correo electrónico válido.')
  if ((input.password ?? '').length < 8) throw fail('La contraseña debe tener al menos 8 caracteres.')
}

/**
 * Create a clinic + owner + a little sample data atomically (spec §3.1). On any
 * failure the transaction rolls back so nothing dangles. Email uniqueness is
 * checked *before* any write, so a duplicate email can never leave an orphan
 * tenant even when the Mongo deployment has no replica set (no real transaction).
 */
export async function signupClinic(
  payload: Payload,
  input: SignupInput,
  opts: SignupOptions = {},
): Promise<SignupResult> {
  validate(input)

  const requireVerify = opts.requireEmailVerification ?? emailEnabled()
  const verification = requireVerify ? createVerificationToken() : null
  const email = input.email.trim().toLowerCase()

  // Pre-check: a friendly, specific error and guaranteed atomicity on the most
  // common failure (someone signing up twice).
  const clash = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (clash.totalDocs > 0) {
    throw new APIError('Ya existe una cuenta con este correo.', 409, {
      code: ERROR_CODES.SIGNUP_EMAIL_TAKEN,
    })
  }

  const slug = await uniqueSlug(payload, input.clinicName)
  const individual = (input.practiceType ?? 'individual') === 'individual'

  // The clinic + its owner are the atomic unit — both or neither (a tenant with no
  // owner is unusable; an owner with no tenant is an orphan). Mirrors createClinic.
  const txn = await payload.db.beginTransaction()
  const req = txn ? ({ transactionID: txn } as never) : undefined

  let tenantId: string
  let ownerId: string
  try {
    const tenant = await payload.create({
      collection: 'tenants',
      overrideAccess: true,
      req,
      data: {
        name: input.clinicName.trim(),
        slug,
        phone: input.phone.trim(),
        city: input.city?.trim() || undefined,
        country: input.country?.trim() || undefined,
        // Self-serve clinics start pending — a super admin must approve before the
        // owner can sign in (v3 §3.2, admin-approval onboarding).
        status: 'pending',
        plan: 'free',
        practiceType: individual ? 'individual' : 'clinic',
        onboardingSource: 'self-serve',
        settings: {
          appointmentDurationMins: DEFAULT_APPOINTMENT_DURATION,
          openTime: DEFAULT_OPEN_TIME,
          closeTime: DEFAULT_CLOSE_TIME,
          currency: input.currency,
          timezone: input.timezone,
        },
      } as never,
    })

    const owner = await payload.create({
      collection: 'users',
      overrideAccess: true,
      req,
      data: {
        name: input.ownerName.trim(),
        email,
        password: input.password,
        role: 'owner',
        tenant: tenant.id,
        // Independent doctor: the owner is the practitioner — bookable, authors
        // visits and prescriptions, counts as the plan's one doctor.
        ...(individual
          ? {
              practitioner: true,
              specialty: input.specialty?.trim() || undefined,
              licenseNumber: input.licenseNumber?.trim() || undefined,
              availabilityType: 'regular',
              availableDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
              availableFrom: DEFAULT_OPEN_TIME,
              availableTo: DEFAULT_CLOSE_TIME,
            }
          : {}),
        // Only the token's hash is stored; the raw token goes out by email once.
        ...(verification
          ? {
              emailVerified: false,
              verifyTokenHash: verification.hash,
              verifyTokenExp: verification.expiresAt.toISOString(),
            }
          : {}),
      } as never,
    })

    if (txn) await payload.db.commitTransaction(txn)
    tenantId = String(tenant.id)
    ownerId = String(owner.id)
  } catch (err) {
    if (txn) await payload.db.rollbackTransaction(txn)
    throw err
  }

  // Sample data is enrichment, not core: it runs *after* the commit, best-effort and
  // outside any transaction. A hiccup here (a busy slot, a hook quirk) must never
  // sink a real signup — worst case the clinic opens a little emptier and the welcome
  // checklist simply shows the steps as still to-do.
  try {
    await seedSampleData(payload, tenantId, individual ? ownerId : null, input.timezone)
  } catch (err) {
    payload.logger?.error?.({ err, msg: 'signup: sample data failed (non-fatal)' })
  }

  return { tenantId, ownerId, slug, ...(verification ? { verificationToken: verification.token } : {}) }
}

// A brand-new clinic shouldn't open onto an empty screen (spec §3.1.e). We seed
// three sample patients and two appointments today. An independent practice books
// them with the owner (who is the doctor); a clinic gets a sample doctor (the free
// plan's one slot — the owner edits it into their real one). Everything is clearly
// marked "(ejemplo)" so it's obvious what to delete.
async function seedSampleData(
  payload: Payload,
  tenantId: string,
  practitionerId: string | null,
  timezone: string,
): Promise<void> {
  const doctor = practitionerId ? { id: practitionerId } : await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      name: 'Dr. Ejemplo (edíteme)',
      email: `dr.sample@${tenantId}.example`,
      password: `sample-${tenantId}`,
      role: 'doctor',
      tenant: tenantId,
      active: true,
      specialty: 'Medicina general',
      consultationFee: 1000,
      availabilityType: 'regular',
      availableFrom: '09:00',
      availableTo: '17:00',
    } as never,
  })

  const patientNames = ['Paciente de ejemplo — María', 'Paciente de ejemplo — José', 'Paciente de ejemplo — Ana']
  const patientIds: string[] = []
  for (let i = 0; i < patientNames.length; i++) {
    const p = await payload.create({
      collection: 'patients',
      overrideAccess: true,
      data: {
        tenant: tenantId,
        name: patientNames[i],
        phone: `+1809555000${i + 1}`,
        gender: i % 2 === 0 ? 'female' : 'male',
        ageYears: 28 + i * 5,
      } as never,
    })
    patientIds.push(String(p.id))
  }

  // Two appointments today at non-overlapping times so the Day Rail is alive.
  // "Today" and the slot hours are the clinic's wall clock, not the server's.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: timezone || DEFAULT_TIMEZONE })
  const slots = [
    { h: 11, m: 0, reason: 'Ejemplo — fiebre' },
    { h: 11, m: 30, reason: 'Ejemplo — seguimiento' },
  ]
  for (let i = 0; i < slots.length; i++) {
    const start = wallTimeToUTC(
      timezone || DEFAULT_TIMEZONE,
      today,
      `${String(slots[i].h).padStart(2, '0')}:${String(slots[i].m).padStart(2, '0')}`,
    )
    try {
      await payload.create({
        collection: 'appointments',
        overrideAccess: true,
        data: {
          tenant: tenantId,
          patient: patientIds[i],
          doctor: doctor.id,
          start: start.toISOString(),
          durationMins: DEFAULT_APPOINTMENT_DURATION,
          reason: slots[i].reason,
          status: 'scheduled',
        } as never,
      })
    } catch {
      // Sample appointments are best-effort — a slot quirk must never sink a real
      // signup. The clinic, owner and patients are what matter.
    }
  }
}
