'use client'

// Bottom sheet for the redesigned Inicio / Agenda (design handoff "Sheet inferior"):
// «Nueva cita» (patient + free time) and «Paciente sin cita» (walk-in turn).
// Saves through the existing bookAppointment action, which re-validates the
// doctor's availability and the double-booking guard.

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Spinner } from './primitives'
import { bookAppointment, staffFreeSlots } from '@/app/(frontend)/dashboard/appointments/actions'
import { searchPatients, type PatientHit } from '@/app/(frontend)/dashboard/patients/actions'

export type QuickMode = 'appt' | 'walkin'

const short = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}`
}

export function QuickBookSheet({
  mode,
  doctors,
  defaultDoctorId,
  date,
  dateLabel,
  presetTime,
  nowHHMM,
  onClose,
  onDone,
}: {
  mode: QuickMode
  doctors: { id: string; name: string }[]
  defaultDoctorId: string
  /** YYYY-MM-DD the appointment is booked on (walk-ins: today). */
  date: string
  dateLabel: string
  presetTime?: string
  /** Current clinic time "HH:mm" — a walk-in arrives now. */
  nowHHMM: string
  onClose: () => void
  onDone: (message: string) => void
}) {
  const router = useRouter()
  const [doctorId, setDoctorId] = useState(defaultDoctorId)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PatientHit[]>([])
  const [patient, setPatient] = useState<PatientHit | null>(null)
  const [slots, setSlots] = useState<string[] | null>(null)
  const [time, setTime] = useState(presetTime ?? '')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Patient search (debounced).
  useEffect(() => {
    clearTimeout(searchTimer.current)
    if (patient || query.trim().length < 2) {
      setHits([])
      return
    }
    searchTimer.current = setTimeout(async () => setHits(await searchPatients(query)), 250)
  }, [query, patient])

  // Free times for the chosen doctor and day.
  useEffect(() => {
    if (mode !== 'appt') return
    setSlots(null)
    staffFreeSlots(doctorId, date).then((s) => {
      setSlots(s)
      setTime((t) => (t && s.includes(t) ? t : ''))
    })
  }, [mode, doctorId, date])

  const ready = Boolean(patient) && (mode === 'walkin' || Boolean(time))
  const submit = () => {
    if (!patient) return setError('Elija el paciente.')
    if (mode === 'appt' && !time) return setError('Elija un horario libre.')
    setError(null)
    start(async () => {
      const fd = new FormData()
      fd.set('patient', patient.id)
      fd.set('doctor', doctorId)
      fd.set('date', date)
      fd.set('time', mode === 'walkin' ? nowHHMM : time)
      fd.set('reason', reason)
      if (mode === 'walkin') fd.set('isWalkIn', 'on')
      const res = await bookAppointment(fd)
      if (!res.ok) return setError(res.message)
      router.refresh()
      onDone(mode === 'walkin' ? `Turno ${res.data.token ?? ''} asignado · aparece en la agenda` : `Cita agendada a las ${short(time)}`)
    })
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={mode === 'walkin' ? 'Paciente sin cita' : 'Nueva cita'}>
      <div className="absolute inset-0 bg-[rgba(12,33,29,.45)]" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[90vh] max-w-[560px] animate-[emr-up_.25s_ease-out] flex-col gap-3 overflow-y-auto rounded-t-[18px] bg-white px-4 pt-2.5 pb-[max(20px,env(safe-area-inset-bottom))]">
        <span className="h-1 w-10 self-center rounded-full bg-[#d7dddd]" />
        <div className="font-display text-lg font-semibold">{mode === 'walkin' ? 'Paciente sin cita' : 'Nueva cita'}</div>

        {patient ? (
          <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[#0d6e60] bg-[#e6f1ee] px-3.5">
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{patient.name}</span>
              <span className="tabular block text-xs text-[#6b7577]">
                {patient.phone} · {patient.mrn}
              </span>
            </span>
            <button type="button" onClick={() => setPatient(null)} className="text-xs font-semibold text-[#0d6e60] underline">
              Cambiar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Paciente (nombre o teléfono)"
              aria-label="Buscar paciente"
              className="h-12 w-full rounded-xl border border-[#e3e7e7] bg-[#fafbfb] px-3.5 text-base outline-none focus:border-[#0d6e60]"
            />
            {hits.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  setPatient(h)
                  setQuery('')
                }}
                className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-start hover:bg-[#f4f6f6]"
              >
                <span className="truncate text-sm font-semibold">{h.name}</span>
                <span className="tabular shrink-0 text-xs text-[#6b7577]">{h.phone}</span>
              </button>
            ))}
            {query.trim().length >= 2 && hits.length === 0 && (
              <Link href="/dashboard/patients/new" className="px-3 py-2 text-sm font-semibold text-[#0d6e60]">
                + Registrar paciente nuevo
              </Link>
            )}
          </div>
        )}

        {doctors.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {doctors.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={d.id === doctorId}
                onClick={() => setDoctorId(d.id)}
                className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold ${
                  d.id === doctorId ? 'border-[#0d6e60] bg-[#0d6e60] text-white' : 'border-[#e3e7e7] bg-white'
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}

        {mode === 'appt' ? (
          <>
            <div className="text-xs text-[#6b7577]">Horarios libres · {dateLabel}</div>
            {slots === null ? (
              <p className="flex items-center gap-2 text-sm text-[#6b7577]">
                <Spinner /> Buscando horarios…
              </p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-[#6b7577]">No quedan horarios libres este día.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={s === time}
                    onClick={() => setTime(s)}
                    className={`tabular rounded-full border px-3.5 py-2.5 text-sm font-semibold ${
                      s === time ? 'border-[#0d6e60] bg-[#0d6e60] text-white' : 'border-[#e3e7e7] bg-white text-[#15201e]'
                    }`}
                  >
                    {short(s)}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-[#e9f0f9] px-3.5 py-3 text-[#2563ab]">
            <span className="tabular text-[22px] font-bold">T</span>
            <span className="text-[13px]">Recibe el siguiente turno de hoy y aparece en la agenda sin mover las citas programadas.</span>
          </div>
        )}

        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (opcional)"
          aria-label="Motivo"
          className="h-12 w-full rounded-xl border border-[#e3e7e7] bg-[#fafbfb] px-3.5 text-base outline-none focus:border-[#0d6e60]"
        />
        {error && (
          <p className="rounded-[10px] bg-[#fbeceb] px-3 py-2 text-sm text-[#b3261e]" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className={`flex min-h-[50px] items-center justify-center gap-2 rounded-xl p-3.5 text-[15px] font-semibold ${
            ready ? 'bg-[#0d6e60] text-white' : 'bg-[#dfe4e4] text-[#6b7577]'
          }`}
        >
          {pending && <Spinner />}
          {mode === 'walkin' ? 'Dar turno' : time ? `Agendar a las ${short(time)}` : 'Elija un horario'}
        </button>
      </div>
    </div>
  )
}
