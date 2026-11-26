'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary, btnGhost, inputClass, textareaClass, Field, Spinner } from './primitives'
import { AppSelect } from './AppSelect'
import { TimePicker } from './TimePicker'
import {
  updateClinicSettings,
  updateMyPractitionerProfile,
} from '@/app/(frontend)/dashboard/settings/actions'
import { CURRENCIES, TIMEZONES, PRACTICE_TYPES, WEEKDAYS } from '@/lib/constants'
import { HEIGHT_UNITS, TIME_FORMATS, WEEK_STARTS, WEIGHT_UNITS, sortByWeek, type HeightUnit, type TimeFormat, type WeekStart, type WeightUnit } from '@/lib/regional'
import { PROFILES, type PracticeProfile } from '@/lib/profiles'
import {
  ORG_TYPES,
  orgTypeDef,
  specialtiesFor,
  specialtyByKey,
  type OrgType,
} from '@/lib/specialties'

/** Shrink an uploaded logo to ≤ 640 px and encode it as a compact data URL. */
async function logoDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('No se pudo leer la imagen.'))
      i.src = url
    })
    const scale = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    // WebP keeps transparency and is small; browsers without a WebP encoder fall back to PNG.
    const webp = canvas.toDataURL('image/webp', 0.88)
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

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
  timeFormat: TimeFormat
  weekStart: WeekStart
  weightUnit: WeightUnit
  heightUnit: HeightUnit
  taxId: string
  practiceType: 'individual' | 'clinic'
  orgType: OrgType
  consultTemplate: PracticeProfile
  programName: string
  logo: string
  onlineBookingEnabled: boolean
  onlineRequestsEnabled: boolean
}

export type ProfileInitial = {
  practitioner: boolean
  specialtyKey: string
  specialty: string
  licenseNumber: string
  consultationFee: string
  availableDays: string[]
  availableFrom: string
  availableTo: string
  /** Appointment types for online booking (strings while editing). */
  services: { name: string; durationMins: string; price: string }[]
}

/** Settings section as a card (design handoff «Formulario»): 16/600 title, 13px hint, fields below. */
function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-[12px] border border-[#e7e5e4] bg-white px-[18px] pt-[18px] pb-5"
    >
      <h2 className="text-base font-semibold tracking-[-.01em]">{title}</h2>
      <p className="mt-0.5 text-[13px] text-[#57534e]">{description}</p>
      <div className="mt-3.5">{children}</div>
    </section>
  )
}

/** 48x28 switch, 22px knob, teal when on (design handoff «Interruptor»). */
function Switch({
  checked,
  onChange,
  disabled,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label: string
  hint?: string
}) {
  return (
    <div className={`flex items-start justify-between gap-4 ${disabled ? 'opacity-50' : ''}`}>
      <span className="min-w-0 text-sm">
        <span className="block font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-[#57534e]">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`flex h-7 w-12 flex-none rounded-[14px] p-[3px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] ${
          checked ? 'justify-end bg-[#0f766e]' : 'justify-start bg-[#d6d3d1]'
        }`}
      >
        <span className="size-[22px] rounded-full bg-white" />
      </button>
    </div>
  )
}

const SECTIONS = [
  ['consultorio', 'Consultorio'],
  ['agenda', 'Agenda'],
  ['reservas', 'Reservas en línea'],
  ['perfil', 'Mi perfil médico'],
] as const

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
  const [form, setForm] = useState({
    ...initial,
    appointmentDurationMins: String(initial.appointmentDurationMins),
  })
  const set = (k: keyof typeof form, v: string) => {
    setSaved(false)
    setForm((f) => ({ ...f, [k]: v }))
  }
  const [booking, setBooking] = useState({
    enabled: initial.onlineBookingEnabled,
    requests: initial.onlineRequestsEnabled,
  })
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
    setP(
      'availableDays',
      profile.availableDays.includes(d)
        ? profile.availableDays.filter((x) => x !== d)
        : [...profile.availableDays, d],
    )

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
        orgType: form.orgType,
        consultTemplate: form.consultTemplate,
        programName: form.programName,
        logo: form.logo || null,
        onlineBookingEnabled: booking.enabled,
        onlineRequestsEnabled: booking.requests,
        appointmentDurationMins: Number(form.appointmentDurationMins) || 20,
        openTime: form.openTime,
        closeTime: form.closeTime,
        currency: form.currency,
        timezone: form.timezone,
        timeFormat: form.timeFormat,
        weekStart: form.weekStart,
        weightUnit: form.weightUnit,
        heightUnit: form.heightUnit,
      })
      if (!res.ok) return setError(res.message)
      const prof = await updateMyPractitionerProfile({
        practitioner: profile.practitioner,
        specialtyKey: profile.specialtyKey,
        specialty: profile.specialty || undefined,
        licenseNumber: profile.licenseNumber || undefined,
        consultationFee:
          profile.consultationFee === '' ? undefined : Number(profile.consultationFee),
        availableDays: profile.availableDays,
        availableFrom: profile.availableFrom,
        availableTo: profile.availableTo,
        bookingServices: profile.services
          .filter((s) => s.name.trim() && Number(s.durationMins) > 0)
          .map((s) => ({
            name: s.name.trim(),
            durationMins: Number(s.durationMins),
            price: s.price === '' ? undefined : Number(s.price),
          })),
      })
      if (!prof.ok) return setError(prof.message)
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-start gap-4">
      {/* Section index: jumps within the page */}
      <nav
        aria-label="Secciones"
        className="flex max-w-full flex-[1_1_200px] flex-wrap gap-1 rounded-[12px] border border-[#e7e5e4] bg-white p-1.5 lg:sticky lg:top-[72px]"
      >
        {SECTIONS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="flex h-9 flex-[1_1_180px] items-center rounded-lg px-2.5 text-sm font-medium whitespace-nowrap text-[#57534e] hover:bg-[#f0eeec] hover:text-[#1c1917]"
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="flex min-w-0 flex-[3_1_420px] flex-col gap-3">
        <Section
          id="consultorio"
          title="Consultorio"
          description="Estos datos aparecen en el panel y en los documentos impresos: recetas, recibos y recordatorios."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del consultorio">
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
            <Field label="Teléfono">
              <input
                className={inputClass}
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                inputMode="tel"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Dirección">
                <textarea
                  className={textareaClass}
                  rows={2}
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Ciudad">
              <input
                className={inputClass}
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
              />
            </Field>
            <Field label="País">
              <input
                className={inputClass}
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
              />
            </Field>
            <Field label="RNC (opcional)" hint="Se imprime en los recibos.">
              <input
                className={inputClass}
                value={form.taxId}
                onChange={(e) => set('taxId', e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Tipo de organización" hint={orgTypeDef(form.orgType).hint}>
                <AppSelect
                  value={form.orgType}
                  onChange={(v) => {
                    // Picking a type suggests its practice type and base profile; both stay editable.
                    const def = orgTypeDef(v as OrgType)
                    setSaved(false)
                    setForm((f) => ({
                      ...f,
                      orgType: def.value,
                      practiceType: def.practiceType,
                      consultTemplate: def.profile,
                    }))
                  }}
                  options={ORG_TYPES.map((o) => ({ value: o.value, label: o.label }))}
                />
              </Field>
            </div>
            <Field
              label="Tipo de práctica"
              hint="«Médico independiente» simplifica la agenda y el menú."
            >
              <AppSelect
                value={form.practiceType}
                onChange={(v) => set('practiceType', v)}
                options={PRACTICE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
            </Field>
            <Field
              label="Perfil base del consultorio"
              hint={`${PROFILES.find((p) => p.value === form.consultTemplate)?.hint ?? ''} Aplica al personal sin especialidad asignada.`}
            >
              <AppSelect
                value={form.consultTemplate}
                onChange={(v) => set('consultTemplate', v)}
                options={PROFILES.map((p) => ({ value: p.value, label: p.label }))}
              />
            </Field>
            {PROFILES.find((p) => p.value === form.consultTemplate)?.formats.includes(
              'program',
            ) && (
              <Field
                label="Nombre del programa de control de peso"
                hint="Así aparece en el expediente y en la hoja impresa."
              >
                <input
                  className={inputClass}
                  value={form.programName}
                  maxLength={60}
                  placeholder="Programa de control de peso"
                  onChange={(e) => set('programName', e.target.value)}
                />
              </Field>
            )}
            <div className="sm:col-span-2">
              <Field
                label="Logo"
                hint="Aparece en el menú, la página de reservas y los documentos impresos. PNG, JPG o WebP."
              >
                <div className="flex flex-wrap items-center gap-3">
                  {form.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.logo}
                      alt="Logo del consultorio"
                      className="h-16 w-auto rounded-lg border border-[#e7e5e4] bg-white p-1"
                    />
                  ) : (
                    <span className="text-sm text-[#57534e]">Sin logo</span>
                  )}
                  <label className="flex h-10 cursor-pointer items-center rounded-[10px] border border-[#d6d3d1] bg-white px-3 text-sm font-medium hover:border-[#a8a29e]">
                    {form.logo ? 'Cambiar' : 'Subir logo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (!file) return
                        try {
                          set('logo', await logoDataUrl(file))
                        } catch (err) {
                          setError(
                            err instanceof Error ? err.message : 'No se pudo leer la imagen.',
                          )
                        }
                      }}
                    />
                  </label>
                  {form.logo && (
                    <button
                      type="button"
                      onClick={() => set('logo', '')}
                      className="h-10 rounded-[10px] px-2 text-sm font-medium text-[#1c1917] underline-offset-4 hover:underline"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </Field>
            </div>
          </div>
        </Section>

        <Section
          id="agenda"
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
              <input
                className={inputClass}
                inputMode="numeric"
                value={form.appointmentDurationMins}
                onChange={(e) => set('appointmentDurationMins', e.target.value)}
              />
            </Field>
            <Field label="Moneda" hint="Los registros existentes conservan sus montos.">
              <AppSelect
                value={form.currency}
                onChange={(v) => set('currency', v)}
                options={CURRENCIES.map((c) => ({ value: c.value, label: c.label }))}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Zona horaria"
                hint="Cambia cómo se muestran las horas, no los datos guardados."
              >
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
          id="regional"
          title="Formato regional"
          description="Cómo se muestran las horas, los días de la semana y las medidas en todo el consultorio. Los datos guardados no cambian."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Formato de hora">
              <AppSelect value={form.timeFormat} onChange={(v) => set('timeFormat', v)} options={TIME_FORMATS.map((o) => ({ value: o.value, label: o.label }))} />
            </Field>
            <Field label="La semana empieza el">
              <AppSelect value={form.weekStart} onChange={(v) => set('weekStart', v)} options={WEEK_STARTS.map((o) => ({ value: o.value, label: o.label }))} />
            </Field>
            <Field label="Unidad de peso" hint="Se muestra también la otra unidad al lado.">
              <AppSelect value={form.weightUnit} onChange={(v) => set('weightUnit', v)} options={WEIGHT_UNITS.map((o) => ({ value: o.value, label: o.label }))} />
            </Field>
            <Field label="Unidad de talla">
              <AppSelect value={form.heightUnit} onChange={(v) => set('heightUnit', v)} options={HEIGHT_UNITS.map((o) => ({ value: o.value, label: o.label }))} />
            </Field>
          </div>
        </Section>

        <Section
          id="reservas"
          title="Reservas en línea"
          description="Comparta su enlace en Instagram, WhatsApp o Google. Los pacientes agendan solos dentro del horario de cada médico, hasta 30 días antes."
        >
          <div className="flex flex-col gap-4">
            <Switch
              checked={booking.enabled}
              onChange={(v) => setB({ enabled: v })}
              label="Permitir que los pacientes agenden en línea"
              hint="Las citas se confirman al instante y aparecen en su agenda marcadas «En línea»."
            />
            <Switch
              checked={booking.requests}
              disabled={!booking.enabled}
              onChange={(v) => setB({ requests: v })}
              label="Recibir solicitudes adicionales o de emergencia"
              hint="Si no encuentran horario, pueden pedir una cita; usted decide si la agenda."
            />
            {booking.enabled && bookingUrl && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className={`${inputClass} flex-1 font-mono md:text-sm`}
                  readOnly
                  value={bookingUrl}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button type="button" className={btnGhost} onClick={copyLink}>
                  {copied ? 'Copiado' : 'Copiar enlace'}
                </button>
              </div>
            )}
          </div>
        </Section>

        <Section
          id="perfil"
          title="Mi perfil médico"
          description="Si usted atiende pacientes, aparecerá en la agenda y sus datos se imprimirán en las recetas."
        >
          <Switch
            checked={profile.practitioner}
            onChange={(v) => setP('practitioner', v)}
            label="Atiendo pacientes en este consultorio"
          />
          {profile.practitioner && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field
                label="Especialidad (ficha clínica)"
                hint={
                  profile.specialtyKey && specialtyByKey(profile.specialtyKey)?.ready === false
                    ? 'Su ficha especializada está en camino; mientras tanto usa la consulta general.'
                    : 'Define las fichas que usa en sus consultas.'
                }
              >
                <AppSelect
                  value={profile.specialtyKey}
                  onChange={(v) => setP('specialtyKey', v)}
                  options={[
                    { value: '', label: 'Según el perfil del consultorio' },
                    ...specialtiesFor(form.orgType).map((x) => ({
                      value: x.key,
                      label: x.ready ? x.label : `${x.label} (pronto)`,
                    })),
                  ]}
                />
              </Field>
              <Field label="Título en la receta" hint="Texto libre, p. ej. «Oftalmóloga · Retina».">
                <input
                  className={inputClass}
                  value={profile.specialty}
                  onChange={(e) => setP('specialty', e.target.value)}
                  placeholder={specialtyByKey(profile.specialtyKey)?.label || 'Medicina interna'}
                />
              </Field>
              <Field label="Exequátur / registro">
                <input
                  className={inputClass}
                  value={profile.licenseNumber}
                  onChange={(e) => setP('licenseNumber', e.target.value)}
                />
              </Field>
              <Field label="Tarifa de consulta">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={profile.consultationFee}
                  onChange={(e) => setP('consultationFee', e.target.value)}
                />
              </Field>
              <div className="sm:col-span-2 xl:col-span-3">
                <Field label="Días de consulta">
                  <div className="flex flex-wrap gap-1.5">
                    {sortByWeek(WEEKDAYS, form.weekStart).map((d) => {
                      const on = profile.availableDays.includes(d.value)
                      return (
                        <button
                          key={d.value}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleDay(d.value)}
                          className={`h-10 min-w-12 rounded-[10px] border px-3 text-sm font-medium transition-colors ${
                            on
                              ? 'border-[#1c1917] bg-[#1c1917] text-white'
                              : 'border-[#d6d3d1] bg-white text-[#57534e] hover:border-[#a8a29e]'
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
                <TimePicker
                  value={profile.availableFrom}
                  onChange={(v) => setP('availableFrom', v)}
                  openTime="00:00"
                  closeTime="24:00"
                  stepMins={30}
                />
              </Field>
              <Field label="Hasta">
                <TimePicker
                  value={profile.availableTo}
                  onChange={(v) => setP('availableTo', v)}
                  openTime="00:00"
                  closeTime="24:00"
                  stepMins={30}
                />
              </Field>
              <div className="sm:col-span-2 xl:col-span-3">
                <Field
                  label="Tipos de cita (reservas en línea)"
                  hint="Cada tipo tiene su duración y precio. Si no agrega ninguno, se ofrece «Consulta» con la duración de la agenda."
                >
                  <div className="flex flex-col gap-2">
                    {profile.services.map((s, i) => {
                      const setS = (patch: Partial<typeof s>) =>
                        setP(
                          'services',
                          profile.services.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                        )
                      return (
                        <div
                          key={i}
                          className="grid grid-cols-[minmax(0,1fr)_72px_96px_auto] items-center gap-2"
                        >
                          <input
                            className={inputClass}
                            value={s.name}
                            onChange={(e) => setS({ name: e.target.value })}
                            placeholder="Primera consulta"
                            aria-label="Nombre del tipo de cita"
                          />
                          <input
                            className={inputClass}
                            inputMode="numeric"
                            value={s.durationMins}
                            onChange={(e) =>
                              setS({ durationMins: e.target.value.replace(/\D/g, '') })
                            }
                            placeholder="min"
                            aria-label="Duración en minutos"
                          />
                          <input
                            className={inputClass}
                            inputMode="numeric"
                            value={s.price}
                            onChange={(e) =>
                              setS({ price: e.target.value.replace(/[^0-9.]/g, '') })
                            }
                            placeholder="Precio"
                            aria-label="Precio"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setP(
                                'services',
                                profile.services.filter((_, j) => j !== i),
                              )
                            }
                            className="h-11 rounded-[10px] border border-[#d6d3d1] bg-white px-3 text-sm font-medium text-[#1c1917] hover:border-[#a8a29e]"
                            aria-label="Quitar tipo de cita"
                          >
                            Quitar
                          </button>
                        </div>
                      )
                    })}
                    {profile.services.length < 8 && (
                      <button
                        type="button"
                        onClick={() =>
                          setP('services', [
                            ...profile.services,
                            { name: '', durationMins: '30', price: '' },
                          ])
                        }
                        className="h-10 w-fit rounded-[10px] border border-[#d6d3d1] bg-white px-3 text-sm font-medium hover:border-[#a8a29e]"
                      >
                        Agregar tipo de cita
                      </button>
                    )}
                  </div>
                </Field>
              </div>
            </div>
          )}
        </Section>

        {/* Save bar */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            className={btnPrimary}
            disabled={pending || !form.name || !form.phone}
            onClick={save}
          >
            {pending && <Spinner />}
            {pending ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {error ? (
            <p className="text-sm text-[#b45309]" role="alert">
              {error}
            </p>
          ) : saved ? (
            <p className="text-sm font-medium text-[#0f766e]" role="status">
              Guardado
            </p>
          ) : (
            <span className="text-[13px] text-[#57534e]">
              Los cambios se aplican de inmediato para todo el equipo.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
