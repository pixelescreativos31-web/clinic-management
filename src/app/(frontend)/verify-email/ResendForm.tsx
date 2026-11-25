'use client'

import { useActionState } from 'react'
import { resendVerificationAction } from './actions'
import { Field, Spinner } from '@/components/primitives'
import { FormError, authBtn, authInput } from '../login/AuthShell'

export function ResendForm() {
  const [state, formAction, pending] = useActionState(resendVerificationAction, null)

  if (state?.ok) {
    return (
      <p className="mt-4 rounded-[10px] border border-border bg-sunken px-3 py-2.5 text-sm text-muted-foreground">
        Si existe una cuenta sin verificar con ese correo, le enviamos un nuevo enlace.
      </p>
    )
  }

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <Field label="Correo de su cuenta" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="su@correo.do"
          className={authInput}
        />
      </Field>
      {state && !state.ok && <FormError>{state.message}</FormError>}
      <button type="submit" className={`${authBtn} mt-1.5`} disabled={pending}>
        {pending && <Spinner />}
        {pending ? 'Enviando…' : 'Reenviar correo de verificación'}
      </button>
    </form>
  )
}
