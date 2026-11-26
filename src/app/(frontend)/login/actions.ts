'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayloadClient } from '@/lib/auth'
import { ERROR_CODES } from '@/lib/constants'
import { toActionError, type ActionResult } from '@/lib/errors'
import { TRUSTED_DEVICE_COOKIE, TRUSTED_DEVICE_DAYS, signTrustedDevice } from '@/lib/twoFactor'
import { loadTwoFactor, verifyLoginCode } from '@/lib/twoFactorServer'

type LoginData = { role: string; next?: string }

const secureCookie = process.env.NODE_ENV === 'production'

/**
 * Two steps when the account has 2FA on (spec §10):
 *  1. email + password → if the password is right, Payload's beforeLogin guard
 *     answers TWO_FACTOR_REQUIRED and the form asks for the code (the password
 *     stays in the form, it is never stored server-side);
 *  2. email + password + code → the code is checked here, then the login runs
 *     again with a server-only context that lets the guard through.
 * A valid «remember this device» cookie skips step 2.
 */
export async function loginAction(
  _prev: ActionResult<LoginData> | null,
  formData: FormData,
): Promise<ActionResult<LoginData>> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const code = String(formData.get('code') || '').trim()
  const remember = formData.get('remember') === 'on'

  if (!email || !password) {
    return { ok: false, code: 'VALIDATION', message: 'Ingrese su correo y su contraseña.' }
  }

  const cookieStore = await cookies()
  const payload = await getPayloadClient()

  const finish = async (result: { token?: string; exp?: number; user?: unknown }, next?: string): Promise<ActionResult<LoginData>> => {
    if (!result.token) return { ok: false, code: 'VALIDATION', message: 'Correo o contraseña incorrectos.' }
    cookieStore.set('payload-token', result.token, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: secureCookie,
      expires: result.exp ? new Date(result.exp * 1000) : undefined,
    })
    return { ok: true, data: { role: (result.user as { role?: string } | undefined)?.role ?? '', next } }
  }

  try {
    const result = await payload.login({
      collection: 'users',
      data: { email, password },
      context: { twoFactor: { trustedDevice: cookieStore.get(TRUSTED_DEVICE_COOKIE)?.value ?? null } },
    })
    return await finish(result)
  } catch (err) {
    const mapped = toActionError(err)
    if (mapped.code === ERROR_CODES.TWO_FACTOR_REQUIRED) {
      // Password accepted; 2FA pending.
      if (!code) return { ok: false, code: ERROR_CODES.TWO_FACTOR_REQUIRED, message: '' }
      try {
        const check = await verifyLoginCode(payload, email, code)
        if (!check.ok) return { ok: false, code: check.code, message: check.message }
        const result = await payload.login({
          collection: 'users',
          data: { email, password },
          context: { twoFactor: { passedFor: String(check.userID) } },
        })
        if (remember) {
          const tf = await loadTwoFactor(payload, check.userID)
          cookieStore.set(TRUSTED_DEVICE_COOKIE, signTrustedDevice(String(check.userID), tf?.epoch ?? 0), {
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
            secure: secureCookie,
            maxAge: TRUSTED_DEVICE_DAYS * 24 * 60 * 60,
          })
        }
        // A backup code was spent: send them to Mi seguridad to see what is left.
        return await finish(result, check.usedBackup ? '/dashboard/security?backup=used' : undefined)
      } catch (err2) {
        const m2 = toActionError(err2)
        return { ok: false, ...(m2.code === 'UNKNOWN' ? { code: 'AUTH', message: 'Correo o contraseña incorrectos.' } : m2) }
      }
    }
    // Generic auth failures shouldn't reveal which field was wrong.
    if (mapped.code === 'UNKNOWN') {
      return { ok: false, code: 'AUTH', message: 'Correo o contraseña incorrectos.' }
    }
    return { ok: false, ...mapped }
  }
}

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete('payload-token')
  redirect('/login')
}
