'use server'

import { headers } from 'next/headers'
import { getPayloadClient } from '@/lib/auth'
import { requestPasswordReset } from '@/lib/passwordReset'
import { rateLimit } from '@/lib/rateLimit'
import { ERROR_CODES } from '@/lib/constants'
import type { ActionResult } from '@/lib/errors'

// Same paranoid-but-cheap posture as signup: an IP gets a few requests per hour.
// Success is always generic — whether the account exists is never revealed.
const MAX_RESETS_PER_HOUR = 5

async function clientIp(): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return h.get('x-real-ip') ?? 'unknown'
}

export async function forgotPasswordAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const email = String(formData.get('email') || '')
    .trim()
    .toLowerCase()
  if (!email) {
    return { ok: false, code: ERROR_CODES.VALIDATION, message: 'Ingrese su correo electrónico.' }
  }

  const ip = await clientIp()
  if (!rateLimit(`forgot:${ip}`, MAX_RESETS_PER_HOUR).allowed) {
    return {
      ok: false,
      code: ERROR_CODES.SIGNUP_RATE_LIMITED,
      message: 'Demasiadas solicitudes de restablecimiento desde esta red. Inténtelo más tarde.',
    }
  }

  const payload = await getPayloadClient()
  const summary = await requestPasswordReset(payload, email)
  if (!summary.sent) {
    // Logged for the operator; the user sees the same success either way.
    payload.logger?.info?.({ skipped: summary.skipped }, 'password reset not sent')
  }
  return { ok: true, data: null }
}
