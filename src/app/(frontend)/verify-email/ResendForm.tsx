'use client'

import { useActionState } from 'react'
import { resendVerificationAction } from './actions'
import { btnPrimary, inputClass, Field, Spinner } from '@/components/primitives'

export function ResendForm() {
  const [state, formAction, pending] = useActionState(resendVerificationAction, null)

  if (state?.ok) {
    return (
      <p className="mt-5 rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-muted-foreground">
        Si existe una cuenta sin verificar con ese correo, le enviamos un nuevo enlace.
      </p>
    )
  }

  return (
    <form action={formAction} className="mt-5 flex flex-col gap-3">
      <Field label="Correo de su cuenta" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="usted@consultorio.com"
          className={inputClass}
        />
      </Field>
      {state && !state.ok && (
        <p className="rounded-lg border border-red/25 bg-red-soft px-3 py-2 text-sm text-red" role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={pending}>
        {pending && <Spinner />}
        {pending ? 'Enviando…' : 'Reenviar correo de verificación'}
      </button>
    </form>
  )
}
