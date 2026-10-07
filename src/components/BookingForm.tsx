'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { btnPrimary, btnGhost, inputClass, Card, Field, Avatar, Spinner } from './primitives'
import { AppSelect } from './AppSelect'
import { DatePicker } from './DatePicker'
import { TimePicker } from './TimePicker'
import { Checkbox } from '@/components/ui/checkbox'
import { IconSearch, IconCheck, IconX } from './icons'
import { searchPatients, createPatient, findByPhone, type PatientHit } from '@/app/(frontend)/dashboard/patients/actions'
import { bookAppointment, availableDoctorsAt, type DoctorAvailabilityHit } from '@/app/(frontend)/dashboard/appointments/actions'

export type DoctorOption = { id: string; name: string; tag: string; note: string }

function TagChip({ tag }: { tag: string }) {
  if (tag === 'onCall')
    return <span className="rounded-full bg-blue-soft px-2 py-px text-[10px] font-medium text-blue">De guardia</span>
  if (tag === 'byAppointment')
    return <span className="rounded-full bg-amber-soft px-2 py-px text-[10px] font-medium text-amber">Previa cita</span>
  return null
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-6 py-5 last:border-0">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="flex size-5 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
          {n}
        </span>
        <h2 className="text-[13px] font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export function BookingForm({
  doctors,
  defaultDate,
  defaultDuration,
  openTime = '09:00',
  closeTime = '21:00',
  initialPatient = null,
}: {
  /** Prefill from a patient file ("Agendar cita" on the patient page). */
  initialPatient?: PatientHit | null
  doctors: DoctorOption[]
  defaultDate: string
  defaultDuration: number
  openTime?: string
  closeTime?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ token?: string } | null>(null)

  // Patient
  const [selected, setSelected] = useState<PatientHit | null>(initialPatient)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PatientHit[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [pName, setPName] = useState('')
  const [pPhone, setPPhone] = useState('')
  const [pGender, setPGender] = useState('female')
  const [pAge, setPAge] = useState('')
  const [dupes, setDupes] = useState<PatientHit[]>([])

  // Appointment fields (controlled so the finder can read them)
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? '')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState(String(defaultDuration))
  const [reason, setReason] = useState('')
  const [isWalkIn, setIsWalkIn] = useState(false)

  // Finder
  const [finderHits, setFinderHits] = useState<DoctorAvailabilityHit[] | null>(null)

  const runSearch = (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) return setHits([])
    startTransition(async () => setHits(await searchPatients(q)))
  }
  const checkPhone = (phone: string) => {
    setPPhone(phone)
    if (phone.trim().length < 5) return setDupes([])
    startTransition(async () => setDupes(await findByPhone(phone)))
  }
  const quickAdd = () => {
    setError(null)
    startTransition(async () => {
      const res = await createPatient({ name: pName, phone: pPhone, gender: pGender, ageYears: pAge ? Number(pAge) : undefined })
      if (res.ok) {
        setSelected(res.data)
        setShowAdd(false)
      } else setError(res.message)
    })
  }

  const findDoctors = () => {
    setError(null)
    if (!date || !time) {
      setError('Primero elija la fecha y la hora.')
      return
    }
    startTransition(async () => {
      setFinderHits(await availableDoctorsAt(date, time, Number(duration)))
    })
  }

  const submit = () => {
    setError(null)
    if (!selected) return setError('Primero seleccione o agregue un paciente.')
    if (!doctorId) return setError('Elija un médico.')
    const fd = new FormData()
    fd.set('patient', selected.id)
    fd.set('doctor', doctorId)
    fd.set('date', date)
    fd.set('time', time)
    fd.set('durationMins', duration)
    fd.set('reason', reason)
    if (isWalkIn) fd.set('isWalkIn', 'on')
    startTransition(async () => {
      const res = await bookAppointment(fd)
      if (res.ok) {
        if (isWalkIn || res.data.token) setSuccess({ token: res.data.token })
        else {
          router.push('/dashboard/appointments')
          router.refresh()
        }
      } else setError(res.message)
    })
  }

  if (success) {
    return (
      <Card className="p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <IconCheck size={22} />
        </span>
        <h2 className="mt-4 text-lg font-semibold">Cita registrada</h2>
        {success.token ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Paciente sin cita registrado: se atiende por orden de llegada.
            <span className="tabular mt-3 block font-display text-4xl font-semibold text-ink">
              {success.token}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Cita agendada.</p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/dashboard/appointments" className={btnPrimary}>Ir a la agenda del día</Link>
          <button className={btnGhost} onClick={() => { setSuccess(null); setSelected(null); setTime('') }}>
            Agendar otra
          </button>
        </div>
      </Card>
    )
  }

  const selectedDoctor = doctors.find((d) => d.id === doctorId)
  const canSubmit = Boolean(selected && doctorId && date && time)

  return (
    <Card className="overflow-hidden">
      {/* 1. Patient */}
      <Step n={1} title="Paciente">
        {selected ? (
          <div className="flex items-center gap-3 rounded-lg border border-primary/25 bg-primary-soft/60 px-3 py-2.5">
            <Avatar name={selected.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{selected.name}</div>
              <div className="tabular truncate text-xs text-muted-foreground">{selected.mrn} · {selected.phone}</div>
            </div>
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-ink"
              title="Cambiar paciente"
              onClick={() => setSelected(null)}
            >
              <IconX size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <IconSearch size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                className={`${inputClass} ps-9`}
                placeholder="Buscar por nombre, teléfono o n.º de expediente…"
                value={query}
                onChange={(e) => runSearch(e.target.value)}
              />
            </div>
            {hits.length > 0 && (
              <ul className="mt-1.5 divide-y divide-border overflow-hidden rounded-lg border border-border">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-2 text-start transition-colors hover:bg-canvas"
                      onClick={() => { setSelected(h); setHits([]) }}
                    >
                      <Avatar name={h.name} size="sm" />
                      <span className="flex-1 truncate text-sm font-medium">{h.name}</span>
                      <span className="tabular text-xs text-faint">{h.mrn} · {h.phone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="mt-2.5 text-[13px] font-medium text-primary hover:underline" onClick={() => setShowAdd((s) => !s)}>
              {showAdd ? '− Ocultar registro rápido' : '+ Nuevo paciente'}
            </button>
            {showAdd && (
              <div className="mt-2 flex flex-col gap-2.5 rounded-lg border border-border bg-canvas/50 p-3.5">
                <input className={inputClass} placeholder="Nombre completo" value={pName} onChange={(e) => setPName(e.target.value)} />
                <input className={inputClass} placeholder="Teléfono" value={pPhone} onChange={(e) => checkPhone(e.target.value)} />
                {dupes.length > 0 && (
                  <div className="rounded-md border border-amber/25 bg-amber-soft px-3 py-2 text-xs text-amber">
                    {dupes.length === 1 ? 'Ya hay 1 paciente con este número:' : `Ya hay ${dupes.length} pacientes con este número:`}{' '}
                    {dupes.map((d, i) => (
                      <button key={d.id} type="button" className="font-medium underline" onClick={() => { setSelected(d); setShowAdd(false) }}>
                        {d.name}{i < dupes.length - 1 ? ', ' : ''}
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  <AppSelect
                    value={pGender}
                    onChange={setPGender}
                    options={[
                      { value: 'male', label: 'Masculino' },
                      { value: 'female', label: 'Femenino' },
                      { value: 'other', label: 'Otro' },
                    ]}
                  />
                  <input className={inputClass} placeholder="Edad" inputMode="numeric" value={pAge} onChange={(e) => setPAge(e.target.value)} />
                </div>
                <button type="button" className={btnGhost} disabled={pending || !pName || !pPhone} onClick={quickAdd}>
                  {pending && <Spinner />}
                  {pending ? 'Agregando…' : 'Agregar paciente'}
                </button>
              </div>
            )}
          </>
        )}
      </Step>

      {/* 2. When */}
      <Step n={2} title="Fecha y hora">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1.4fr_1fr_4.5rem]">
          <Field label="Fecha"><DatePicker value={date} onChange={setDate} /></Field>
          <Field label="Hora">
            <TimePicker value={time} onChange={setTime} openTime={openTime} closeTime={closeTime} />
          </Field>
          <Field label="Min"><input type="number" min={5} max={120} value={duration} onChange={(e) => setDuration(e.target.value)} className={inputClass} /></Field>
        </div>
      </Step>

      {/* 3. Doctor — skipped entirely when the practice has a single doctor. */}
      {doctors.length > 1 && (
      <Step n={3} title="Médico">
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-canvas px-3.5 py-2.5">
          <span className="text-xs text-muted-foreground">¿No sabe quién está disponible a esa hora?</span>
          <button
            type="button"
            className="shrink-0 text-[13px] font-medium text-primary hover:underline disabled:opacity-50"
            disabled={pending || !time}
            onClick={findDoctors}
          >
            Ver disponibilidad
          </button>
        </div>

        {finderHits && (
          <div className="mb-3 flex flex-col gap-1.5">
            {finderHits.length === 0 && <p className="text-sm text-muted-foreground">No hay médicos para mostrar.</p>}
            {finderHits.map((h) => (
              <button
                key={h.id}
                type="button"
                disabled={!h.free}
                onClick={() => setDoctorId(h.id)}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-start transition-colors ${
                  doctorId === h.id
                    ? 'border-primary/50 bg-primary-soft/60'
                    : h.free
                      ? 'border-border bg-surface hover:border-primary/40'
                      : 'border-border bg-surface opacity-45'
                }`}
              >
                <Avatar name={h.name} size="sm" />
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-medium">{h.name}</span>
                  <TagChip tag={h.tag} />
                </span>
                <span className={`shrink-0 text-xs font-medium ${h.free ? 'text-primary' : 'text-faint'}`}>
                  {h.free ? '● Disponible' : 'Ocupado'}
                </span>
              </button>
            ))}
          </div>
        )}

        <AppSelect
          value={doctorId}
          onChange={setDoctorId}
          placeholder="Elija un médico"
          options={doctors.map((d) => ({
            value: d.id,
            label: d.note ? `${d.name} — ${d.note}` : d.name,
          }))}
        />
        {selectedDoctor && (selectedDoctor.tag === 'onCall' || selectedDoctor.tag === 'byAppointment') && (
          <p className="mt-1.5 text-xs text-faint">
            {selectedDoctor.tag === 'onCall'
              ? 'Médico de guardia: puede agendarse a cualquier hora.'
              : 'Médico visitante / previa cita: coordine la hora directamente.'}
          </p>
        )}
      </Step>
      )}

      {/* 4. Details */}
      <Step n={doctors.length > 1 ? 4 : 3} title="Detalles">
        <Field label="Motivo (opcional)">
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="Fiebre, seguimiento…" />
        </Field>
        <label className="mt-3.5 flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3.5 py-2.5 text-sm transition-colors has-data-checked:border-blue/40 has-data-checked:bg-blue-soft/40">
          <Checkbox checked={isWalkIn} onCheckedChange={(v) => setIsWalkIn(v === true)} />
          <span>
            <span className="font-medium">Sin cita</span>
            <span className="block text-xs text-muted-foreground">Queda en espera ahora y recibe un turno</span>
          </span>
        </label>
      </Step>

      <div className="flex items-center justify-between gap-3 bg-canvas/60 px-6 py-4">
        {error ? <p className="text-sm text-red" role="alert">{error}</p> : <span />}
        <button type="button" className={btnPrimary} disabled={pending || !canSubmit} onClick={submit}>
          {pending && <Spinner />}
          {pending ? 'Agendando…' : isWalkIn ? 'Registrar llegada sin cita' : 'Agendar cita'}
        </button>
      </div>
    </Card>
  )
}
