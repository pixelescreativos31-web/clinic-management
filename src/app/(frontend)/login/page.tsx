'use client'

import { Suspense, useActionState, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { loginAction } from './actions'
import { btnPrimary, inputClass, Field, Spinner } from '@/components/primitives'
import { IconCheck } from '@/components/icons'
import { APP_NAME, APP_TAGLINE } from '@/lib/brand'

const DEMO_ACCOUNTS = [
  { label: 'Doctora (titular)', email: 'doctora@demo.app' },
  { label: 'Asistente', email: 'asistente@demo.app' },
  { label: 'Clínica (varios médicos)', email: 'owner@clinica.app' },
  { label: 'Superadministrador', email: 'super@clinic.app' },
]

const PROMISES = ['Agenda del día siempre al día', 'Recetas listas para imprimir', 'Recordatorios por WhatsApp']

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
    <main className="flex min-h-screen">
      {/* Brand panel — photo with teal wash */}
      <aside className="relative hidden w-[44%] overflow-hidden bg-sidebar lg:block">
        <Image
          src="/images/login-doctor.jpg"
          alt=""
          fill
          priority
          sizes="44vw"
          className="object-cover object-[50%_18%] opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/55 to-sidebar/25" />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <Link href="/" className="flex w-fit items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/25 backdrop-blur">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4.5 text-sidebar-accent" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
              </svg>
            </span>
            <span className="font-display text-xl font-semibold tracking-tight text-white">{APP_NAME}</span>
          </Link>

          <div>
            <h2 className="max-w-md font-display text-3xl leading-snug font-semibold text-white xl:text-4xl">
              Su consultorio, sin el caos del papeleo.
            </h2>
            <ul className="mt-7 space-y-3">
              {PROMISES.map((p) => (
                <li key={p} className="flex items-center gap-3 text-[15px] text-white/85">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sidebar-accent/20 ring-1 ring-sidebar-accent/40">
                    <IconCheck size={12} strokeWidth={3} className="text-sidebar-accent" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-10 text-xs text-white/50">
              {APP_TAGLINE}
            </p>
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex flex-1 items-center justify-center bg-canvas px-4 py-10">
        <div className="w-full max-w-sm animate-fade-up">
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
              </svg>
            </span>
            <span className="font-display text-xl font-semibold tracking-tight text-primary">{APP_NAME}</span>
          </Link>

          <h1 className="font-display text-2xl font-semibold tracking-tight">Bienvenido(a) de nuevo</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Inicie sesión en su consultorio para comenzar el día. ¿Es nuevo(a)?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Cree su cuenta
            </Link>
            .
          </p>

          <form action={formAction} className="mt-8 flex flex-col gap-4">
            <Field label="Correo electrónico" htmlFor="email">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usted@consultorio.com"
                className={inputClass}
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
                placeholder="••••••••"
                className={inputClass}
              />
            </Field>
            <div className="-mt-2 text-right">
              <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                ¿Olvidó su contraseña?
              </Link>
            </div>

            {state && !state.ok && (
              <p className="rounded-lg border border-red/25 bg-red-soft px-3 py-2 text-sm text-red" role="alert">
                {state.message}
              </p>
            )}

            <button type="submit" className={`${btnPrimary} mt-1 w-full`} disabled={pending}>
              {pending && <Spinner />}
              {pending ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </button>
          </form>

          {/* Demo quick-fill */}
          <div className="mt-8 rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Demostración: un clic completa el formulario; luego inicie sesión.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {DEMO_ACCOUNTS.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => quickFill(d.email)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    email === d.email
                      ? 'border-primary/30 bg-secondary text-primary'
                      : 'border-border bg-canvas text-muted-foreground hover:border-primary/30 hover:text-primary'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
