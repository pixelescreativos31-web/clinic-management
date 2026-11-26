// beforeLogin guard for two-step verification (spec §10).
//
// Payload runs beforeLogin AFTER the password was accepted and BEFORE it signs the
// session token, for both login and reset-password. So this is the one place that
// covers every way of getting a session: the app's login form, the REST endpoint
// /api/users/login and /api/users/reset-password. Throwing here rolls the login back
// (no session is created).
//
// The only way through for a user with 2FA on is a server-set request context —
// something a REST client cannot send:
//   - `twoFactor.passedFor = <user id>`: the login action already checked the code;
//   - `twoFactor.trustedDevice = <token>`: a valid «remember this device» cookie;
//   - `twoFactor.passwordReset = true`: the app's reset flow, which discards the
//     token Payload issues (the user then logs in normally, with their code).

import type { CollectionBeforeLoginHook } from 'payload'
import { APIError } from 'payload'
import { ERROR_CODES } from '@/lib/constants'
import { verifyTrustedDevice } from '@/lib/twoFactor'

export type TwoFactorLoginContext = {
  passedFor?: string
  trustedDevice?: string | null
  passwordReset?: boolean
}

export const twoFactorLoginGuard: CollectionBeforeLoginHook = ({ user, context }) => {
  const u = user as { id: string | number; twoFactorEnabled?: boolean | null; twoFactor?: { epoch?: number | null } | null }
  if (u.twoFactorEnabled !== true) return user

  const ctx = (context?.twoFactor ?? {}) as TwoFactorLoginContext
  const id = String(u.id)
  if (ctx.passwordReset === true) return user
  if (ctx.passedFor && ctx.passedFor === id) return user
  if (verifyTrustedDevice(ctx.trustedDevice, id, Number(u.twoFactor?.epoch ?? 0))) return user

  throw new APIError('Escriba el código de su app autenticadora.', 401, { code: ERROR_CODES.TWO_FACTOR_REQUIRED })
}
