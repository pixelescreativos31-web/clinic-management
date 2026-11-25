'use client'

import { Suspense, useActionState, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { loginAction } from './actions'
import { Field, Spinner } from '@/components/primitives'
import { AuthShell, AuthTitle, FormError, authBtn, authBtn2, authInput, authLink } from './AuthShell'

const DEMO_ACCOUNTS = [
  { label: 'Doctora (titular)', email: 'doctora@demo.app' },
  { label: 'Asistente', email: 'asistente@demo.app' },
  { label: 'Clínica (varios médicos)', email: 'owner@clinica.app' },
  { label: 'Superadministrador', email: 'super@clinic.app' },
]

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null)
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (state?.ok) {
      router.push(state.data.role === 'superAdmin' ? '/super' : '/dashboard')
    }
  }, [state, router])

  const quickFill = (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword('password123')
  }

  return (
    <AuthShell
      below={
        <>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            ¿Es nuevo(a)?{' '}
            <Link href="/signup" className={authLink}>
              Cree su cuenta
            </Link>
          </p>

          {/* Demo quick-fill */}
          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <p className="text-[13px] font-medium text-muted-foreground">
              Demostración: un clic completa el formulario; luego entre.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {DEMO_ACCOUNTS.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => quickFill(d.email)}
                  aria-pressed={email === d.email}
                  className={`min-h-10 rounded-[10px] border px-3 text-[13px] font-medium transition-colors ${
                    email === d.email
                      ? 'border-inv bg-inv text-white'
                      : 'border-line-3 bg-card text-foreground hover:border-[#a8a29e]'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </>
      }
    >
      <AuthTitle title="Entrar" />

      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <Field label="Correo" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="su@correo.do"
            className={authInput}
          />
        </Field>
        <Field label="Contraseña" htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInput}
          />
        </Field>

        {state && !state.ok && <FormError>{state.message}</FormError>}

        <button type="submit" className={`${authBtn} mt-1.5`} disabled={pending}>
          {pending && <Spinner />}
          {pending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <Link href="/forgot-password" className={`${authBtn2} mt-2`}>
        Olvidé mi contraseña
      </Link>
    </AuthShell>
  )
}
