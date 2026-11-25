'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { forgotPasswordAction } from './actions'
import { Field, Spinner } from '@/components/primitives'
import { AuthShell, AuthTitle, AuthNote, FormError, authBtn, authBtn2, authInput } from '../login/AuthShell'

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, null)

  return (
    <AuthShell>
      {state?.ok ? (
        <>
          <AuthTitle
            title="Revise su correo"
            sub="Si existe una cuenta con ese correo, le enviamos un enlace para restablecer su contraseña."
          />
          <AuthNote>El enlace solo funciona una vez y vence en 1 hora.</AuthNote>
          <Link href="/login" className={`${authBtn2} mt-5`}>
            Volver a entrar
          </Link>
        </>
      ) : (
        <>
          <AuthTitle title="Recupere su contraseña" sub="Le enviamos un enlace para crear una nueva." />

          <form action={formAction} className="mt-4 flex flex-col gap-3">
            <Field label="Correo" htmlFor="email">
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
              {pending ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>
          <Link href="/login" className={`${authBtn2} mt-2`}>
            Volver a entrar
          </Link>
        </>
      )}
    </AuthShell>
  )
}
