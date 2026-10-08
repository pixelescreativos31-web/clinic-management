'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary, inputClass, textareaClass, Field, Spinner } from './primitives'
import { AppSelect } from './AppSelect'
import { TimePicker } from './TimePicker'
import { updateClinicSettings, updateMyPractitionerProfile } from '@/app/(frontend)/dashboard/settings/actions'
import { CURRENCIES, TIMEZONES, PRACTICE_TYPES, WEEKDAYS } from '@/lib/constants'
import { IconCheck, IconBuilding, IconCalendar, IconClock, IconStethoscope } from './icons'

export type SettingsInitial = {
  name: string
  phone: string
  address: string
  city: string
  country: string
  appointmentDurationMins: number
  openTime: string
  closeTime: string
  currency: string
  timezone: string
  taxId: string
  practiceType: 'individual' | 'clinic'
  consultTemplate: 'general' | 'nutrition'
  onlineBookingEnabled: boolean
  onlineRequestsEnabled: boolean
}

export type ProfileInitial = {
  practitioner: boolean
  specialty: string
  licenseNumber: string
  consultationFee: string
  availableDays: string[]
  availableFrom: string
  availableTo: string
}

/** Stripe-style settings row: description rail on the left, fields card on the right. */
function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr] lg:gap-10">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-primary">
            {icon}
          </span>
          <h2 className="text-[15px] font-semibold">{title}</h2>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground lg:max-w-[260px]">
          {description}
        </p>
      </div>
      <div className="card-flat p-6">{children}</div>
    </div>
  )
}

export function SettingsForm({
  initial,
  profile: initialProfile,
  bookingUrl,
}: {
  initial: SettingsInitial
  profile: ProfileInitial
  /** Public booking link for this clinic (/agendar/<slug>). */
  bookingUrl: string | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ ...initial, appointmentDurationMins: String(initial.appointmentDurationMins) })
  const set = (k: keyof typeof form, v: string) => {
    setSaved(false)
    setForm((f) => ({ ...f, [k]: v }))
  }
  const [booking, setBooking] = useState({ enabled: initial.onlineBookingEnabled, requests: initial.onlineRequestsEnabled })
  const setB = (patch: Partial<typeof booking>) => {
    setSaved(false)
    setBooking((b) => ({ ...b, ...patch }))
  }
  const [copied, setCopied] = useState(false)
  const copyLink = async () => {
    if (!bookingUrl) return
    try {
      await navigator.clipboard.writeText(bookingUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the link is still selectable */
    }
  }
  const [profile, setProfile] = useState(initialProfile)
  const setP = <K extends keyof ProfileInitial>(k: K, v: ProfileInitial[K]) => {
    setSaved(false)
    setProfile((p) => ({ ...p, [k]: v }))
  }
  const toggleDay = (d: string) =>
    setP('availableDays', profile.availableDays.includes(d) ? profile.availableDays.filter((x) => x !== d) : [...profile.availableDays, d])

  const save = () => {
    setError(null)
    start(async () => {
      const res = await updateClinicSettings({
        name: form.name,
        phone: form.phone,
        address: form.address || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        taxId: form.taxId || undefined,
        practiceType: form.practiceType,
        consultTemplate: form.consultTemplate,
        onlineBookingEnabled: booking.enabled,
        onlineRequestsEnabled: booking.requests,
        appointmentDurationMins: Number(form.appointmentDurationMins) || 20,
        openTime: form.openTime,
        closeTime: form.closeTime,
        currency: form.currency,
        timezone: form.timezone,
      })
      if (!res.ok) return setError(res.message)
      const prof = await updateMyPractitionerProfile({
        practitioner: profile.practitioner,
        specialty: profile.specialty || undefined,
        licenseNumber: profile.licenseNumber || undefined,
        consultationFee: profile.consultationFee === '' ? undefined : Number(profile.consultationFee),
        availableDays: profile.availableDays,
        availableFrom: profile.availableFrom,
        availableTo: profile.availableTo,
      })
      if (!prof.ok) return setError(prof.message)
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <Section
        icon={<IconBuilding size={15} strokeWidth={1.75} />}
        title="Consultorio"
        description="Estos datos aparecen en el panel y en los documentos impresos: recetas, recibos y recordatorios."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del consultorio">
            <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Teléfono">
            <input className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Dirección">
              <textarea className={textareaClass} rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
          </div>
          <Field label="Ciudad">
            <input className={inputClass} value={form.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="País">
            <input className={inputClass} value={form.country} onChange={(e) => set('country', e.target.value)} />
          </Field>
          <Field label="RNC (opcional)" hint="Se imprime en los recibos.">
            <input className={inputClass} value={form.taxId} onChange={(e) => set('taxId', e.target.value)} />
          </Field>
          <Field label="Tipo de práctica" hint="«Médico independiente» simplifica la agenda y el menú.">
            <AppSelect
              value={form.practiceType}
              onChange={(v) => set('practiceType', v)}
              options={PRACTICE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
          </Field>
          <Field label="Formato de consulta" hint="«Nutrición» agrega antropometría, laboratorio y la hoja de seguimiento.">
            <AppSelect
              value={form.consultTemplate}
              onChange={(v) => set('consultTemplate', v)}
              options={[
                { value: 'general', label: 'General' },
                { value: 'nutrition', label: 'Nutrición' },
              ]}
            />
          </Field>
        </div>
      </Section>

      <Section
        icon={<IconClock size={15} strokeWidth={1.75} />}
        title="Agenda"
        description="Horario del consultorio y valores por defecto para la agenda y las nuevas citas."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Abre a las">
            <TimePicker
              value={form.openTime}
              onChange={(v) => set('openTime', v)}
              openTime="00:00"
              closeTime="24:00"
              stepMins={30}
            />
          </Field>
          <Field label="Cierra a las">
            <TimePicker
              value={form.closeTime}
              onChange={(v) => set('closeTime', v)}
              openTime="00:00"
              closeTime="24:00"
              stepMins={30}
            />
          </Field>
          <Field label="Duración de cita (min)">
            <input className={inputClass} inputMode="numeric" value={form.appointmentDurationMins} onChange={(e) => set('appointmentDurationMins', e.target.value)} />
          </Field>
          <Field label="Moneda" hint="Los registros existentes conservan sus montos.">
            <AppSelect
              value={form.currency}
              onChange={(v) => set('currency', v)}
              options={CURRENCIES.map((c) => ({ value: c.value, label: c.label }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Zona horaria" hint="Cambia cómo se muestran las horas, no los datos guardados.">
              <AppSelect
                value={form.timezone}
                onChange={(v) => set('timezone', v)}
                options={TIMEZONES.map((t) => ({ value: t.value, label: t.label }))}
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section
        icon={<IconCalendar size={15} strokeWidth={1.75} />}
        title="Reservas en línea"
        description="Comparta su enlace en Instagram, WhatsApp o Google. Los pacientes agendan solos dentro del horario de cada médico, hasta 30 días antes."
      >
        <div className="flex flex-col gap-4">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={booking.enabled} onChange={(e) => setB({ enabled: e.target.checked })} />
            <span>
              <span className="font-medium">Permitir que los pacientes agenden en línea</span>
              <span className="block text-xs text-muted-foreground">Las citas se confirman al instante y aparecen en su agenda marcadas «En línea».</span>
            </span>
          </label>
          <label className={`flex items-start gap-3 text-sm ${booking.enabled ? '' : 'opacity-50'}`}>
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--primary)]"
              disabled={!booking.enabled}
              checked={booking.requests}
              onChange={(e) => setB({ requests: e.target.checked })}
            />
            <span>
              <span className="font-medium">Recibir solicitudes adicionales o de emergencia</span>
              <span className="block text-xs text-muted-foreground">Si no encuentran horario, pueden pedir una cita; usted decide si la agenda.</span>
            </span>
          </label>
          {booking.enabled && bookingUrl && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className={`${inputClass} tabular flex-1`} readOnly value={bookingUrl} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className={btnPrimary} onClick={copyLink}>
                {copied ? 'Copiado' : 'Copiar enlace'}
              </button>
            </div>
          )}
        </div>
      </Section>

      <Section
        icon={<IconStethoscope size={15} strokeWidth={1.75} />}
        title="Mi perfil médico"
        description="Si usted atiende pacientes, aparecerá en la agenda y sus datos se imprimirán en las recetas."
      >
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={profile.practitioner}
            onChange={(e) => setP('practitioner', e.target.checked)}
          />
          Atiendo pacientes en este consultorio
        </label>
        {profile.practitioner && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Especialidad">
              <input className={inputClass} value={profile.specialty} onChange={(e) => setP('specialty', e.target.value)} placeholder="Medicina interna" />
            </Field>
            <Field label="Exequátur / registro">
              <input className={inputClass} value={profile.licenseNumber} onChange={(e) => setP('licenseNumber', e.target.value)} />
            </Field>
            <Field label="Tarifa de consulta">
              <input className={inputClass} inputMode="numeric" value={profile.consultationFee} onChange={(e) => setP('consultationFee', e.target.value)} />
            </Field>
            <div className="sm:col-span-2 xl:col-span-3">
              <Field label="Días de consulta">
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => {
                    const on = profile.availableDays.includes(d.value)
                    return (
                      <button
                        key={d.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleDay(d.value)}
                        className={`h-9 min-w-12 rounded-md border px-2.5 text-[13px] font-medium transition-colors ${
                          on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </div>
            <Field label="Desde">
              <TimePicker value={profile.availableFrom} onChange={(v) => setP('availableFrom', v)} openTime="00:00" closeTime="24:00" stepMins={30} />
            </Field>
            <Field label="Hasta">
              <TimePicker value={profile.availableTo} onChange={(v) => setP('availableTo', v)} openTime="00:00" closeTime="24:00" stepMins={30} />
            </Field>
          </div>
        )}
      </Section>

      {/* Save bar */}
      <div className="card-flat flex items-center justify-between gap-3 px-6 py-4 lg:ms-[340px]">
        {error ? (
          <p className="text-sm text-red" role="alert">{error}</p>
        ) : saved ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-primary">
            <IconCheck size={15} /> Guardado
          </p>
        ) : (
          <span className="text-xs text-faint">Los cambios se aplican de inmediato para todo el equipo.</span>
        )}
        <button className={btnPrimary} disabled={pending || !form.name || !form.phone} onClick={save}>
          {pending && <Spinner />}
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
