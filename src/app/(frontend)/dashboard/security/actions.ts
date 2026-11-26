'use server'

// Mi seguridad + Seguridad de la clínica (spec §10). Every sensitive change is
// re-confirmed with the actor's own code and lands in Auditoría (twoFactorServer).

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getPayloadClient, requireDashboardSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { ERROR_CODES, MIN_PASSWORD_LENGTH } from '@/lib/constants'
import { toActionError, type ActionResult } from '@/lib/errors'
import { TRUSTED_DEVICE_COOKIE } from '@/lib/twoFactor'
import {
  confirmEnrollment,
  disableOwnTwoFactor,
  regenerateBackupCodes,
  resetMemberTwoFactor,
  setRequireAll,
  startEnrollment,
  type EnrollmentStart,
} from '@/lib/twoFactorServer'
import type { PayloadRequest } from 'payload'

const PATH = '/dashboard/security'

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}

// Enrollment must work while the 2FA gate is closed (that is how it opens).
const ENROLL = { twoFactorEnrollment: true }

export async function startEnrollmentAction(currentCode?: string): Promise<ActionResult<Omit<EnrollmentStart, 'uri'>>> {
  const { user } = await requireDashboardSession(ENROLL)
  return run(async () => {
    const payload = await getPayloadClient()
    const { secret, groupedSecret, qrSvg } = await startEnrollment(payload, user, currentCode)
    return { secret, groupedSecret, qrSvg }
  })
}

/** Returns the 10 backup codes, shown once. */
export async function confirmEnrollmentAction(code: string): Promise<ActionResult<string[]>> {
  const { user } = await requireDashboardSession(ENROLL)
  const res = await run(async () => confirmEnrollment(await getPayloadClient(), user, code))
  // A remembered device belongs to the old epoch; drop the cookie on this browser too.
  if (res.ok) (await cookies()).delete(TRUSTED_DEVICE_COOKIE)
  return res
}

export async function regenerateBackupCodesAction(code: string): Promise<ActionResult<string[]>> {
  const { user } = await requireDashboardSession()
  return run(async () => regenerateBackupCodes(await getPayloadClient(), user, code))
}

export async function disableTwoFactorAction(code: string): Promise<ActionResult<null>> {
  const { user, tenant } = await requireDashboardSession()
  const res = await run(async () => {
    await disableOwnTwoFactor(await getPayloadClient(), user, tenant, code)
    return null
  })
  if (res.ok) {
    ;(await cookies()).delete(TRUSTED_DEVICE_COOKIE)
    revalidatePath(PATH)
  }
  return res
}

export async function resetMemberTwoFactorAction(memberID: string, code: string): Promise<ActionResult<null>> {
  const { user } = await requireDashboardSession()
  const res = await run(async () => {
    await resetMemberTwoFactor(await getPayloadClient(), user, memberID, code)
    return null
  })
  if (res.ok) revalidatePath(PATH)
  return res
}

export async function setRequireAllAction(value: boolean, code?: string): Promise<ActionResult<null>> {
  const { user } = await requireDashboardSession()
  const res = await run(async () => {
    await setRequireAll(await getPayloadClient(), user, value, code)
    return null
  })
  if (res.ok) revalidatePath(PATH)
  return res
}

/**
 * Change your password (spec §10): checks the current one, enforces the 10-character
 * minimum, and closes every other session (this browser gets a fresh one).
 */
export async function changePasswordAction(current: string, next: string): Promise<ActionResult<null>> {
  const { user } = await requireDashboardSession()
  if (!current || !next) return { ok: false, code: ERROR_CODES.VALIDATION, message: 'Escriba su contraseña actual y la nueva.' }
  if (next.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, code: ERROR_CODES.VALIDATION, message: `La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` }
  }
  if (next === current) return { ok: false, code: ERROR_CODES.VALIDATION, message: 'La contraseña nueva debe ser distinta de la actual.' }
  const payload = await getPayloadClient()
  const twoFactor = { passedFor: String(user.id) } // already signed in with 2FA
  try {
    await payload.login({ collection: 'users', data: { email: user.email, password: current }, context: { twoFactor } })
  } catch {
    return { ok: false, code: ERROR_CODES.VALIDATION, message: 'La contraseña actual no es correcta.' }
  }
  try {
    await payload.update({ collection: 'users', id: user.id, data: { password: next }, overrideAccess: true })
    // Close every session, then open a new one for this browser.
    await payload.db.updateOne({ collection: 'users', id: user.id, data: { sessions: [] } })
    const result = await payload.login({ collection: 'users', data: { email: user.email, password: next }, context: { twoFactor } })
    if (result.token) {
      ;(await cookies()).set('payload-token', result.token, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        expires: result.exp ? new Date(result.exp * 1000) : undefined,
      })
    }
    await logAudit({ payload, user } as unknown as PayloadRequest, {
      action: 'password.changed',
      targetCollection: 'users',
      targetId: String(user.id),
      summary: 'Cambió su contraseña y cerró las demás sesiones',
    })
    return { ok: true, data: null }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}
