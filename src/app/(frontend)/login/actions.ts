'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayloadClient } from '@/lib/auth'
import { toActionError, type ActionResult } from '@/lib/errors'

export async function loginAction(
  _prev: ActionResult<{ role: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ role: string }>> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')

  if (!email || !password) {
    return { ok: false, code: 'VALIDATION', message: 'Ingrese su correo y su contraseña.' }
  }

  try {
    const payload = await getPayloadClient()
    const result = await payload.login({
      collection: 'users',
      data: { email, password },
    })

    if (!result.token) {
      return { ok: false, code: 'VALIDATION', message: 'Correo o contraseña incorrectos.' }
    }

    const cookieStore = await cookies()
    cookieStore.set('payload-token', result.token, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: result.exp ? new Date(result.exp * 1000) : undefined,
    })

    return { ok: true, data: { role: (result.user as { role: string }).role } }
  } catch (err) {
    const mapped = toActionError(err)
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
