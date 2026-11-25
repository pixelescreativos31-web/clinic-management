import { describe, it, expect, beforeAll } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, seedFixture, type Fixture } from './fixtures'
import { ERROR_CODES } from '@/lib/constants'
import {
  base32Encode,
  decryptSecret,
  encryptSecret,
  hotp,
  signTrustedDevice,
  totp,
  verifyTotp,
  verifyTrustedDevice,
} from '@/lib/twoFactor'
import { twoFactorGate, twoFactorRequirement, TWO_FACTOR_GRACE_DAYS } from '@/lib/twoFactorPolicy'
import {
  confirmEnrollment,
  disableOwnTwoFactor,
  ensureTwoFactorGrace,
  loadTwoFactor,
  regenerateBackupCodes,
  resetMemberTwoFactor,
  setRequireAll,
  startEnrollment,
  verifyLoginCode,
} from '@/lib/twoFactorServer'
import { confirmPasswordReset, requestPasswordReset } from '@/lib/passwordReset'
import type { Tenant, User } from '@/payload-types'

// Fase 1 — two-step verification (spec §10). Exercises the server flows directly
// (the server actions are thin wrappers) and Payload's own login, which is what the
// REST endpoint /api/users/login runs.

const PASSWORD = 'password123'

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise
  } catch (e) {
    const err = e as { data?: { code?: string }; code?: string }
    return err?.data?.code ?? err?.code ?? 'THREW'
  }
  return undefined
}

describe('Fase 1 — verificación en dos pasos', () => {
  let payload: Payload
  let fx: Fixture

  /** Enroll a user end to end; returns the secret and the backup codes. */
  async function enroll(user: { id: string | number }) {
    const started = await startEnrollment(payload, user)
    const codes = await confirmEnrollment(payload, user, totp(started.secret))
    return { secret: started.secret, codes }
  }

  /** Tests run faster than 30 s steps: forget the replay step between checks. */
  async function clearReplay(id: string | number) {
    const raw = (await payload.db.findOne({ collection: 'users', where: { id: { equals: id } } })) as { twoFactor?: Record<string, unknown> }
    await payload.db.updateOne({ collection: 'users', id, data: { twoFactor: { ...raw.twoFactor, lastUsedStep: null } } })
  }

  const rawUser = async (id: string | number) =>
    (await payload.db.findOne({ collection: 'users', where: { id: { equals: id } } })) as Record<string, any>

  beforeAll(async () => {
    payload = await getTestPayload()
    fx = await seedFixture(payload)
  })

  describe('TOTP y utilidades', () => {
    it('matches the RFC 6238 SHA-1 test vector', () => {
      const secret = base32Encode(Buffer.from('12345678901234567890'))
      expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
      // RFC 6238 appendix B: T = 59 s → 94287082 (8 digits) → 287082 (6 digits).
      expect(totp(secret, 59_000)).toBe('287082')
      expect(hotp(secret, 1)).toBe('287082')
    })

    it('accepts ±30 s of drift, rejects replays and junk', () => {
      const secret = base32Encode(Buffer.from('12345678901234567890'))
      const at = 1_000_000_000_000
      expect(verifyTotp(secret, totp(secret, at - 30_000), { atMs: at })).not.toBeNull()
      expect(verifyTotp(secret, totp(secret, at + 30_000), { atMs: at })).not.toBeNull()
      expect(verifyTotp(secret, totp(secret, at - 90_000), { atMs: at })).toBeNull()
      const step = verifyTotp(secret, totp(secret, at), { atMs: at })!
      expect(verifyTotp(secret, totp(secret, at), { atMs: at, lastUsedStep: step })).toBeNull()
      expect(verifyTotp(secret, 'abc123', { atMs: at })).toBeNull()
      expect(verifyTotp(secret, totp(secret, at).replace(/(\d{3})/, '$1 '), { atMs: at })).not.toBeNull()
    })

    it('encrypts secrets (round trip, tamper-proof) and signs trusted devices', () => {
      const enc = encryptSecret('JBSWY3DPEHPK3PXP')
      expect(enc).not.toContain('JBSWY3DPEHPK3PXP')
      expect(decryptSecret(enc)).toBe('JBSWY3DPEHPK3PXP')
      expect(decryptSecret(enc.slice(0, -2) + 'AA')).toBeNull()

      const tok = signTrustedDevice('u1', 3, 0)
      expect(verifyTrustedDevice(tok, 'u1', 3, 1000)).toBe(true)
      expect(verifyTrustedDevice(tok, 'u2', 3, 1000)).toBe(false) // another user
      expect(verifyTrustedDevice(tok, 'u1', 4, 1000)).toBe(false) // 2FA was reset
      expect(verifyTrustedDevice(tok, 'u1', 3, 31 * 24 * 3600 * 1000)).toBe(false) // expired
      expect(verifyTrustedDevice(tok.replace(/.$/, 'x'), 'u1', 3, 1000)).toBe(false)
    })
  })

  describe('activación', () => {
    it('stores the secret encrypted, never readable through the API, and issues 10 backup codes', async () => {
      const owner = fx.a.owner
      const { secret, codes } = await enroll(owner)
      expect(codes).toHaveLength(10)
      expect(new Set(codes).size).toBe(10)

      const raw = await rawUser(owner.id)
      expect(raw.twoFactorEnabled).toBe(true)
      expect(raw.twoFactor.secretEnc).not.toContain(secret)
      expect(JSON.stringify(raw.twoFactor.backupCodes)).not.toContain(codes[0])
      expect(raw.twoFactor.pendingSecretEnc).toBeNull()

      // Read as the user themselves (access enforced): flag yes, secrets no.
      const self = (await payload.findByID({ collection: 'users', id: owner.id, overrideAccess: false, user: owner as User })) as User & {
        twoFactor?: unknown
      }
      expect(self.twoFactorEnabled).toBe(true)
      expect(self.twoFactor).toBeUndefined()
    })

    it('rejects a wrong confirmation code and never enables', async () => {
      const recept = fx.b.receptionist
      await startEnrollment(payload, recept)
      expect(await codeOf(confirmEnrollment(payload, recept, '000000'))).toBe(ERROR_CODES.TWO_FACTOR_INVALID)
      expect((await rawUser(recept.id)).twoFactorEnabled).not.toBe(true)
    })

    it('the flag cannot be set through the API', async () => {
      const recept = fx.b.receptionist
      await payload.update({
        collection: 'users',
        id: recept.id,
        data: { twoFactorEnabled: true } as never,
        overrideAccess: false,
        user: recept as User,
      })
      expect((await rawUser(recept.id)).twoFactorEnabled).not.toBe(true)
    })

    it('re-enrolling (new phone) needs the current code', async () => {
      const doctor = fx.b.doctor
      const first = await enroll(doctor)
      expect(await codeOf(startEnrollment(payload, doctor))).toBe(ERROR_CODES.TWO_FACTOR_REQUIRED)
      await clearReplay(doctor.id)
      const again = await startEnrollment(payload, doctor, totp(first.secret))
      await confirmEnrollment(payload, doctor, totp(again.secret))
      const epoch = (await loadTwoFactor(payload, doctor.id))!.epoch
      expect(epoch).toBe(2)
    })
  })

  describe('inicio de sesión', () => {
    it('Payload login (= REST /api/users/login) refuses a 2FA user without a code', async () => {
      expect(
        await codeOf(payload.login({ collection: 'users', data: { email: fx.a.owner.email, password: PASSWORD } })),
      ).toBe(ERROR_CODES.TWO_FACTOR_REQUIRED)
    })

    it('a wrong password still fails as a normal auth error (2FA is never revealed first)', async () => {
      const code = await codeOf(payload.login({ collection: 'users', data: { email: fx.a.owner.email, password: 'wrong-password' } }))
      expect(code).not.toBe(ERROR_CODES.TWO_FACTOR_REQUIRED)
    })

    it('users without 2FA log in as before', async () => {
      const res = await payload.login({ collection: 'users', data: { email: fx.a.receptionist.email, password: PASSWORD } })
      expect(res.token).toBeTruthy()
    })

    it('a verified code lets the login through; a trusted device skips the code', async () => {
      const owner = await payload.create({
        collection: 'users',
        data: { name: 'Owner C', email: 'owner-c@clinic.test', password: PASSWORD, role: 'doctor', tenant: fx.a.tenant.id },
        overrideAccess: true,
      })
      const { secret } = await enroll(owner)
      await clearReplay(owner.id)

      expect((await verifyLoginCode(payload, owner.email, '123')).ok).toBe(false)
      const check = await verifyLoginCode(payload, owner.email, totp(secret))
      expect(check.ok).toBe(true)
      const res = await payload.login({
        collection: 'users',
        data: { email: owner.email, password: PASSWORD },
        context: { twoFactor: { passedFor: String(owner.id) } },
      })
      expect(res.token).toBeTruthy()

      // The same code cannot be used twice.
      expect((await verifyLoginCode(payload, owner.email, totp(secret))).ok).toBe(false)

      // passedFor for ANOTHER user does not help.
      expect(
        await codeOf(
          payload.login({
            collection: 'users',
            data: { email: owner.email, password: PASSWORD },
            context: { twoFactor: { passedFor: String(fx.a.doctor.id) } },
          }),
        ),
      ).toBe(ERROR_CODES.TWO_FACTOR_REQUIRED)

      const epoch = (await loadTwoFactor(payload, owner.id))!.epoch
      const device = signTrustedDevice(String(owner.id), epoch)
      const viaDevice = await payload.login({
        collection: 'users',
        data: { email: owner.email, password: PASSWORD },
        context: { twoFactor: { trustedDevice: device } },
      })
      expect(viaDevice.token).toBeTruthy()
    })

    it('a backup code works once', async () => {
      const recept = await payload.create({
        collection: 'users',
        data: { name: 'Recept D', email: 'recept-d@clinic.test', password: PASSWORD, role: 'receptionist', tenant: fx.a.tenant.id },
        overrideAccess: true,
      })
      const { codes } = await enroll(recept)
      const first = await verifyLoginCode(payload, recept.email, codes[3].toLowerCase())
      expect(first).toMatchObject({ ok: true, usedBackup: true })
      expect((await verifyLoginCode(payload, recept.email, codes[3])).ok).toBe(false)
      const raw = await rawUser(recept.id)
      expect((raw.twoFactor.backupCodes as { usedAt: string | null }[]).filter((c) => !c.usedAt)).toHaveLength(9)
    })

    it('locks codes for 10 minutes after 5 wrong ones', async () => {
      const u = await payload.create({
        collection: 'users',
        data: { name: 'Lock E', email: 'lock-e@clinic.test', password: PASSWORD, role: 'receptionist', tenant: fx.a.tenant.id },
        overrideAccess: true,
      })
      const { secret } = await enroll(u)
      await clearReplay(u.id)
      for (let i = 0; i < 5; i++) expect((await verifyLoginCode(payload, u.email, '000000')).ok).toBe(false)
      const locked = await verifyLoginCode(payload, u.email, totp(secret))
      expect(locked).toMatchObject({ ok: false, code: ERROR_CODES.TWO_FACTOR_LOCKED })
    })

    it('password reset still works for a 2FA user through the app, and never yields a session without the code', async () => {
      const owner = fx.a.owner
      const linkToken = async () => {
        let html = ''
        await requestPasswordReset(payload, owner.email, async (input) => {
          html = input.html
          return { ok: true }
        })
        return decodeURIComponent(html.match(/reset-password\?token=([A-Za-z0-9%._-]+)/)![1]!)
      }
      // Payload's own reset (what REST /api/users/reset-password runs) signs a
      // session at the end: the guard refuses it for a 2FA user.
      expect(
        await codeOf(payload.resetPassword({ collection: 'users', data: { token: await linkToken(), password: 'brand-new-pass-0' }, overrideAccess: true })),
      ).toBe(ERROR_CODES.TWO_FACTOR_REQUIRED)
      // …and short passwords are refused on that path too.
      expect(
        await codeOf(payload.resetPassword({ collection: 'users', data: { token: await linkToken(), password: 'short' }, overrideAccess: true })),
      ).toBe(ERROR_CODES.VALIDATION)

      // The app's flow passes; logging in afterwards still needs the code.
      await confirmPasswordReset(payload, await linkToken(), 'brand-new-pass-1')
      expect(
        await codeOf(payload.login({ collection: 'users', data: { email: owner.email, password: 'brand-new-pass-1' } })),
      ).toBe(ERROR_CODES.TWO_FACTOR_REQUIRED)
    })
  })

  describe('obligatoria, plazo y Titular', () => {
    const t = (over: Partial<Tenant['settings']> & { plan?: string } = {}) =>
      ({ plan: over.plan ?? 'pro', settings: { security: { ...(over as object) } } }) as unknown as Tenant

    it('decides who must use it', () => {
      expect(twoFactorRequirement({ role: 'owner' }, t())).toBe('owner')
      expect(twoFactorRequirement({ role: 'doctor' }, t())).toBeNull()
      expect(twoFactorRequirement({ role: 'doctor' }, t({ plan: 'plus' }))).toBe('plan')
      expect(twoFactorRequirement({ role: 'receptionist' }, { settings: { security: { require2faAll: true } } } as Tenant)).toBe('clinic')
      expect(twoFactorRequirement({ role: 'superAdmin' }, t())).toBeNull()
    })

    it('grace period: reminder first, enrollment screen after the date', () => {
      const now = new Date('2026-12-01T12:00:00Z')
      const future = { settings: { security: { twoFactorGraceUntil: '2026-12-10T12:00:00Z' } } } as Tenant
      const past = { settings: { security: { twoFactorGraceUntil: '2026-11-30T12:00:00Z' } } } as Tenant
      expect(twoFactorGate({ role: 'owner' }, future, now)).toMatchObject({ kind: 'grace', daysLeft: 9 })
      expect(twoFactorGate({ role: 'owner' }, past, now)).toEqual({ kind: 'enroll' })
      expect(twoFactorGate({ role: 'owner', twoFactorEnabled: true }, past, now)).toEqual({ kind: 'ok' })
      expect(twoFactorGate({ role: 'receptionist' }, past, now)).toEqual({ kind: 'ok' })
      expect(twoFactorGate({ role: 'owner' }, { settings: {} } as Tenant, now)).toMatchObject({
        kind: 'grace',
        daysLeft: TWO_FACTOR_GRACE_DAYS,
      })
    })

    it('existing clinics get 14 days once; other settings are untouched', async () => {
      const tenant = (await payload.findByID({ collection: 'tenants', id: fx.b.tenant.id, overrideAccess: true })) as Tenant
      expect(tenant.settings?.security?.twoFactorGraceUntil ?? null).toBeNull()
      const first = await ensureTwoFactorGrace(payload, tenant)
      const until = new Date(first!.settings!.security!.twoFactorGraceUntil!).getTime()
      expect(until - Date.now()).toBeGreaterThan((TWO_FACTOR_GRACE_DAYS - 1) * 86400_000)
      const reread = (await payload.findByID({ collection: 'tenants', id: fx.b.tenant.id, overrideAccess: true })) as Tenant
      expect(new Date(reread.settings!.security!.twoFactorGraceUntil!).getTime()).toBe(until)
      expect(reread.settings?.timezone).toBe(tenant.settings?.timezone)
      expect(reread.settings?.openTime).toBe(tenant.settings?.openTime)
      // Second call keeps the original date.
      await ensureTwoFactorGrace(payload, reread)
      const again = (await payload.findByID({ collection: 'tenants', id: fx.b.tenant.id, overrideAccess: true })) as Tenant
      expect(new Date(again.settings!.security!.twoFactorGraceUntil!).getTime()).toBe(until)
    })

    it('saving clinic settings keeps the security settings', async () => {
      await payload.update({
        collection: 'tenants',
        id: fx.b.tenant.id,
        data: { settings: { openTime: '07:30' } } as never,
        overrideAccess: true,
      })
      const t2 = (await payload.findByID({ collection: 'tenants', id: fx.b.tenant.id, overrideAccess: true })) as Tenant
      expect(t2.settings?.openTime).toBe('07:30')
      expect(t2.settings?.security?.twoFactorGraceUntil).toBeTruthy()
    })

    it('an owner cannot change the security settings through the API', async () => {
      const before = (await payload.findByID({ collection: 'tenants', id: fx.b.tenant.id, overrideAccess: true })) as Tenant
      await payload
        .update({
          collection: 'tenants',
          id: fx.b.tenant.id,
          data: { settings: { security: { twoFactorGraceUntil: '2099-01-01T00:00:00Z', require2faAll: false } } } as never,
          overrideAccess: false,
          user: fx.b.owner as User,
        })
        .catch(() => null)
      const after = (await payload.findByID({ collection: 'tenants', id: fx.b.tenant.id, overrideAccess: true })) as Tenant
      expect(after.settings?.security?.twoFactorGraceUntil).toBe(before.settings?.security?.twoFactorGraceUntil)
    })

    it('the Titular cannot turn it off; an optional user can, with a code', async () => {
      const tenantA = (await payload.findByID({ collection: 'tenants', id: fx.a.tenant.id, overrideAccess: true })) as Tenant
      expect(await codeOf(disableOwnTwoFactor(payload, fx.a.owner, tenantA, '000000'))).toBe(ERROR_CODES.FORBIDDEN)

      const u = await payload.create({
        collection: 'users',
        data: { name: 'Opt F', email: 'opt-f@clinic.test', password: PASSWORD, role: 'receptionist', tenant: fx.a.tenant.id },
        overrideAccess: true,
      })
      const { secret } = await enroll(u)
      await clearReplay(u.id)
      expect(await codeOf(disableOwnTwoFactor(payload, u, tenantA, '000000'))).toBe(ERROR_CODES.TWO_FACTOR_INVALID)
      await disableOwnTwoFactor(payload, u, tenantA, totp(secret))
      const raw = await rawUser(u.id)
      expect(raw.twoFactorEnabled).toBe(false)
      expect(raw.twoFactor.secretEnc).toBeNull()
      const res = await payload.login({ collection: 'users', data: { email: u.email, password: PASSWORD } })
      expect(res.token).toBeTruthy()
    })

    it('the Titular resets a member of their clinic only, confirming with their own code', async () => {
      // The owner of clinic A already enrolled above; read their secret back through a re-enroll.
      const ownerA = fx.a.owner
      const member = await payload.create({
        collection: 'users',
        data: { name: 'Lost G', email: 'lost-g@clinic.test', password: PASSWORD, role: 'receptionist', tenant: fx.a.tenant.id },
        overrideAccess: true,
      })
      await enroll(member)
      const ownerB = fx.b.owner
      const { secret: secretB } = await enroll(ownerB)
      await clearReplay(ownerB.id)

      // Another clinic's Titular: refused before the code is even checked.
      expect(await codeOf(resetMemberTwoFactor(payload, ownerB, member.id, totp(secretB)))).toBe(ERROR_CODES.FORBIDDEN)
      // Not a Titular: refused.
      expect(await codeOf(resetMemberTwoFactor(payload, fx.a.doctor, member.id, '000000'))).toBe(ERROR_CODES.FORBIDDEN)
      // Own clinic, wrong code: refused, member unchanged.
      expect(await codeOf(resetMemberTwoFactor(payload, ownerA, member.id, '000000'))).toBe(ERROR_CODES.TWO_FACTOR_INVALID)
      expect((await rawUser(member.id)).twoFactorEnabled).toBe(true)

      // Own clinic with a valid backup code of the Titular: done.
      const backup = await regenerateBackupCodesFor(ownerA)
      await resetMemberTwoFactor(payload, ownerA, member.id, backup[0])
      expect((await rawUser(member.id)).twoFactorEnabled).toBe(false)
      const res = await payload.login({ collection: 'users', data: { email: member.email, password: PASSWORD } })
      expect(res.token).toBeTruthy()

      // A Titular never resets themselves this way.
      expect(await codeOf(resetMemberTwoFactor(payload, ownerA, ownerA.id, backup[1]))).toBe(ERROR_CODES.FORBIDDEN)

      const audit = await payload.find({
        collection: 'auditLogs',
        where: { and: [{ tenant: { equals: fx.a.tenant.id } }, { action: { equals: '2fa.reset' } }] },
        overrideAccess: true,
      })
      expect(audit.totalDocs).toBe(1)
    })

    it('«Exigir a todos»: on freely, off only with the Titular code', async () => {
      const ownerB = fx.b.owner
      await setRequireAll(payload, ownerB, true)
      const tb = (await payload.findByID({ collection: 'tenants', id: fx.b.tenant.id, overrideAccess: true })) as Tenant
      expect(tb.settings?.security?.require2faAll).toBe(true)
      expect(twoFactorRequirement(fx.b.receptionist, tb)).toBe('clinic')
      expect(await codeOf(setRequireAll(payload, fx.b.doctor, false))).toBe(ERROR_CODES.FORBIDDEN)
      expect(await codeOf(setRequireAll(payload, ownerB, false, '000000'))).toBe(ERROR_CODES.TWO_FACTOR_INVALID)
    })
  })

  describe('contraseñas', () => {
    it('new passwords need at least 10 characters', async () => {
      expect(
        await codeOf(
          payload.create({
            collection: 'users',
            data: { name: 'Short', email: 'short@clinic.test', password: 'short1', role: 'receptionist', tenant: fx.a.tenant.id },
            overrideAccess: true,
          }),
        ),
      ).toBe(ERROR_CODES.VALIDATION)
    })
  })

  /** Fresh backup codes for a user whose secret the test no longer has (via a db reset of the replay step + regenerate with a backup code). */
  async function regenerateBackupCodesFor(user: { id: string | number }): Promise<string[]> {
    // Swap in a known secret, then use the normal API with its code.
    const started = await startEnrollmentWithBackup(user)
    await confirmEnrollment(payload, user, totp(started.secret))
    await clearReplay(user.id)
    return regenerateBackupCodes(payload, user, totp(started.secret))
  }

  async function startEnrollmentWithBackup(user: { id: string | number }) {
    // Re-enrolling needs a current code; a fresh set of backup codes is written
    // straight to the db so the test can authenticate the re-enroll.
    const { generateBackupCodes, hashBackupCode } = await import('@/lib/twoFactor')
    const codes = generateBackupCodes()
    const raw = await rawUser(user.id)
    await payload.db.updateOne({
      collection: 'users',
      id: user.id,
      data: { twoFactor: { ...raw.twoFactor, backupCodes: codes.map((c) => ({ hash: hashBackupCode(c), usedAt: null })) } },
    })
    return startEnrollment(payload, user, codes[0])
  }
})
