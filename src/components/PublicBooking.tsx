'use client'

// Public booking flow — design handoff "Flujos · Reserva en línea": one 390px card
// with a 4px progress bar and three steps (Fecha y hora → Sus datos → Cita
// confirmada). Optional "extra / emergency" request form when the clinic enables it.

import { useEffect, useState, useTransition } from 'react'
import { Spinner } from './primitives'
import { toWaDigits } from '@/lib/whatsapp'
import { getSlots, submitBooking, submitRequest } from '@/app/(frontend)/agendar/[slug]/actions'
import type { PublicService } from '@/lib/publicBooking'

export type BookingDay = { date: string; dow: string; num: number; open: boolean }
export type BookingDoctor = {
  id: string
  name: string
  specialty: string | null
  licenseNumber: string | null
  hours: string
  services: PublicService[]
  days: BookingDay[]
}
type Clinic = { name: string; phone: string | null; address: string | null; currency: string | null; requestsEnabled: boolean }
type Done = { code: string; start: string; durationMins: number; serviceName: string; patientName: string }

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const LONG_DOW: Record<string, string> = { Lun: 'Lunes', Mar: 'Martes', Mié: 'Miércoles', Jue: 'Jueves', Vie: 'Viernes', Sáb: 'Sábado', Dom: 'Domingo' }

/** "14:30" → "2:30" */
const short = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}`
}
const ampm = (t: string) => `${short(t)} ${Number(t.slice(0, 2)) < 12 ? 'a. m.' : 'p. m.'}`
const dayLabel = (d: BookingDay) => `${d.dow} ${d.num} de ${MONTHS[Number(d.date.slice(5, 7)) - 1]}`

function money(amount: number, currency: string | null) {
  const symbol = currency === 'DOP' || !currency ? 'RD$' : currency === 'USD' ? 'US$' : currency
  return `${symbol} ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

/** Download a one-event .ics so the patient can add the appointment to their calendar. */
function downloadIcs(done: Done, doctor: string, clinic: Clinic) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const start = new Date(done.start)
  const end = new Date(start.getTime() + done.durationMins * 60_000)
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`)
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EMR//Agenda en linea//ES',
    'BEGIN:VEVENT',
    `UID:${done.code}@emr`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(`${done.serviceName} con ${doctor}`)}`,
    clinic.address ? `LOCATION:${esc(`${clinic.name}, ${clinic.address}`)}` : `LOCATION:${esc(clinic.name)}`,
    `DESCRIPTION:${esc(`Código ${done.code}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${done.code}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

// Handoff tokens: card radius 14, fields 48px radius 10 (border line-3), label 13/500 above.
const CARD = 'rounded-[14px] border border-border bg-card p-[clamp(20px,5vw,28px)]'
const INPUT =
  'h-12 w-full rounded-[10px] border border-line-3 bg-card px-3 text-base text-foreground outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
const TEXTAREA =
  'w-full resize-none rounded-[10px] border border-line-3 bg-card px-3 py-3 text-base text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
const LABEL = 'text-[13px] font-medium text-[#44403c]'
const HINT = 'text-xs text-muted-foreground'
const BTN2 =
  'flex min-h-[46px] w-full items-center justify-center rounded-[10px] border border-line-3 bg-card px-4 text-[15px] font-medium text-foreground transition-colors hover:border-[#a8a29e]'
/** Selectable option (chip): radius 10, active = ink. */
const chip = (active: boolean) =>
  `rounded-[10px] border transition-colors ${active ? 'border-inv bg-inv text-white' : 'border-line-3 bg-card text-foreground hover:border-[#a8a29e]'}`

function Cta({ enabled, children, onClick }: { enabled: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={!enabled}
      className={`flex h-[50px] w-full items-center justify-center gap-2 rounded-[10px] px-4 text-base font-semibold text-white transition-colors ${
        enabled ? 'bg-primary hover:bg-primary-hover' : 'bg-[#a8a29e]'
      }`}
    >
      {children}
    </button>
  )
}

function Progress({ step, label }: { step: number; label: string }) {
  return (
    <div className="mb-4" aria-label={`Paso ${step} de 3`}>
      <div className="mb-1.5 flex gap-1">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-[2px] ${i <= step ? 'bg-primary' : 'bg-border'}`} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Paso {step} de 3 · {label}
      </p>
    </div>
  )
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-[10px] border border-amber px-3 py-2.5 text-sm font-medium text-amber">
      {children}
    </p>
  )
}

function Lines({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-border">
      {rows.map(([k, v], i) => (
        <div key={k} className={`flex justify-between gap-4 px-3.5 py-[11px] text-sm ${i ? 'border-t border-[#f0eeec]' : ''}`}>
          <span className="shrink-0 text-muted-foreground">{k}</span>
          <span className="text-end font-medium tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  )
}

export function PublicBooking({ slug, clinic, doctors }: { slug: string; clinic: Clinic; doctors: BookingDoctor[] }) {
  const [doctorId, setDoctorId] = useState(doctors[0].id)
  const doctor = doctors.find((d) => d.id === doctorId)!
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [service, setService] = useState(0)
  const firstOpen = doctor.days.find((d) => d.open)?.date ?? ''
  const [date, setDate] = useState(firstOpen)
  const [slots, setSlots] = useState<string[] | null>(null)
  const [time, setTime] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [firstTime, setFirstTime] = useState(true)
  const [done, setDone] = useState<Done | null>(null)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const [loadingSlots, startSlots] = useTransition()

  // Load free times whenever doctor, service or day changes.
  useEffect(() => {
    setTime('')
    setSlots(null)
    if (!date) return
    startSlots(async () => setSlots(await getSlots(slug, doctorId, date, service)))
  }, [slug, doctorId, date, service])

  const day = doctor.days.find((d) => d.date === date)
  const svc = doctor.services[service]
  const ready1 = Boolean(time)
  const ready2 = name.trim().length > 2 && phone.replace(/\D/g, '').length >= 10
  const wa = toWaDigits(clinic.phone, clinic.currency)
  const waHref = (text: string) => (wa ? `https://wa.me/${wa}?text=${encodeURIComponent(text)}` : null)

  const goStep = (s: 1 | 2 | 3) => {
    setError('')
    setStep(s)
  }

  const pickDoctor = (id: string) => {
    const d = doctors.find((x) => x.id === id)!
    setError('')
    setDoctorId(id)
    setService(0)
    setDate(d.days.find((x) => x.open)?.date ?? '')
  }

  const confirm = () => {
    if (!ready2) {
      const missing = [
        name.trim().length > 2 ? null : 'su nombre completo',
        phone.replace(/\D/g, '').length >= 10 ? null : 'un WhatsApp de 10 dígitos',
      ].filter(Boolean)
      return setError(`Falta ${missing.join(' y ')}.`)
    }
    setError('')
    start(async () => {
      const res = await submitBooking(slug, { doctorId, date, time, serviceIndex: service, name, phone, reason, firstTime })
      if (res.ok) {
        setDone(res.data)
        setStep(3)
        return
      }
      setError(res.message)
      if (res.code === 'SLOT_TAKEN') {
        setStep(1)
        setSlots(await getSlots(slug, doctorId, date, service))
      }
    })
  }

  const month = day ? `${MONTHS[Number(day.date.slice(5, 7)) - 1].replace(/^./, (c) => c.toUpperCase())} ${day.date.slice(0, 4)}` : ''
  const priced = doctor.services.filter((s) => s.price != null)
  const doctorLine = [doctor.name, doctor.specialty, doctor.licenseNumber ? `Exequátur ${doctor.licenseNumber}` : null].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-3">
      <div className={CARD}>
        {step === 1 && (
          <>
            <Progress step={1} label="Fecha y hora" />
            <h1 className="text-[22px] leading-[1.2] font-semibold tracking-[-0.03em] text-balance">Reserve su cita</h1>
            <p className="mt-1.5 text-[15px] text-pretty text-muted-foreground">{doctorLine}</p>

            <div className="mt-4">
              <Lines
                rows={[
                  ...(clinic.address ? ([['Lugar', clinic.address]] as [string, string][]) : []),
                  ['Horario', doctor.hours],
                  ...(priced.length ? ([['Precio', priced.map((s) => `${s.name} ${money(s.price!, clinic.currency)}`).join(' · ')]] as [string, string][]) : []),
                ]}
              />
            </div>

            {doctors.length > 1 && (
              <div className="mt-4 flex flex-col gap-1.5">
                <span className={LABEL}>Médico</span>
                {doctors.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={d.id === doctorId}
                    onClick={() => pickDoctor(d.id)}
                    className={`${chip(d.id === doctorId)} flex min-h-[52px] flex-col justify-center px-3.5 py-2 text-start`}
                  >
                    <span className="block text-[15px] font-semibold">{d.name}</span>
                    {d.specialty && (
                      <span className={`block text-[13px] ${d.id === doctorId ? 'text-white/75' : 'text-muted-foreground'}`}>{d.specialty}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {doctor.services.length > 1 && (
              <div className="mt-4">
                <span className={LABEL}>Tipo de cita</span>
                <div className="mt-1.5 flex flex-wrap gap-0.5 rounded-[10px] bg-sunken p-[3px]">
                  {doctor.services.map((s, i) => (
                    <button
                      key={s.name}
                      type="button"
                      aria-pressed={i === service}
                      onClick={() => setService(i)}
                      className={`min-h-10 flex-1 rounded-[8px] px-2 py-1.5 text-center transition-colors ${
                        i === service ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="block text-sm font-medium">{s.name}</span>
                      <span className="block text-xs tabular-nums">
                        {s.durationMins} min{s.price != null ? ` · ${money(s.price, clinic.currency)}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <span className={LABEL}>Día</span>
              <span className={HINT}>{month}</span>
            </div>
            <div className="-mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
              {doctor.days.map((d) => {
                const active = d.date === date
                return (
                  <button
                    key={d.date}
                    type="button"
                    disabled={!d.open}
                    aria-pressed={active}
                    aria-label={dayLabel(d)}
                    onClick={() => {
                      setError('')
                      setDate(d.date)
                    }}
                    className={`${chip(active)} w-[52px] flex-none py-2 text-center ${d.open ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                  >
                    <span className="block text-xs opacity-80">{d.dow}</span>
                    <span className="block text-lg font-semibold tabular-nums">{d.num}</span>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className={LABEL}>Hora</span>
              <span className={HINT}>{slots ? `${slots.length} ${slots.length === 1 ? 'libre' : 'libres'}` : ''}</span>
            </div>
            <div className="mt-1.5">
              {loadingSlots || slots === null ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner /> Buscando horarios…
                </p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No quedan horarios libres este día. Pruebe otro día.</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1.5">
                  {slots.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={t === time}
                      onClick={() => {
                        setError('')
                        setTime(t)
                      }}
                      className={`${chip(t === time)} min-h-10 px-1 text-sm font-medium tabular-nums`}
                    >
                      {ampm(t)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4">
                <Alert>{error}</Alert>
              </div>
            )}
            <div className="mt-[18px]">
              <Cta enabled={ready1} onClick={() => (ready1 ? goStep(2) : setError('Falta elegir una hora disponible.'))}>
                {ready1 && day ? `Continuar · ${dayLabel(day)}, ${ampm(time)}` : 'Continuar'}
              </Cta>
            </div>
          </>
        )}

        {step === 2 && day && (
          <>
            <Progress step={2} label="Sus datos" />
            <h1 className="text-[22px] leading-[1.2] font-semibold tracking-[-0.03em]">Sus datos</h1>
            <p className="mt-1.5 text-[15px] text-muted-foreground">Para confirmarle la cita.</p>

            <div className="mt-4">
              <Lines
                rows={[
                  ['Cita', `${svc.name} · ${dayLabel(day)}, ${ampm(time)}`],
                  ['Médico', doctor.name],
                ]}
              />
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <label htmlFor="pb-name" className={`${LABEL} flex flex-col gap-[5px]`}>
                Nombre completo
                <input id="pb-name" className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="Como aparece en su cédula" autoComplete="name" />
              </label>
              <label htmlFor="pb-phone" className={`${LABEL} flex flex-col gap-[5px]`}>
                WhatsApp
                <input
                  id="pb-phone"
                  className={`${INPUT} tabular-nums`}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="809-000-0000"
                  inputMode="tel"
                  autoComplete="tel"
                />
                <span className={`${HINT} font-normal`}>El consultorio le escribirá a este número para confirmar y recordarle la cita.</span>
              </label>
              <label htmlFor="pb-reason" className={`${LABEL} flex flex-col gap-[5px]`}>
                Motivo (opcional)
                <textarea
                  id="pb-reason"
                  rows={2}
                  maxLength={160}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="ej. Quiero bajar de peso antes de diciembre"
                  className={TEXTAREA}
                />
              </label>
              <label className="flex min-h-11 items-center gap-2.5 text-sm">
                <input type="checkbox" checked={firstTime} onChange={(e) => setFirstTime(e.target.checked)} className="size-5 accent-[#0f766e]" />
                Es mi primera vez con {doctor.name}
              </label>
            </div>

            {error && (
              <div className="mt-3">
                <Alert>{error}</Alert>
              </div>
            )}
            <div className="mt-[18px]">
              <Cta enabled={ready2 && !pending} onClick={confirm}>
                {pending && <Spinner />}
                {pending ? 'Confirmando…' : 'Confirmar cita'}
              </Cta>
            </div>
            <button type="button" onClick={() => goStep(1)} className={`${BTN2} mt-2`}>
              Cambiar fecha u hora
            </button>
            <p className="mt-3.5 text-[13px] text-muted-foreground">Sin pago en línea. Paga en el consultorio.</p>
          </>
        )}

        {step === 3 && done && day && (
          <>
            <Progress step={3} label="Confirmación" />
            <h1 className="text-[22px] leading-[1.2] font-semibold tracking-[-0.03em]">Cita confirmada</h1>
            <p className="mt-1.5 text-[15px] text-pretty text-muted-foreground">
              {LONG_DOW[day.dow] ?? day.dow} {day.num} de {MONTHS[Number(day.date.slice(5, 7)) - 1]} a las {ampm(time)} con {doctor.name}.
            </p>
            <div className="mt-4">
              <Lines
                rows={[
                  ['Paciente', done.patientName],
                  ['Tipo', done.serviceName],
                  ...(clinic.address ? ([['Lugar', clinic.address]] as [string, string][]) : []),
                  ['Código', done.code],
                ]}
              />
            </div>
            <div className="mt-[18px]">
              <Cta enabled onClick={() => downloadIcs(done, doctor.name, clinic)}>
                Añadir al calendario
              </Cta>
            </div>
            {(() => {
              const href = waHref(`Hola, agendé una cita en línea: ${done.serviceName} con ${doctor.name} el ${dayLabel(day)} a las ${ampm(time)}. Código ${done.code}.`)
              return href ? (
                <a href={href} target="_blank" rel="noreferrer" className={`${BTN2} mt-2`}>
                  Ver en WhatsApp
                </a>
              ) : clinic.phone ? (
                <p className="mt-3 text-center text-sm text-muted-foreground tabular-nums">Consultorio: {clinic.phone}</p>
              ) : (
                <p className="mt-3 text-center text-sm text-muted-foreground">Guarde su código.</p>
              )
            })()}
            {waHref('') ? (
              <a
                href={waHref(`Hola, necesito cambiar o cancelar mi cita ${done.code} del ${dayLabel(day)} a las ${ampm(time)}.`)!}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block text-center text-sm font-medium text-primary hover:underline"
              >
                Necesito cambiar o cancelar
              </a>
            ) : (
              <p className="mt-3 text-center text-[13px] text-muted-foreground">Para cambiar o cancelar, llame al consultorio.</p>
            )}
          </>
        )}
      </div>

      {clinic.requestsEnabled && step === 1 && <RequestForm slug={slug} doctorId={doctorId} clinicName={clinic.name} />}
    </div>
  )
}

function RequestForm({ slug, doctorId, clinicName }: { slug: string; doctorId: string; clinicName: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, start] = useTransition()

  if (sent) {
    return (
      <div className={CARD}>
        <p className="text-[17px] font-semibold">Solicitud enviada</p>
        <p className="mt-1 text-sm text-muted-foreground">{clinicName} revisará su solicitud y le contactará por WhatsApp.</p>
      </div>
    )
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-[14px] border border-border bg-card px-5 py-4 text-start transition-colors hover:border-[#a8a29e]">
        <span className="block text-[15px] font-semibold">¿No encuentra horario o es una urgencia?</span>
        <span className="mt-0.5 block text-[13px] text-muted-foreground">Envíe una solicitud y el consultorio le contactará.</span>
      </button>
    )
  }
  const ready = name.trim().length > 2 && phone.replace(/\D/g, '').length >= 10 && reason.trim().length >= 3
  const missing = [
    name.trim().length > 2 ? null : 'su nombre completo',
    phone.replace(/\D/g, '').length >= 10 ? null : 'un WhatsApp de 10 dígitos',
    reason.trim().length >= 3 ? null : 'el motivo',
  ].filter(Boolean)
  const send = () => {
    setError(null)
    start(async () => {
      const res = await submitRequest(slug, { name, phone, doctorId, preferredDate: preferredDate || undefined, reason, urgent })
      if (res.ok) setSent(true)
      else setError(res.message)
    })
  }
  return (
    <div className={CARD}>
      <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Solicitud de cita adicional o de emergencia</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">No es una cita confirmada: el consultorio le contactará para coordinar.</p>
      <div className="mt-4 flex flex-col gap-3">
        <label htmlFor="rq-name" className={`${LABEL} flex flex-col gap-[5px]`}>
          Nombre completo
          <input id="rq-name" className={INPUT} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <label htmlFor="rq-phone" className={`${LABEL} flex flex-col gap-[5px]`}>
          WhatsApp
          <input id="rq-phone" className={`${INPUT} tabular-nums`} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="809-000-0000" />
        </label>
        <label htmlFor="rq-date" className={`${LABEL} flex flex-col gap-[5px]`}>
          Fecha preferida (opcional)
          <input id="rq-date" type="date" className={INPUT} value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
        </label>
        <label htmlFor="rq-reason" className={`${LABEL} flex flex-col gap-[5px]`}>
          Motivo
          <textarea id="rq-reason" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} className={TEXTAREA} />
        </label>
        <label className="flex min-h-11 items-center gap-2.5 text-sm">
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="size-5 accent-[#0f766e]" />
          Es una emergencia
        </label>
        {urgent && <p className="text-[13px] font-medium text-amber">Si la vida del paciente está en riesgo, llame al 911 o acuda a emergencias.</p>}
        {error && <Alert>{error}</Alert>}
      </div>
      <div className="mt-[18px]">
        <Cta enabled={ready && !pending} onClick={() => (ready ? send() : setError(`Falta ${missing.join(', ')}.`))}>
          {pending && <Spinner />}
          {pending ? 'Enviando…' : 'Enviar solicitud'}
        </Cta>
      </div>
    </div>
  )
}
