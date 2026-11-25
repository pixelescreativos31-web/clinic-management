// Two-step verification primitives (spec §10): TOTP (RFC 6238), one-time backup
// codes, secret encryption and the signed "remember this device" token.
//
// Pure node:crypto, no Payload imports, so it can be unit tested on its own.
// The server-side flows that read and write users live in src/lib/twoFactorServer.ts.
//
// Keys are derived from PAYLOAD_SECRET. Rotating that secret invalidates every
// enrolled authenticator (secrets can no longer be decrypted) and every trusted
// device; the owner then resets 2FA for the team. That is documented in
// docs/SEGURIDAD.md.

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const TOTP_PERIOD_S = 30
export const TOTP_DIGITS = 6
/** Steps accepted on each side of "now" (±30 s) for clock drift. */
export const TOTP_WINDOW = 1
export const BACKUP_CODE_COUNT = 10
export const TRUSTED_DEVICE_DAYS = 30
/** Wrong codes in a row before a short lock. */
export const MAX_CODE_ATTEMPTS = 5
export const CODE_LOCK_MS = 10 * 60 * 1000
export const ISSUER = 'medira'

// ---- Base32 (RFC 4648, no padding) ------------------------------------------

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = B32.indexOf(ch)
    if (idx < 0) throw new Error('Invalid base32 character')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

// ---- TOTP ------------------------------------------------------------------

/** A new random secret (160 bits, the RFC 4226 recommendation), base32. */
export function generateSecret(): string {
  return base32Encode(randomBytes(20))
}

export const timeStep = (atMs: number = Date.now()): number => Math.floor(atMs / 1000 / TOTP_PERIOD_S)

/** HOTP value for a counter (RFC 4226 §5.3). */
export function hotp(secretB32: string, counter: number): string {
  const key = base32Decode(secretB32)
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const h = createHmac('sha1', key).update(msg).digest()
  const offset = h[h.length - 1] & 0x0f
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3]
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0')
}

export const totp = (secretB32: string, atMs: number = Date.now()): string => hotp(secretB32, timeStep(atMs))

/** Digits only: users type "123 456" or paste with spaces. */
export const normalizeCode = (code: string): string => String(code ?? '').replace(/[\s-]/g, '')

/**
 * Check a 6-digit code against the secret within ±TOTP_WINDOW steps.
 * Returns the matched time step, or null. Callers store the step and pass it as
 * `lastUsedStep` next time, so a code cannot be replayed.
 */
export function verifyTotp(
  secretB32: string,
  code: string,
  opts: { atMs?: number; lastUsedStep?: number | null } = {},
): number | null {
  const c = normalizeCode(code)
  if (!/^\d{6}$/.test(c)) return null
  const now = timeStep(opts.atMs ?? Date.now())
  for (let d = -TOTP_WINDOW; d <= TOTP_WINDOW; d++) {
    const step = now + d
    if (opts.lastUsedStep != null && step <= opts.lastUsedStep) continue
    if (safeEqual(hotp(secretB32, step), c)) return step
  }
  return null
}

/** otpauth:// URI for the QR code (Key Uri Format). */
export function otpauthUri(secretB32: string, accountEmail: string): string {
  const label = encodeURIComponent(`${ISSUER}:${accountEmail}`)
  const params = new URLSearchParams({
    secret: secretB32,
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_S),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

/** "JBSW Y3DP EHPK 3PXP" — easier to type into an app by hand. */
export const groupSecret = (secretB32: string): string => secretB32.replace(/(.{4})/g, '$1 ').trim()

// ---- Backup codes -----------------------------------------------------------

// No 0/O/1/I/L: codes are read off paper.
const BACKUP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Ten "XXXXX-XXXXX" one-time codes. Only their hashes are stored. */
export function generateBackupCodes(n = BACKUP_CODE_COUNT): string[] {
  const codes: string[] = []
  for (let i = 0; i < n; i++) {
    const bytes = randomBytes(10)
    let s = ''
    for (const b of bytes) s += BACKUP_ALPHABET[b % BACKUP_ALPHABET.length]
    codes.push(`${s.slice(0, 5)}-${s.slice(5)}`)
  }
  return codes
}

export const normalizeBackupCode = (code: string): string => String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Looks like a backup code (10 letters/digits), not a 6-digit TOTP. */
export const isBackupCodeShape = (code: string): boolean => normalizeBackupCode(code).length === 10

export function hashBackupCode(code: string): string {
  return createHash('sha256').update(`medira-backup|${normalizeBackupCode(code)}`).digest('hex')
}

// ---- Secret encryption (AES-256-GCM) ---------------------------------------

function deriveKey(purpose: string): Buffer {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET is required for two-step verification')
  return createHash('sha256').update(`${secret}|${purpose}`).digest()
}

/** "v1.<iv>.<tag>.<ciphertext>" (base64url parts). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey('2fa-secret'), iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.')
}

export function decryptSecret(enc: string): string | null {
  try {
    const [v, iv, tag, ct] = String(enc).split('.')
    if (v !== 'v1' || !iv || !tag || !ct) return null
    const decipher = createDecipheriv('aes-256-gcm', deriveKey('2fa-secret'), Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

// ---- Signed tokens (trusted device) -----------------------------------------

function sign(payload: string, purpose: string): string {
  return createHmac('sha256', deriveKey(purpose)).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/**
 * "Remember this device for 30 days". Bound to the user and to their 2FA epoch:
 * resetting or re-enrolling 2FA bumps the epoch and voids every remembered device.
 */
export function signTrustedDevice(userID: string, epoch: number, nowMs: number = Date.now()): string {
  const exp = nowMs + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000
  const body = `${userID}.${epoch}.${exp}`
  return `${Buffer.from(body).toString('base64url')}.${sign(body, '2fa-device')}`
}

export function verifyTrustedDevice(
  token: string | null | undefined,
  userID: string,
  epoch: number,
  nowMs: number = Date.now(),
): boolean {
  if (!token) return false
  const [b64, sig] = token.split('.')
  if (!b64 || !sig) return false
  let body: string
  try {
    body = Buffer.from(b64, 'base64url').toString('utf8')
  } catch {
    return false
  }
  if (!safeEqual(sign(body, '2fa-device'), sig)) return false
  const [uid, ep, exp] = body.split('.')
  return uid === userID && Number(ep) === epoch && Number(exp) > nowMs
}

export const TRUSTED_DEVICE_COOKIE = 'medira-2fa-device'
