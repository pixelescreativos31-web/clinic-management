'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { resetPasswordAction } from './actions'
import { btnPrimary, inputClass, Field, Spinner } from '@/components/primitives'
import { IconCheck } from '@/components/icons'
import { APP_NAME } from '@/lib/brand'

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
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <Link href="/" className="mb-8 flex w-fit items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
            </svg>
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-primary">{APP_NAME}</span>
        </Link>

        {state?.ok ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <span className="flex size-9 items-center justify-center rounded-full bg-secondary">
              <IconCheck size={16} className="text-primary" />
            </span>
            <h1 className="mt-4 font-display text-xl font-semibold tracking-tight">Contraseña actualizada</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Su nueva contraseña quedó guardada. Inicie sesión con ella para volver a su consultorio.
            </p>
            <Link href="/login" className={`${btnPrimary} mt-5 w-full`}>
              Iniciar sesión
            </Link>
          </div>
        ) : !token ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <h1 className="font-display text-xl font-semibold tracking-tight">Enlace no válido</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              A este enlace le falta el código de seguridad; puede que su programa de correo lo haya cortado.
            </p>
            <Link href="/forgot-password" className="mt-5 inline-block text-sm font-medium text-primary hover:underline">
              Solicitar un nuevo enlace
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Elija una nueva contraseña</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Mínimo 8 caracteres. Luego podrá iniciar sesión con ella.
            </p>

            <form action={formAction} className="mt-8 flex flex-col gap-4">
              <input type="hidden" name="token" value={token} />
              <Field label="Nueva contraseña" htmlFor="password">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </Field>
              <Field label="Confirme la contraseña" htmlFor="confirm">
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </Field>

              {state && !state.ok && (
                <p className="rounded-lg border border-red/25 bg-red-soft px-3 py-2 text-sm text-red" role="alert">
                  {state.message}{' '}
                  <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                    Solicitar un nuevo enlace
                  </Link>
                </p>
              )}

              <button type="submit" className={`${btnPrimary} mt-1 w-full`} disabled={pending}>
                {pending && <Spinner />}
                {pending ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
