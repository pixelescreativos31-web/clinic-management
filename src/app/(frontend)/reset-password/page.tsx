'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { resetPasswordAction } from './actions'
import { Field, Spinner } from '@/components/primitives'
import { AuthShell, AuthTitle, AuthNote, FormError, authBtn, authBtn2, authInput, authLink } from '../login/AuthShell'

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  )
}

function ResetForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, null)
  const token = useSearchParams().get('token') ?? ''

  return (
    <AuthShell>
      {state?.ok ? (
        <>
          <AuthTitle
            title="Contraseña actualizada"
            sub="Su nueva contraseña quedó guardada. Entre con ella para volver a su consultorio."
          />
          <Link href="/login" className={`${authBtn} mt-5`}>
            Entrar
          </Link>
        </>
      ) : !token ? (
        <>
          <AuthTitle
            title="Enlace no válido"
            sub="A este enlace le falta el código de seguridad; puede que su programa de correo lo haya cortado."
          />
          <Link href="/forgot-password" className={`${authBtn} mt-5`}>
            Solicitar un nuevo enlace
          </Link>
          <Link href="/login" className={`${authBtn2} mt-2`}>
            Volver a entrar
          </Link>
        </>
      ) : (
        <>
          <AuthTitle title="Cree una contraseña nueva" />

          <form action={formAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="token" value={token} />
            <Field label="Contraseña nueva" htmlFor="password" hint="Mínimo 8 caracteres.">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className={authInput}
              />
            </Field>
            <Field label="Repita la contraseña" htmlFor="confirm">
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className={authInput}
              />
            </Field>

            {state && !state.ok && (
              <FormError>
                {state.message}{' '}
                <Link href="/forgot-password" className={authLink}>
                  Solicitar un nuevo enlace
                </Link>
              </FormError>
            )}

            <button type="submit" className={`${authBtn} mt-1.5`} disabled={pending}>
              {pending && <Spinner />}
              {pending ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
          <AuthNote>Luego podrá entrar con ella.</AuthNote>
        </>
      )}
    </AuthShell>
  )
}
