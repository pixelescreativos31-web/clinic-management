// Server-side two-step verification flows (spec §10): enroll, verify at login,
// backup codes, disable, owner reset, clinic-wide requirement and grace period.
//
// Storage: `users.twoFactor` (hidden group: encrypted secret, backup-code hashes,
// epoch, replay step, failed attempts) plus the readable flag `users.twoFactorEnabled`.
// Both are written ONLY here, with payload.db (no collection hooks, no transaction):
// a failed-attempt counter must persist even when the login it belongs to is
// rolled back.

import type { Payload, PayloadRequest } from 'payload'
import { APIError } from 'payload'
import QRCode from 'qrcode'
import { getTenantID } from '@/access'
import { logAudit } from '@/lib/audit'
import { ERROR_CODES, type AuditAction } from '@/lib/constants'
import {
  CODE_LOCK_MS,
  MAX_CODE_ATTEMPTS,
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateSecret,
  groupSecret,
  hashBackupCode,
  isBackupCodeShape,
  otpauthUri,
  verifyTotp,
} from '@/lib/twoFactor'
import { canDisableTwoFactor, graceFrom } from '@/lib/twoFactorPolicy'
import type { Tenant, User } from '@/payload-types'

type ID = string | number

export type TwoFactorData = {
  secretEnc?: string | null
  pendingSecretEnc?: string | null
  pendingAt?: string | null
  backupCodes?: { hash: string; usedAt?: string | null }[] | null
  enabledAt?: string | null
  /** Bumped on every enroll/reset/disable: voids remembered devices. */
  epoch?: number | null
  lastUsedStep?: number | null
  failedAttempts?: number | null
  lockedUntil?: string | null
}

type RawUser = {
  id: ID
  email?: string
  role?: string
  tenant?: unknown
  twoFactorEnabled?: boolean | null
  twoFactor?: TwoFactorData | null
}

/** Pending (scanned but unconfirmed) secrets expire after 15 minutes. */
const PENDING_TTL_MS = 15 * 60 * 1000

const fail = (message: string, code: string = ERROR_CODES.TWO_FACTOR_INVALID, status = 400) =>
  new APIError(message, status, { code })

async function rawUser(payload: Payload, id: ID): Promise<RawUser | null> {
  return (await payload.db.findOne({ collection: 'users', where: { id: { equals: id } } })) as RawUser | null
}

async function rawUserByEmail(payload: Payload, email: string): Promise<RawUser | null> {
  return (await payload.db.findOne({
    collection: 'users',
    where: { email: { equals: email.trim().toLowerCase() } },
  })) as RawUser | null
}

async function write(payload: Payload, id: ID, twoFactor: TwoFactorData, enabled?: boolean): Promise<void> {
  await payload.db.updateOne({
    collection: 'users',
    id,
    data: { twoFactor, ...(enabled === undefined ? {} : { twoFactorEnabled: enabled }) },
  })
}

async function audit(
  payload: Payload,
  actor: { id: ID; tenant?: unknown },
  action: AuditAction,
  target: ID,
  summary: string,
): Promise<void> {
  const tenantID = getTenantID(actor as User)
  await logAudit({ payload, user: actor } as unknown as PayloadRequest, {
    action,
    targetCollection: 'users',
    targetId: String(target),
    summary,
    tenantID,
    userID: String(actor.id),
  })
}

export const twoFactorEpoch = (u: { twoFactor?: TwoFactorData | null }): number => Number(u.twoFactor?.epoch ?? 0)

/** The data the login guard needs, for a user id. */
export async function loadTwoFactor(payload: Payload, id: ID): Promise<{ enabled: boolean; epoch: number } | null> {
  const u = await rawUser(payload, id)
  if (!u) return null
  return { enabled: u.twoFactorEnabled === true, epoch: twoFactorEpoch(u) }
}

// ---- Verification -----------------------------------------------------------

export type CodeCheck = { ok: true; usedBackup: boolean; userID: ID } | { ok: false; code: string; message: string }

/**
 * Check a 6-digit authenticator code, or a backup code, for an enrolled user.
 * Counts failures: after 5 wrong codes in a row the account refuses codes for
 * 10 minutes. A matched TOTP step is stored so the same code cannot be replayed;
 * a backup code is spent.
 */
export async function verifyCodeFor(payload: Payload, u: RawUser, rawCode: string): Promise<CodeCheck> {
  const tf: TwoFactorData = { ...(u.twoFactor ?? {}) }
  const now = Date.now()
  if (tf.lockedUntil && new Date(tf.lockedUntil).getTime() > now) {
    return {
      ok: false,
      code: ERROR_CODES.TWO_FACTOR_LOCKED,
      message: 'Demasiados códigos incorrectos. Espere 10 minutos e intente de nuevo.',
    }
  }
  const secret = tf.secretEnc ? decryptSecret(tf.secretEnc) : null
  if (u.twoFactorEnabled !== true || !secret) {
    return { ok: false, code: ERROR_CODES.TWO_FACTOR_INVALID, message: 'La verificación en dos pasos no está activa en esta cuenta.' }
  }

  let usedBackup = false
  let matched = false
  if (isBackupCodeShape(rawCode)) {
    const h = hashBackupCode(rawCode)
    const entry = (tf.backupCodes ?? []).find((c) => c.hash === h && !c.usedAt)
    if (entry) {
      entry.usedAt = new Date(now).toISOString()
      tf.backupCodes = [...(tf.backupCodes ?? [])]
      matched = true
      usedBackup = true
    }
  } else {
    const step = verifyTotp(secret, rawCode, { atMs: now, lastUsedStep: tf.lastUsedStep ?? null })
    if (step !== null) {
      tf.lastUsedStep = step
      matched = true
    }
  }

  if (!matched) {
    const attempts = Number(tf.failedAttempts ?? 0) + 1
    tf.failedAttempts = attempts >= MAX_CODE_ATTEMPTS ? 0 : attempts
    if (attempts >= MAX_CODE_ATTEMPTS) tf.lockedUntil = new Date(now + CODE_LOCK_MS).toISOString()
    await write(payload, u.id, tf)
    return { ok: false, code: ERROR_CODES.TWO_FACTOR_INVALID, message: 'Código incorrecto. Revise su app e intente de nuevo.' }
  }

  tf.failedAttempts = 0
  tf.lockedUntil = null
  await write(payload, u.id, tf)
  if (usedBackup) {
    const left = (tf.backupCodes ?? []).filter((c) => !c.usedAt).length
    await audit(payload, u, '2fa.backup-used', u.id, `Entró con un código de respaldo (le quedan ${left})`)
  }
  return { ok: true, usedBackup, userID: u.id }
}

/** Login step 2: the code typed after a correct password. */
export async function verifyLoginCode(payload: Payload, email: string, code: string): Promise<CodeCheck> {
  const u = await rawUserByEmail(payload, email)
  if (!u) return { ok: false, code: ERROR_CODES.TWO_FACTOR_INVALID, message: 'Código incorrecto.' }
  return verifyCodeFor(payload, u, code)
}

/** Re-confirm a sensitive action with the actor's own code. Throws on failure. */
export async function assertOwnCode(payload: Payload, userID: ID, code: string): Promise<void> {
  const u = await rawUser(payload, userID)
  if (!u) throw fail('Código incorrecto.')
  const res = await verifyCodeFor(payload, u, code)
  if (!res.ok) throw fail(res.message, res.code)
}

// ---- Enrollment -------------------------------------------------------------

export type EnrollmentStart = { secret: string; groupedSecret: string; uri: string; qrSvg: string }

/**
 * Step 1: a fresh secret, stored encrypted as "pending" until a code proves the
 * app has it. Re-enrolling an active 2FA (new phone) first needs the current code.
 */
export async function startEnrollment(payload: Payload, user: { id: ID }, currentCode?: string): Promise<EnrollmentStart> {
  const u = await rawUser(payload, user.id)
  if (!u?.email) throw fail('Usuario no encontrado.', ERROR_CODES.VALIDATION)
  if (u.twoFactorEnabled === true) {
    if (!currentCode) throw fail('Escriba un código de su app actual para configurar otra.', ERROR_CODES.TWO_FACTOR_REQUIRED)
    const res = await verifyCodeFor(payload, u, currentCode)
    if (!res.ok) throw fail(res.message, res.code)
  }
  const fresh = (await rawUser(payload, user.id))!
  const secret = generateSecret()
  const tf: TwoFactorData = {
    ...(fresh.twoFactor ?? {}),
    pendingSecretEnc: encryptSecret(secret),
    pendingAt: new Date().toISOString(),
  }
  await write(payload, u.id, tf)
  const uri = otpauthUri(secret, u.email)
  const qrSvg = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', width: 200 })
  return { secret, groupedSecret: groupSecret(secret), uri, qrSvg }
}

/**
 * Step 2: the code from the app. Activates 2FA (or swaps in the new secret),
 * issues 10 backup codes (returned once, stored hashed) and voids remembered devices.
 */
export async function confirmEnrollment(payload: Payload, user: { id: ID }, code: string): Promise<string[]> {
  const u = await rawUser(payload, user.id)
  const tf: TwoFactorData = { ...(u?.twoFactor ?? {}) }
  const pending = tf.pendingSecretEnc ? decryptSecret(tf.pendingSecretEnc) : null
  const fresh = tf.pendingAt && Date.now() - new Date(tf.pendingAt).getTime() < PENDING_TTL_MS
  if (!u || !pending || !fresh) {
    throw fail('La configuración venció. Empiece de nuevo para ver un código QR nuevo.', ERROR_CODES.VALIDATION)
  }
  const step = verifyTotp(pending, code)
  if (step === null) throw fail('Código incorrecto. Revise que la hora de su teléfono sea automática e intente de nuevo.')

  const wasEnabled = u.twoFactorEnabled === true
  const codes = generateBackupCodes()
  const next: TwoFactorData = {
    secretEnc: encryptSecret(pending),
    pendingSecretEnc: null,
    pendingAt: null,
    backupCodes: codes.map((c) => ({ hash: hashBackupCode(c), usedAt: null })),
    enabledAt: new Date().toISOString(),
    epoch: twoFactorEpoch(u) + 1,
    lastUsedStep: step,
    failedAttempts: 0,
    lockedUntil: null,
  }
  await write(payload, u.id, next, true)
  await audit(
    payload,
    u,
    '2fa.enabled',
    u.id,
    wasEnabled ? 'Configuró la verificación en dos pasos en otra app' : 'Activó la verificación en dos pasos',
  )
  return codes
}

/** New set of 10 backup codes (the old ones stop working). Needs a current code. */
export async function regenerateBackupCodes(payload: Payload, user: { id: ID }, code: string): Promise<string[]> {
  await assertOwnCode(payload, user.id, code)
  const u = (await rawUser(payload, user.id))!
  const codes = generateBackupCodes()
  await write(payload, u.id, { ...(u.twoFactor ?? {}), backupCodes: codes.map((c) => ({ hash: hashBackupCode(c), usedAt: null })) })
  await audit(payload, u, '2fa.backup-regenerated', u.id, 'Generó códigos de respaldo nuevos')
  return codes
}

export async function backupCodesLeft(payload: Payload, id: ID): Promise<number> {
  const u = await rawUser(payload, id)
  return (u?.twoFactor?.backupCodes ?? []).filter((c) => !c.usedAt).length
}

const cleared = (u: RawUser): TwoFactorData => ({
  secretEnc: null,
  pendingSecretEnc: null,
  pendingAt: null,
  backupCodes: [],
  enabledAt: null,
  epoch: twoFactorEpoch(u) + 1,
  lastUsedStep: null,
  failedAttempts: 0,
  lockedUntil: null,
})

/** Turn 2FA off for yourself. Refused when it is required for you. Needs a current code. */
export async function disableOwnTwoFactor(
  payload: Payload,
  user: { id: ID; role?: string | null },
  tenant: Tenant | null,
  code: string,
): Promise<void> {
  if (!canDisableTwoFactor(user, tenant)) {
    throw fail('En su cuenta la verificación en dos pasos es obligatoria y no se puede desactivar.', ERROR_CODES.FORBIDDEN, 403)
  }
  await assertOwnCode(payload, user.id, code)
  const u = (await rawUser(payload, user.id))!
  await write(payload, u.id, cleared(u), false)
  await audit(payload, u, '2fa.disabled', u.id, 'Desactivó la verificación en dos pasos')
}

/**
 * The Titular resets a team member who lost their phone (spec §10 «Perdió el
 * teléfono»). Same clinic only, never themselves or another Titular, and confirmed
 * with the Titular's own code. The member enrolls again on next login.
 */
export async function resetMemberTwoFactor(
  payload: Payload,
  actor: { id: ID; role?: string | null; tenant?: unknown },
  memberID: ID,
  actorCode: string,
): Promise<void> {
  if (actor.role !== 'owner') throw fail('Solo el Titular puede restablecer la verificación de otra persona.', ERROR_CODES.FORBIDDEN, 403)
  const member = await rawUser(payload, memberID)
  const actorTenant = getTenantID(actor as User)
  if (!member || !actorTenant || getTenantID(member as unknown as User) !== actorTenant) {
    throw fail('No encontramos a esa persona en su equipo.', ERROR_CODES.FORBIDDEN, 403)
  }
  if (String(member.id) === String(actor.id) || member.role === 'owner') {
    throw fail('El Titular no puede restablecer su propia verificación. Use un código de respaldo o escriba a soporte.', ERROR_CODES.FORBIDDEN, 403)
  }
  await assertOwnCode(payload, actor.id, actorCode)
  await write(payload, member.id, cleared(member), false)
  await audit(payload, actor, '2fa.reset', member.id, `Restableció la verificación en dos pasos de ${member.email ?? 'un miembro del equipo'}`)
}

// ---- Clinic policy ----------------------------------------------------------

/** Merge into tenants.settings.security without touching any other setting. */
async function patchSecurity(payload: Payload, tenantID: ID, patch: Record<string, unknown>): Promise<void> {
  const t = (await payload.db.findOne({ collection: 'tenants', where: { id: { equals: tenantID } } })) as {
    settings?: Record<string, unknown> & { security?: Record<string, unknown> }
  } | null
  if (!t) return
  const settings = { ...(t.settings ?? {}), security: { ...(t.settings?.security ?? {}), ...patch } }
  await payload.db.updateOne({ collection: 'tenants', id: tenantID, data: { settings } })
}

/**
 * Existing clinics get 14 days from the first time anyone sees the 2FA
 * reminder. Idempotent: only sets the date when it is missing.
 */
export async function ensureTwoFactorGrace(payload: Payload, tenant: Tenant | null): Promise<Tenant | null> {
  if (!tenant) return tenant
  if (tenant.settings?.security?.twoFactorGraceUntil) return tenant
  const until = graceFrom(new Date()).toISOString()
  await patchSecurity(payload, tenant.id, { twoFactorGraceUntil: until })
  return {
    ...tenant,
    settings: { ...(tenant.settings ?? {}), security: { ...(tenant.settings?.security ?? {}), twoFactorGraceUntil: until } },
  } as Tenant
}

/** «Exigir 2FA a todo el equipo». Turning it OFF weakens security, so it needs the Titular's code. */
export async function setRequireAll(
  payload: Payload,
  actor: { id: ID; role?: string | null; tenant?: unknown },
  value: boolean,
  actorCode?: string,
): Promise<void> {
  if (actor.role !== 'owner') throw fail('Solo el Titular puede cambiar esta opción.', ERROR_CODES.FORBIDDEN, 403)
  const tenantID = getTenantID(actor as User)
  if (!tenantID) throw fail('Sin clínica.', ERROR_CODES.FORBIDDEN, 403)
  if (!value) await assertOwnCode(payload, actor.id, actorCode ?? '')
  await patchSecurity(payload, tenantID, { require2faAll: value })
  await audit(
    payload,
    actor,
    '2fa.required-changed',
    actor.id,
    value ? 'Exigió la verificación en dos pasos a todo el equipo' : 'Dejó de exigir la verificación en dos pasos a todo el equipo',
  )
}
