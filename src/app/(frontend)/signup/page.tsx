'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { signupAction } from './actions'
import { Field, Spinner } from '@/components/primitives'
import { AppSelect } from '@/components/AppSelect'
import { COUNTRY_DEFAULTS, DEFAULT_COUNTRY, CURRENCIES, TIMEZONES } from '@/lib/constants'
import { ORG_TYPES, orgTypeDef, specialtiesFor, type OrgType } from '@/lib/specialties'
import { AuthShell, AuthTitle, AuthNote, FormError, StepBar, authBtn, authBtn2, authInput, authLink } from '../login/AuthShell'

// Hospitals are quoted and set up by us (plan institucional), not self-serve.
const SIGNUP_ORG_TYPES = ORG_TYPES.filter((o) => o.value !== 'hospital')

// Steps are a client-side split of the same single signup submission:
// 1 Cuenta → 2 Su práctica (submits) → 3 Verificar correo / pendiente de aprobación.
const TOTAL_STEPS = 3
const SELECT = 'h-12 rounded-[10px] text-base'

const defaultsFor = (country: string) =>
  COUNTRY_DEFAULTS.find((c) => c.label === country) ?? COUNTRY_DEFAULTS[0]

export default function SignupPage() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<null | { verifyEmail: boolean }>(null)
  const [step, setStep] = useState<1 | 2>(1)
  const [startedAt] = useState(() => Date.now())

  const initial = defaultsFor(DEFAULT_COUNTRY)
  const [form, setForm] = useState({
    clinicName: '',
    phone: '',
    city: '',
    country: DEFAULT_COUNTRY,
    currency: initial.currency,
    timezone: initial.timezone,
    ownerName: '',
    email: '',
    password: '',
    orgType: 'consultorio' as OrgType,
    specialtyKey: 'general',
    specialty: '',
    licenseNumber: '',
    company: '', // honeypot
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // Picking a country suggests currency/timezone — still editable below.
  const onCountry = (country: string) => {
    const d = defaultsFor(country)
    setForm((f) => ({ ...f, country, currency: d.currency, timezone: d.timezone }))
  }

  const submit = () => {
    setError(null)
    start(async () => {
      const res = await signupAction({ ...form, practiceType: orgTypeDef(form.orgType).practiceType, startedAt })
      if (res.ok) setDone({ verifyEmail: res.data.verifyEmail })
      else setError(res.message)
    })
  }

  if (done) {
    return (
      <AuthShell>
        <StepBar step={TOTAL_STEPS} total={TOTAL_STEPS} />
        {done.verifyEmail ? (
          <AuthTitle
            title="Verifique su correo"
            sub={`Le enviamos un enlace de confirmación a ${form.email}. Haga clic para verificar su correo; luego su consultorio pasa a aprobación y podrá entrar cuando sea aprobado.`}
          />
        ) : (
          <AuthTitle
            title="Consultorio creado: pendiente de aprobación"
            sub="Su consultorio fue creado y está pendiente de aprobación. Podrá entrar en cuanto sea aprobado."
          />
        )}
        <Link href="/login" className={`${authBtn} mt-5`}>
          Ir a entrar
        </Link>
      </AuthShell>
    )
  }

  const individual = orgTypeDef(form.orgType).practiceType === 'individual'

  return (
    <AuthShell
      below={
        <p className="mt-4 text-center text-sm text-muted-foreground">
          ¿Ya tiene una cuenta?{' '}
          <Link href="/login" className={authLink}>
            Entrar
          </Link>
        </p>
      }
    >
      <StepBar step={step} total={TOTAL_STEPS} />

      {step === 1 ? (
        <>
          <AuthTitle
            title="Cree su cuenta"
            sub="Configuramos su consultorio con algunos datos de ejemplo para que pueda explorar de inmediato."
          />
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setError(null)
              setStep(2)
            }}
            className="mt-4 flex flex-col gap-3"
          >
            <Field label="Su nombre" htmlFor="ownerName">
              <input id="ownerName" name="ownerName" required value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} placeholder="Dra. Carmen Rosario" autoComplete="name" className={authInput} />
            </Field>
            <Field label="Correo" htmlFor="email">
              <input id="email" name="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="su@correo.do" className={authInput} />
            </Field>
            <Field label="Contraseña" htmlFor="password" hint="Mínimo 8 caracteres.">
              <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={(e) => set('password', e.target.value)} className={authInput} />
            </Field>
            <button type="submit" className={`${authBtn} mt-1.5`}>
              Continuar
            </button>
          </form>
        </>
      ) : (
        <>
          <AuthTitle title="Su práctica" sub="Adaptamos las fichas, la agenda y el plan a su tipo de práctica. Puede cambiarlo luego en Configuración." />
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
            className="mt-4 flex flex-col gap-3"
          >
            <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Tipo de práctica">
              {SIGNUP_ORG_TYPES.map((o) => {
                const active = form.orgType === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set('orgType', o.value)}
                    className={`min-h-[52px] rounded-[10px] border px-3.5 py-2.5 text-start transition-colors ${
                      active ? 'border-inv bg-inv text-white' : 'border-line-3 bg-card hover:border-[#a8a29e]'
                    }`}
                  >
                    <span className="block text-[15px] font-semibold">{o.label}</span>
                    <span className={`block text-[13px] ${active ? 'text-white/75' : 'text-muted-foreground'}`}>{o.hint}</span>
                  </button>
                )
              })}
            </div>

            <Field label="Nombre del consultorio" htmlFor="clinicName" hint="Aparece en recetas, recibos y recordatorios.">
              <input id="clinicName" name="clinicName" required value={form.clinicName} onChange={(e) => set('clinicName', e.target.value)} placeholder="Consultorio Dra. Carmen Rosario" className={authInput} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Teléfono" htmlFor="phone">
                <input id="phone" name="phone" required value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="809-555-0100" inputMode="tel" className={`${authInput} tabular-nums`} />
              </Field>
              <Field label="Ciudad" htmlFor="city">
                <input id="city" name="city" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Santo Domingo" className={authInput} />
              </Field>
            </div>

            {individual && (
              <>
                <Field
                  label="Su especialidad"
                  hint={
                    specialtiesFor(form.orgType).find((x) => x.key === form.specialtyKey)?.ready === false
                      ? 'Su ficha especializada está en camino; mientras tanto usa la consulta general.'
                      : 'Define su ficha de consulta, receta y resumen médico.'
                  }
                >
                  <AppSelect className={SELECT}
                    value={form.specialtyKey}
                    onChange={(v) => set('specialtyKey', v)}
                    options={specialtiesFor(form.orgType).map((x) => ({ value: x.key, label: x.ready ? x.label : `${x.label} (pronto)` }))}
                  />
                </Field>
                <Field label="Exequátur" htmlFor="licenseNumber" hint="Se imprime en sus recetas.">
                  <input id="licenseNumber" name="licenseNumber" value={form.licenseNumber} onChange={(e) => set('licenseNumber', e.target.value)} placeholder="12345-06" className={authInput} />
                </Field>
              </>
            )}

            <Field label="País" hint="Define la moneda y la zona horaria; puede cambiarlas abajo.">
              <AppSelect className={SELECT} value={form.country} onChange={onCountry} options={COUNTRY_DEFAULTS.map((c) => ({ value: c.label, label: c.label }))} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Moneda">
                <AppSelect className={SELECT} value={form.currency} onChange={(v) => set('currency', v)} options={CURRENCIES.map((c) => ({ value: c.value, label: c.value }))} />
              </Field>
              <Field label="Zona horaria">
                <AppSelect className={SELECT} value={form.timezone} onChange={(v) => set('timezone', v)} options={TIMEZONES.map((t) => ({ value: t.value, label: t.label }))} />
              </Field>
            </div>

            {/* Honeypot — visually hidden, ignored by real users */}
            <div aria-hidden className="hidden">
              <label htmlFor="company">Empresa</label>
              <input id="company" name="company" tabIndex={-1} autoComplete="off" value={form.company} onChange={(e) => set('company', e.target.value)} />
            </div>

            {error && <FormError>{error}</FormError>}

            <button type="submit" className={`${authBtn} mt-1.5`} disabled={pending}>
              {pending && <Spinner />}
              {pending ? 'Creando su consultorio…' : 'Crear mi consultorio'}
            </button>
          </form>
          <button type="button" className={`${authBtn2} mt-2`} onClick={() => setStep(1)} disabled={pending}>
            Corregir mi cuenta
          </button>
          <AuthNote>Plan de prueba gratis, sin tarjeta.</AuthNote>
        </>
      )}
    </AuthShell>
  )
}
