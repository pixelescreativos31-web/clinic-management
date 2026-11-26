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
  const [code, setCode] = useState('')
  // Step 2 (spec §10): the password was right and the account has 2FA on.
  const [needCode, setNeedCode] = useState(false)

  useEffect(() => {
    if (state?.ok) {
      router.push(state.data.next ?? (state.data.role === 'superAdmin' ? '/super' : '/dashboard'))
    } else if (state?.code === 'TWO_FACTOR_REQUIRED') {
      setNeedCode(true)
    }
  }, [state, router])

  const backToPassword = () => {
    setNeedCode(false)
    setCode('')
    setPassword('')
  }

  if (needCode) {
    const codeError = state && !state.ok && state.code !== 'TWO_FACTOR_REQUIRED' ? state.message : null
    return (
      <AuthShell>
        <AuthTitle title="Verificación en dos pasos" />
        <p className="mt-1 text-sm text-muted-foreground">
          Escriba el código de 6 dígitos de su app autenticadora. Si no tiene el teléfono, use uno de sus códigos de respaldo.
        </p>
        <form action={formAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="password" value={password} />
          <Field label="Código" htmlFor="code">
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={12}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123 456"
              className={`${authInput} font-mono tracking-[.2em]`}
            />
          </Field>
          <label className="flex min-h-10 items-center gap-2.5 text-sm">
            <input type="checkbox" name="remember" className="size-4 accent-[var(--color-primary)]" />
            Recordar este equipo 30 días (no lo marque en una computadora compartida)
          </label>

          {codeError && <FormError>{codeError}</FormError>}

          <button type="submit" className={`${authBtn} mt-1.5`} disabled={pending || !code.trim()}>
            {pending && <Spinner />}
            {pending ? 'Verificando…' : 'Verificar y entrar'}
          </button>
        </form>
        <button type="button" onClick={backToPassword} className={`${authBtn2} mt-2`}>
          Volver
        </button>
        <p className="mt-4 text-[13px] text-muted-foreground">
          ¿Perdió el teléfono y no tiene códigos de respaldo? Pida al Titular de su clínica que restablezca su verificación. Si usted es el Titular, escriba a soporte.
        </p>
      </AuthShell>
    )
  }

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

        {state && !state.ok && state.message && <FormError>{state.message}</FormError>}

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
