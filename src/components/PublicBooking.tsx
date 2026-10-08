'use client'

// Public booking flow (mobile-first): doctor → day → time → contact → confirmed.
// Optional "extra / emergency" request form when the clinic enables it.

import { useEffect, useState, useTransition } from 'react'
import { btnPrimary, btnGhost, inputClass, textareaClass, Field, Spinner } from './primitives'
import { IconCheck } from './icons'
import { toWaDigits } from '@/lib/whatsapp'
import { getSlots, submitBooking, submitRequest } from '@/app/(frontend)/agendar/[slug]/actions'

type Doctor = { id: string; name: string; specialty: string | null; dates: string[] }

const GENDER_OPTIONS = [
  { value: 'female', label: 'Femenino' },
  { value: 'male', label: 'Masculino' },
  { value: 'other', label: 'Otro' },
]

/** "2026-10-12" → "lun 12 oct" (date-only, so read it as UTC noon). */
const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('es-DO', { ...opts, timeZone: 'UTC' })

/** "14:20" → "2:20 pm". */
function timeLabel(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

type Contact = { name: string; phone: string; ageYears: string; gender: string }
const EMPTY_CONTACT: Contact = { name: '', phone: '', ageYears: '', gender: '' }

function ContactFields({ value, onChange }: { value: Contact; onChange: (c: Contact) => void }) {
  const set = (k: keyof Contact, v: string) => onChange({ ...value, [k]: v })
  return (
    <div className="flex flex-col gap-3">
      <Field label="Nombre completo del paciente">
        <input className={inputClass} value={value.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" />
      </Field>
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <Field label="Teléfono (WhatsApp)">
          <input
            className={inputClass}
            value={value.phone}
            onChange={(e) => set('phone', e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="809-555-1234"
          />
        </Field>
        <Field label="Edad">
          <input className={inputClass} value={value.ageYears} onChange={(e) => set('ageYears', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" />
        </Field>
      </div>
      <Field label="Sexo">
        <div className="grid grid-cols-3 gap-2">
          {GENDER_OPTIONS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => set('gender', g.value)}
              className={`h-10 rounded-md border text-sm font-medium transition-colors ${
                value.gender === g.value ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-card text-muted-foreground'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </Field>
    </div>
  )
}

const contactReady = (c: Contact) => c.name.trim().length >= 3 && c.phone.replace(/[^0-9]/g, '').length >= 10 && c.ageYears !== '' && c.gender !== ''
const contactInput = (c: Contact) => ({ name: c.name, phone: c.phone, gender: c.gender, ageYears: Number(c.ageYears) })

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-5 py-5 last:border-0">
      <h2 className="mb-3 flex items-center gap-2.5 text-sm font-semibold">
        <span className="flex size-5 items-center justify-center rounded-full bg-primary-soft text-[11px] text-primary">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

export function PublicBooking({
  slug,
  clinicName,
  clinicPhone,
  currency,
  durationMins,
  requestsEnabled,
  windowDays,
  doctors,
}: {
  slug: string
  clinicName: string
  clinicPhone: string | null
  currency: string | null
  durationMins: number
  requestsEnabled: boolean
  windowDays: number
  doctors: Doctor[]
}) {
  const [doctorId, setDoctorId] = useState(doctors.length === 1 ? doctors[0].id : '')
  const doctor = doctors.find((d) => d.id === doctorId)
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState<string[] | null>(null)
  const [time, setTime] = useState('')
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ start: string; patientName: string } | null>(null)
  const [pending, start] = useTransition()
  const [loadingSlots, startSlots] = useTransition()

  // Load free times whenever the doctor or day changes.
  useEffect(() => {
    setTime('')
    setSlots(null)
    if (!doctorId || !date) return
    startSlots(async () => setSlots(await getSlots(slug, doctorId, date)))
  }, [slug, doctorId, date])

  const book = () => {
    setError(null)
    start(async () => {
      const res = await submitBooking(slug, { doctorId, date, time, reason, ...contactInput(contact) })
      if (res.ok) setDone(res.data)
      else {
        setError(res.message)
        // The slot may have just been taken — refresh the list.
        if (res.code === 'SLOT_TAKEN') setSlots(await getSlots(slug, doctorId, date))
      }
    })
  }

  const wa = toWaDigits(clinicPhone, currency)

  if (done) {
    const msg = `Hola, acabo de agendar una cita en línea para ${done.patientName} con ${doctor?.name} el ${dayLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })} a las ${timeLabel(time)}.`
    return (
      <div className="card-flat p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <IconCheck size={22} strokeWidth={2.5} />
        </span>
        <h2 className="mt-4 text-lg font-semibold">¡Cita confirmada!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {done.patientName}, le esperamos el{' '}
          <span className="font-medium text-ink">{dayLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}</span> a las{' '}
          <span className="font-medium text-ink">{timeLabel(time)}</span> con {doctor?.name}.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Llegue 10 minutos antes. Si no puede asistir, avise al consultorio.</p>
        <div className="mt-6 flex flex-col gap-2">
          {wa && (
            <a href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className={`${btnPrimary} w-full`}>
              Avisar al consultorio por WhatsApp
            </a>
          )}
          <button
            type="button"
            className={`${btnGhost} w-full`}
            onClick={() => {
              setDone(null)
              setDate('')
              setReason('')
            }}
          >
            Agendar otra cita
          </button>
        </div>
      </div>
    )
  }

  let n = 0
  return (
    <div className="flex flex-col gap-4">
      <div className="card-flat overflow-hidden">
        {doctors.length > 1 && (
          <Step n={++n} title="Elija el médico">
            <div className="flex flex-col gap-2">
              {doctors.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setDoctorId(d.id)
                    setDate('')
                  }}
                  className={`rounded-lg border px-4 py-3 text-start transition-colors ${
                    d.id === doctorId ? 'border-primary bg-primary-soft' : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <div className="text-sm font-semibold">{d.name}</div>
                  {d.specialty && <div className="text-xs text-muted-foreground">{d.specialty}</div>}
                </button>
              ))}
            </div>
          </Step>
        )}

        {doctor && (
          <Step n={++n} title={doctors.length === 1 ? `Elija el día · ${doctor.name}` : 'Elija el día'}>
            {doctor.dates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay días disponibles en los próximos {windowDays} días.</p>
            ) : (
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
                {doctor.dates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDate(d)}
                    className={`flex w-16 shrink-0 flex-col items-center rounded-lg border py-2 transition-colors ${
                      d === date ? 'border-primary bg-primary text-white' : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    <span className={`text-[11px] uppercase ${d === date ? 'text-white/80' : 'text-muted-foreground'}`}>
                      {dayLabel(d, { weekday: 'short' }).replace('.', '')}
                    </span>
                    <span className="text-lg font-semibold">{dayLabel(d, { day: 'numeric' })}</span>
                    <span className={`text-[11px] ${d === date ? 'text-white/80' : 'text-muted-foreground'}`}>
                      {dayLabel(d, { month: 'short' }).replace('.', '')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Step>
        )}

        {doctor && date && (
          <Step n={++n} title="Elija la hora">
            {loadingSlots || slots === null ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner /> Buscando horarios…
              </p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quedan horarios libres este día. Pruebe otro día.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTime(t)}
                      className={`tabular h-10 rounded-md border text-sm font-medium transition-colors ${
                        t === time ? 'border-primary bg-primary text-white' : 'border-border bg-card hover:border-primary/40'
                      }`}
                    >
                      {timeLabel(t)}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Cada cita dura unos {durationMins} minutos.</p>
              </>
            )}
          </Step>
        )}

        {time && (
          <Step n={++n} title="Sus datos">
            <ContactFields value={contact} onChange={setContact} />
            <div className="mt-3">
              <Field label="Motivo de la consulta (opcional)">
                <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
              </Field>
            </div>
            {error && (
              <p className="mt-3 rounded-md border border-red/25 bg-red-soft px-3 py-2 text-sm text-red" role="alert">
                {error}
              </p>
            )}
            <button type="button" className={`${btnPrimary} mt-4 w-full`} disabled={pending || !contactReady(contact)} onClick={book}>
              {pending && <Spinner />}
              {pending ? 'Confirmando…' : `Confirmar cita · ${dayLabel(date)} ${timeLabel(time)}`}
            </button>
          </Step>
        )}
      </div>

      {requestsEnabled && <RequestForm slug={slug} doctors={doctors} doctorId={doctorId} clinicName={clinicName} />}
    </div>
  )
}

function RequestForm({ slug, doctors, doctorId, clinicName }: { slug: string; doctors: Doctor[]; doctorId: string; clinicName: string }) {
  const [open, setOpen] = useState(false)
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT)
  const [reason, setReason] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, start] = useTransition()

  if (sent) {
    return (
      <div className="card-flat p-5 text-center text-sm">
        <p className="font-semibold">Solicitud enviada</p>
        <p className="mt-1 text-muted-foreground">{clinicName} revisará su solicitud y le contactará por teléfono o WhatsApp.</p>
      </div>
    )
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="card-flat px-5 py-4 text-start transition-colors hover:border-primary/40">
        <div className="text-sm font-semibold">¿No encuentra horario o es una urgencia?</div>
        <div className="text-xs text-muted-foreground">Envíe una solicitud y el consultorio le contactará.</div>
      </button>
    )
  }

  const send = () => {
    setError(null)
    start(async () => {
      const res = await submitRequest(slug, {
        ...contactInput(contact),
        doctorId: doctorId || (doctors.length === 1 ? doctors[0].id : undefined),
        preferredDate: preferredDate || undefined,
        reason,
        urgent,
      })
      if (res.ok) setSent(true)
      else setError(res.message)
    })
  }

  return (
    <div className="card-flat p-5">
      <h2 className="text-sm font-semibold">Solicitud de cita adicional o de emergencia</h2>
      <p className="mb-4 mt-1 text-xs text-muted-foreground">No es una cita confirmada: el consultorio le contactará para coordinar.</p>
      <ContactFields value={contact} onChange={setContact} />
      <div className="mt-3 flex flex-col gap-3">
        <Field label="Fecha preferida (opcional)">
          <input type="date" className={inputClass} value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
        </Field>
        <Field label="Motivo">
          <textarea className={textareaClass} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
        </Field>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
          Es una emergencia
        </label>
        {urgent && <p className="text-xs text-red">Si la vida del paciente está en riesgo, llame al 911 o acuda a emergencias.</p>}
      </div>
      {error && (
        <p className="mt-3 rounded-md border border-red/25 bg-red-soft px-3 py-2 text-sm text-red" role="alert">
          {error}
        </p>
      )}
      <button type="button" className={`${btnPrimary} mt-4 w-full`} disabled={pending || !contactReady(contact) || reason.trim().length < 3} onClick={send}>
        {pending && <Spinner />}
        {pending ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </div>
  )
}
