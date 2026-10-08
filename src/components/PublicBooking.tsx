'use client'

// Public booking flow — design handoff "Agendar público": doctor card + three
// steps (Fecha y hora → Sus datos → Confirmación). Mobile: one column; desktop:
// 340px card beside the steps (max 960px). Optional "extra / emergency" request
// form when the clinic enables it.

import { useEffect, useRef, useState, useTransition } from 'react'
import { Spinner } from './primitives'
import { IconCalendarCheck, IconCalendarPlus, IconCircleCheck, IconClock, IconMapPin, IconMoney, IconWhatsApp } from './icons'
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

/** "14:30" → "2:30" (the design shows times without am/pm inside the grid). */
const short = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}`
}
const ampm = (t: string) => `${short(t)} ${Number(t.slice(0, 2)) < 12 ? 'a. m.' : 'p. m.'}`
const dayLabel = (d: BookingDay) => `${d.dow} ${d.num} de ${MONTHS[Number(d.date.slice(5, 7)) - 1]}`
const initials = (name: string) =>
  name
    .replace(/^Dr[a]?\.?\s+/i, '')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

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

const CARD = 'rounded-2xl border border-[#e3e7e7] bg-white p-4'
const INPUT = 'h-[50px] w-full rounded-xl border border-[#e3e7e7] bg-[#fafbfb] px-3.5 text-base outline-none focus:border-[#0d6e60]'
const LABEL = 'mt-1 text-[13px] font-semibold'

function Cta({ enabled, children, onClick }: { enabled: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={!enabled}
      className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl p-[15px] text-[15px] font-semibold transition-colors ${
        enabled ? 'bg-[#0d6e60] text-white shadow-[0_8px_20px_-10px_rgba(13,110,96,.6)] hover:bg-[#0a584d]' : 'bg-[#dfe4e4] text-[#6b7577]'
      }`}
    >
      {children}
    </button>
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
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [pending, start] = useTransition()
  const [loadingSlots, startSlots] = useTransition()

  const say = (t: string) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }

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

  const pickDoctor = (id: string) => {
    const d = doctors.find((x) => x.id === id)!
    setDoctorId(id)
    setService(0)
    setDate(d.days.find((x) => x.open)?.date ?? '')
  }

  const confirm = () => {
    if (!ready2) return say('Complete nombre y WhatsApp')
    start(async () => {
      const res = await submitBooking(slug, { doctorId, date, time, serviceIndex: service, name, phone, reason, firstTime })
      if (res.ok) {
        setDone(res.data)
        setStep(3)
        return
      }
      say(res.message)
      if (res.code === 'SLOT_TAKEN') {
        setStep(1)
        setSlots(await getSlots(slug, doctorId, date, service))
      }
    })
  }

  const steps = ['Fecha y hora', 'Sus datos', 'Confirmación']
  const month = day ? `${MONTHS[Number(day.date.slice(5, 7)) - 1].replace(/^./, (c) => c.toUpperCase())} ${day.date.slice(0, 4)}` : ''

  return (
    <div className="mx-auto grid max-w-[960px] grid-cols-1 items-start gap-3.5 md:grid-cols-[340px_minmax(0,1fr)]">
      {/* ---- Doctor card ---- */}
      <div className="min-w-0 overflow-hidden rounded-2xl border border-[#e3e7e7] bg-white">
        <div className="h-1.5 bg-[#0d6e60]" />
        <div className="flex flex-col gap-3.5 p-4">
          <div className="flex items-center gap-3.5">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#e6f1ee] font-display text-xl font-bold text-[#0d6e60]">
              {initials(doctor.name)}
            </span>
            <span className="min-w-0">
              <span className="block font-display text-[22px] leading-[1.1] font-bold tracking-[-.02em]">{doctor.name}</span>
              <span className="mt-1 block text-[13px] text-[#6b7577]">
                {[doctor.specialty, doctor.licenseNumber ? `Exequátur ${doctor.licenseNumber}` : null].filter(Boolean).join(' · ')}
              </span>
            </span>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            {clinic.address && (
              <div className="flex items-start gap-2.5">
                <IconMapPin size={19} className="shrink-0 text-[#0d6e60]" />
                <span>{clinic.address}</span>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <IconClock size={19} className="shrink-0 text-[#0d6e60]" />
              <span>{doctor.hours}</span>
            </div>
            {doctor.services.some((s) => s.price != null) && (
              <div className="flex items-start gap-2.5">
                <IconMoney size={19} className="shrink-0 text-[#0d6e60]" />
                <span>
                  {doctor.services
                    .filter((s) => s.price != null)
                    .map((s) => `${s.name} ${money(s.price!, clinic.currency)}`)
                    .join(' · ')}
                </span>
              </div>
            )}
          </div>
          {doctors.length > 1 && step === 1 && (
            <div className="flex flex-col gap-1.5 border-t border-[#eef1f1] pt-3">
              <span className="text-xs font-semibold text-[#6b7577]">Otros médicos</span>
              {doctors
                .filter((d) => d.id !== doctorId)
                .map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => pickDoctor(d.id)}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[#e3e7e7] px-3 py-2 text-start text-sm hover:border-[#0d6e60]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{d.name}</span>
                      {d.specialty && <span className="block truncate text-xs text-[#6b7577]">{d.specialty}</span>}
                    </span>
                    <span className="text-xs font-semibold text-[#0d6e60]">Elegir</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- Steps ---- */}
      <div className="flex min-w-0 flex-col gap-3">
        {step < 3 && (
          <div className="grid grid-cols-3 gap-1.5" aria-label={`Paso ${step} de 3`}>
            {steps.map((label, i) => (
              <div key={label} className="flex flex-col gap-1.5">
                <span className={`h-1 rounded-full ${i < step ? 'bg-[#0d6e60]' : 'bg-[#dfe4e4]'}`} />
                <span className={`text-[11px] font-semibold ${i + 1 === step ? 'text-[#15201e]' : 'text-[#6b7577]'}`}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {step === 1 && (
          <>
            {doctor.services.length > 1 && (
              <div className={`${CARD} flex flex-col gap-2.5`}>
                <span className="text-sm font-semibold">¿Qué tipo de cita?</span>
                <div className="grid grid-cols-2 gap-2">
                  {doctor.services.map((s, i) => (
                    <button
                      key={s.name}
                      type="button"
                      aria-pressed={i === service}
                      onClick={() => setService(i)}
                      className={`flex min-h-16 flex-col gap-0.5 rounded-xl border-[1.5px] p-3 text-start ${
                        i === service ? 'border-[#0d6e60] bg-[#e6f1ee]' : 'border-[#e3e7e7] bg-white'
                      }`}
                    >
                      <span className="text-sm font-semibold">{s.name}</span>
                      <span className="text-xs text-[#6b7577]">
                        {s.durationMins} min{s.price != null ? ` · ${money(s.price, clinic.currency)}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={`${CARD} flex flex-col gap-3`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Elija el día</span>
                <span className="text-xs text-[#6b7577]">{month}</span>
              </div>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
                {doctor.days.map((d) => {
                  const active = d.date === date
                  return (
                    <button
                      key={d.date}
                      type="button"
                      disabled={!d.open}
                      aria-pressed={active}
                      aria-label={dayLabel(d)}
                      onClick={() => setDate(d.date)}
                      className={`w-[54px] flex-none rounded-xl border py-2.5 text-center ${
                        active ? 'border-[#15201e] bg-[#15201e] text-white' : 'border-[#e3e7e7] bg-white text-[#15201e]'
                      } ${d.open ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                    >
                      <span className="block text-[10px] tracking-[.06em] uppercase opacity-80">{d.dow}</span>
                      <span className="tabular mt-0.5 block text-lg font-semibold">{d.num}</span>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Horarios disponibles</span>
                <span className="text-xs text-[#6b7577]">{slots ? `${slots.length} ${slots.length === 1 ? 'libre' : 'libres'}` : ''}</span>
              </div>
              {loadingSlots || slots === null ? (
                <p className="flex items-center gap-2 text-sm text-[#6b7577]">
                  <Spinner /> Buscando horarios…
                </p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-[#6b7577]">No quedan horarios libres este día. Pruebe otro día.</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
                  {slots.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={t === time}
                      aria-label={ampm(t)}
                      onClick={() => setTime(t)}
                      className={`tabular min-h-[46px] rounded-[10px] border px-1 py-3 text-center text-sm font-semibold ${
                        t === time ? 'border-[#15201e] bg-[#15201e] text-white' : 'border-[#e3e7e7] bg-white text-[#15201e]'
                      }`}
                    >
                      {short(t)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Cta enabled={ready1} onClick={() => (ready1 ? setStep(2) : say('Seleccione un horario disponible'))}>
              {ready1 && day ? `Continuar · ${dayLabel(day)}, ${short(time)}` : 'Elija un horario'}
            </Cta>
          </>
        )}

        {step === 2 && day && (
          <>
            <div className={`${CARD} flex flex-col gap-2.5`}>
              <div className="flex items-center gap-2.5 rounded-[10px] bg-[#e6f1ee] px-3 py-2.5 text-[13px] font-semibold text-[#0d6e60]">
                <IconCalendarCheck size={18} className="shrink-0" />
                <span className="min-w-0">
                  {svc.name} · {dayLabel(day)}, {ampm(time)}
                </span>
                <button type="button" onClick={() => setStep(1)} className="ml-auto text-xs underline">
                  Cambiar
                </button>
              </div>
              <label htmlFor="pb-name" className={LABEL}>
                Nombre completo
              </label>
              <input id="pb-name" className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="Como aparece en su cédula" autoComplete="name" />
              <label htmlFor="pb-phone" className={LABEL}>
                WhatsApp
              </label>
              <input
                id="pb-phone"
                className={`${INPUT} tabular`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="809-000-0000"
                inputMode="tel"
                autoComplete="tel"
              />
              <span className="-mt-1 text-xs text-[#6b7577]">El consultorio le escribirá a este número para confirmar y recordarle la cita.</span>
              <label htmlFor="pb-reason" className={LABEL}>
                Motivo <span className="font-normal text-[#6b7577]">(opcional)</span>
              </label>
              <textarea
                id="pb-reason"
                rows={2}
                maxLength={160}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="ej. Quiero bajar de peso antes de diciembre"
                className="w-full resize-none rounded-xl border border-[#e3e7e7] bg-[#fafbfb] px-3.5 py-3 text-base outline-none focus:border-[#0d6e60]"
              />
              <label className="mt-1.5 flex min-h-11 items-center gap-2.5 text-sm">
                <input type="checkbox" checked={firstTime} onChange={(e) => setFirstTime(e.target.checked)} className="size-5 accent-[#0d6e60]" />
                Es mi primera vez con {doctor.name}
              </label>
            </div>
            <Cta enabled={ready2 && !pending} onClick={confirm}>
              {pending && <Spinner />}
              {pending ? 'Confirmando…' : 'Confirmar cita'}
            </Cta>
            <span className="text-center text-xs text-[#6b7577]">Sin pago en línea. Paga en el consultorio.</span>
          </>
        )}

        {step === 3 && done && day && (
          <div className={`${CARD} flex animate-[emr-pop_.3s_ease-out] flex-col items-center gap-3 px-4 py-6 text-center`}>
            <span className="flex size-16 items-center justify-center rounded-full bg-[#e8f4ec] text-[#1a7a50]">
              <IconCircleCheck size={36} strokeWidth={2.25} />
            </span>
            <span className="font-display text-2xl leading-[1.1] font-bold tracking-[-.02em]">Cita confirmada</span>
            <span className="text-[15px] text-[#6b7577]">
              {LONG_DOW[day.dow] ?? day.dow} {day.num} de {MONTHS[Number(day.date.slice(5, 7)) - 1]} a las {ampm(time)} con {doctor.name}.
            </span>
            <div className="mt-1.5 w-full overflow-hidden rounded-xl border border-[#e3e7e7] text-start">
              {[
                ['Paciente', done.patientName],
                ['Tipo', done.serviceName],
                ...(clinic.address ? [['Lugar', clinic.address]] : []),
                ['Código', done.code],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-[#eef1f1] px-3.5 py-[11px] text-sm last:border-0">
                  <span className="text-[#6b7577]">{k}</span>
                  <span className={`text-end font-semibold ${k === 'Código' ? 'tabular' : ''}`}>{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-1 grid w-full grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => downloadIcs(done, doctor.name, clinic)}
                className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-[10px] border border-[#e3e7e7] p-3 text-sm font-semibold"
              >
                <IconCalendarPlus size={18} />
                Añadir al calendario
              </button>
              {(() => {
                const href = waHref(`Hola, agendé una cita en línea: ${done.serviceName} con ${doctor.name} el ${dayLabel(day)} a las ${ampm(time)}. Código ${done.code}.`)
                return href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-[10px] bg-[#0d6e60] p-3 text-sm font-semibold text-white hover:text-white"
                  >
                    <IconWhatsApp size={18} />
                    Ver en WhatsApp
                  </a>
                ) : (
                  <span className="flex min-h-[46px] items-center justify-center rounded-[10px] bg-[#e6f1ee] p-3 text-sm font-semibold text-[#0d6e60]">
                    {clinic.phone ?? 'Guarde su código'}
                  </span>
                )
              })()}
            </div>
            {waHref('') ? (
              <a
                href={waHref(`Hola, necesito cambiar o cancelar mi cita ${done.code} del ${dayLabel(day)} a las ${ampm(time)}.`)!}
                target="_blank"
                rel="noreferrer"
                className="p-2 text-[13px] text-[#6b7577] underline hover:text-[#15201e]"
              >
                Necesito cambiar o cancelar
              </a>
            ) : (
              <span className="p-2 text-[13px] text-[#6b7577]">Para cambiar o cancelar, llame al consultorio.</span>
            )}
          </div>
        )}

        {clinic.requestsEnabled && step === 1 && <RequestForm slug={slug} doctorId={doctorId} clinicName={clinic.name} />}
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-7 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#15201e] px-4 py-2.5 text-[13px] font-medium whitespace-nowrap text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,.5)]"
        >
          {toast}
        </div>
      )}
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
      <div className={`${CARD} text-center text-sm`}>
        <p className="font-semibold">Solicitud enviada</p>
        <p className="mt-1 text-[#6b7577]">{clinicName} revisará su solicitud y le contactará por WhatsApp.</p>
      </div>
    )
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${CARD} text-start hover:border-[#0d6e60]`}>
        <span className="block text-sm font-semibold">¿No encuentra horario o es una urgencia?</span>
        <span className="block text-xs text-[#6b7577]">Envíe una solicitud y el consultorio le contactará.</span>
      </button>
    )
  }
  const ready = name.trim().length > 2 && phone.replace(/\D/g, '').length >= 10 && reason.trim().length >= 3
  const send = () => {
    setError(null)
    start(async () => {
      const res = await submitRequest(slug, { name, phone, doctorId, preferredDate: preferredDate || undefined, reason, urgent })
      if (res.ok) setSent(true)
      else setError(res.message)
    })
  }
  return (
    <div className={`${CARD} flex flex-col gap-2.5`}>
      <span className="text-sm font-semibold">Solicitud de cita adicional o de emergencia</span>
      <span className="-mt-1 text-xs text-[#6b7577]">No es una cita confirmada: el consultorio le contactará para coordinar.</span>
      <label htmlFor="rq-name" className={LABEL}>Nombre completo</label>
      <input id="rq-name" className={INPUT} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      <label htmlFor="rq-phone" className={LABEL}>WhatsApp</label>
      <input id="rq-phone" className={`${INPUT} tabular`} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="809-000-0000" />
      <label htmlFor="rq-date" className={LABEL}>
        Fecha preferida <span className="font-normal text-[#6b7577]">(opcional)</span>
      </label>
      <input id="rq-date" type="date" className={INPUT} value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
      <label htmlFor="rq-reason" className={LABEL}>Motivo</label>
      <textarea
        id="rq-reason"
        rows={3}
        maxLength={1000}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full resize-none rounded-xl border border-[#e3e7e7] bg-[#fafbfb] px-3.5 py-3 text-base outline-none focus:border-[#0d6e60]"
      />
      <label className="flex min-h-11 items-center gap-2.5 text-sm">
        <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="size-5 accent-[#0d6e60]" />
        Es una emergencia
      </label>
      {urgent && <p className="text-xs text-[#b3261e]">Si la vida del paciente está en riesgo, llame al 911 o acuda a emergencias.</p>}
      {error && (
        <p className="rounded-[10px] bg-[#fbeceb] px-3 py-2 text-sm text-[#b3261e]" role="alert">
          {error}
        </p>
      )}
      <Cta enabled={ready && !pending} onClick={() => ready && send()}>
        {pending && <Spinner />}
        {pending ? 'Enviando…' : 'Enviar solicitud'}
      </Cta>
    </div>
  )
}
