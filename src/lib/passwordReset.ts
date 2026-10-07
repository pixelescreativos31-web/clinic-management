// Self-serve password reset (BACKLOG §1.3). Token generation, hashing, expiry and
// single-use all come from Payload's own forgotPassword/resetPassword operations —
// we only deliver the link over the existing Resend wrapper. Kept out of the server
// actions so the flow is unit-testable without Next's headers()/cookies() (same
// split as lib/signup.ts).

import type { Payload } from 'payload'
import { APIError } from 'payload'
import { ERROR_CODES } from './constants'
import { appBaseUrl, sendEmail, type SendEmail } from './email'
import { APP_NAME } from './brand'

export type ResetRequestSummary = {
  sent: boolean
  /** Why nothing went out — for logs only, never for the UI (no account enumeration). */
  skipped?: string
}

/**
 * Issue a reset token for `email` and mail the link. Deliberately quiet about
 * whether the account exists — the caller shows the same "check your inbox"
 * message either way. Payload's default token expiry (1 hour) applies, and a
 * token is cleared after one successful reset.
 */
export async function requestPasswordReset(
  payload: Payload,
  email: string,
  send: SendEmail = sendEmail,
): Promise<ResetRequestSummary> {
  let token: null | string = null
  try {
    token = await payload.forgotPassword({
      collection: 'users',
      data: { email },
      disableEmail: true, // no Payload email adapter — delivery goes through Resend below
    })
  } catch {
    // Unknown email and success must be indistinguishable from the outside.
    return { sent: false, skipped: 'no account for that email' }
  }
  if (!token) return { sent: false, skipped: 'no account for that email' }

  const link = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`
  const res = await send({
    to: email,
    subject: `Restablezca su contraseña de ${APP_NAME}`,
    html: resetHtml(link),
  })
  if (res.ok) return { sent: true }
  return { sent: false, skipped: res.skipped ? 'email not configured' : res.error }
}

/**
 * Set a new password from a reset link. Invalid, expired and already-used tokens
 * all collapse into one RESET_TOKEN_INVALID — the distinction helps attackers,
 * not users.
 */
export async function confirmPasswordReset(
  payload: Payload,
  token: string,
  password: string,
): Promise<void> {
  if (!token) {
    throw new APIError('Este enlace para restablecer la contraseña no es válido o ya venció.', 400, {
      code: ERROR_CODES.RESET_TOKEN_INVALID,
    })
  }
  if ((password ?? '').length < 8) {
    throw new APIError('La contraseña debe tener al menos 8 caracteres.', 400, {
      code: ERROR_CODES.VALIDATION,
    })
  }
  try {
    await payload.resetPassword({
      collection: 'users',
      data: { token, password },
      overrideAccess: true, // there is no logged-in user; the token IS the credential
    })
  } catch {
    throw new APIError('Este enlace para restablecer la contraseña no es válido o ya venció.', 400, {
      code: ERROR_CODES.RESET_TOKEN_INVALID,
    })
  }
}

function resetHtml(link: string): string {
  return `<div style="font-family:Segoe UI,system-ui,sans-serif;color:#1c2422;max-width:520px">
    <h2 style="margin:0 0 2px;font-size:18px">Restablezca su contraseña</h2>
    <p style="margin:0 0 16px;color:#4b5f5a;font-size:14px">
      Alguien (esperamos que usted) solicitó restablecer la contraseña de esta cuenta de ${APP_NAME}.
    </p>
    <p style="margin:0 0 18px">
      <a href="${link}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">
        Elegir una nueva contraseña
      </a>
    </p>
    <p style="margin:0;font-size:12px;color:#8aa19b">
      El enlace funciona una sola vez y vence en 1 hora. Si usted no lo solicitó, ignore este correo: su contraseña seguirá igual.
    </p>
  </div>`
}
