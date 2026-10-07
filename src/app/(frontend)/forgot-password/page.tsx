'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { forgotPasswordAction } from './actions'
import { btnPrimary, inputClass, Field, Spinner } from '@/components/primitives'
import { IconCheck } from '@/components/icons'
import { APP_NAME } from '@/lib/brand'

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, null)

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
            <h1 className="mt-4 font-display text-xl font-semibold tracking-tight">Revise su correo</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Si existe una cuenta con ese correo, le enviamos un enlace para restablecer su
              contraseña. Solo funciona una vez y vence en 1 hora.
            </p>
            <Link href="/login" className="mt-5 inline-block text-sm font-medium text-primary hover:underline">
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold tracking-tight">¿Olvidó su contraseña?</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Ingrese el correo de su cuenta y le enviaremos un enlace para elegir una nueva.
            </p>

            <form action={formAction} className="mt-8 flex flex-col gap-4">
              <Field label="Correo electrónico" htmlFor="email">
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

              <button type="submit" className={`${btnPrimary} mt-1 w-full`} disabled={pending}>
                {pending && <Spinner />}
                {pending ? 'Enviando…' : 'Enviar enlace'}
              </button>
            </form>

            <p className="mt-6 text-sm text-muted-foreground">
              ¿La recordó?{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  )
}
