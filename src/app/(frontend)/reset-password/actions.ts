'use server'

import { getPayloadClient } from '@/lib/auth'
import { confirmPasswordReset } from '@/lib/passwordReset'
import { toActionError, type ActionResult } from '@/lib/errors'
import { ERROR_CODES } from '@/lib/constants'

export async function resetPasswordAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const token = String(formData.get('token') || '')
  const password = String(formData.get('password') || '')
  const confirm = String(formData.get('confirm') || '')

  if (password !== confirm) {
    return { ok: false, code: ERROR_CODES.VALIDATION, message: 'Las contraseñas no coinciden.' }
  }

  try {
    const payload = await getPayloadClient()
    await confirmPasswordReset(payload, token, password)
    return { ok: true, data: null }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}
