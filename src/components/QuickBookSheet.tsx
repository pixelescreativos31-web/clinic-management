'use client'

// Sheet for the Panel / Agenda (design_handoff_medira «Hoja»: bottom on phones,
// centred on desktop):
// «Nueva cita» (patient + free time) and «Paciente sin cita» (walk-in turn).
// Saves through the existing bookAppointment action, which re-validates the
// doctor's availability and the double-booking guard.

import { useRegional } from './RegionalProvider'
import { compactHHMM } from '@/lib/regional'
import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Spinner } from './primitives'
import { bookAppointment, staffFreeSlots } from '@/app/(frontend)/dashboard/appointments/actions'
import { searchPatients, type PatientHit } from '@/app/(frontend)/dashboard/patients/actions'

export type QuickMode = 'appt' | 'walkin'


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
  const { timeFormat } = useRegional()
  const short = (t: string) => compactHHMM(t, timeFormat)
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

  const field = 'h-12 w-full rounded-[10px] border border-[#d6d3d1] bg-white px-3.5 text-base text-[#1c1917] outline-none focus:border-[#0f766e]'
  const label = 'text-[13px] font-medium text-[#44403c]'
  const option = (on: boolean) =>
    `h-10 rounded-[10px] border px-3.5 text-sm font-medium transition-colors ${on ? 'border-[#1c1917] bg-[#1c1917] text-white' : 'border-[#d6d3d1] bg-white text-[#1c1917] hover:border-[#1c1917]'}`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={mode === 'walkin' ? 'Paciente sin cita' : 'Nueva cita'}>
      <div className="absolute inset-0 bg-[rgba(28,25,23,.45)]" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-[520px] animate-[md-up_.2s_ease-out] flex-col gap-3.5 overflow-y-auto rounded-t-2xl border border-[#e7e5e4] bg-white px-5 pt-4 pb-[max(20px,env(safe-area-inset-bottom))] md:rounded-[14px] md:pb-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold tracking-[-.02em]">{mode === 'walkin' ? 'Paciente sin cita' : 'Nueva cita'}</h2>
          <button type="button" onClick={onClose} className="h-9 rounded-lg px-2 text-sm font-medium text-[#57534e] hover:text-[#1c1917]">
            Cerrar
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Paciente</span>
          {patient ? (
            <div className="flex min-h-12 items-center justify-between gap-3 rounded-[10px] border border-[#0f766e] bg-white px-3.5">
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold">{patient.name}</span>
                <span className="tabular block text-[13px] text-[#57534e]">
                  {patient.phone} · <span className="font-mono">{patient.mrn}</span>
                </span>
              </span>
              <button type="button" onClick={() => setPatient(null)} className="text-sm font-medium text-[#0f766e] hover:text-[#115e59]">
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nombre o teléfono"
                aria-label="Buscar paciente"
                className={field}
              />
              {hits.length > 0 && (
                <div className="overflow-hidden rounded-[10px] border border-[#e7e5e4]">
                  {hits.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        setPatient(h)
                        setQuery('')
                      }}
                      className="flex min-h-11 w-full items-center justify-between gap-3 border-t border-[#f0eeec] px-3.5 text-start first:border-t-0 hover:bg-[#fafaf7]"
                    >
                      <span className="truncate text-sm font-medium">{h.name}</span>
                      <span className="tabular shrink-0 text-[13px] text-[#57534e]">{h.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {query.trim().length >= 2 && hits.length === 0 && (
                <p className="text-sm text-[#57534e]">
                  Sin resultados.{' '}
                  <Link href="/dashboard/patients/new" className="font-medium text-[#0f766e] hover:text-[#115e59]">
                    Registrar paciente nuevo
                  </Link>
                </p>
              )}
            </>
          )}
        </div>

        {doctors.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <span className={label}>Médico</span>
            <div className="flex flex-wrap gap-1.5">
              {doctors.map((d) => (
                <button key={d.id} type="button" aria-pressed={d.id === doctorId} onClick={() => setDoctorId(d.id)} className={option(d.id === doctorId)}>
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'appt' ? (
          <div className="flex flex-col gap-1.5">
            <span className={label}>Horarios libres · {dateLabel}</span>
            {slots === null ? (
              <p className="flex items-center gap-2 text-sm text-[#57534e]">
                <Spinner /> Buscando horarios…
              </p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-[#57534e]">No quedan horarios libres este día.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {slots.map((s) => (
                  <button key={s} type="button" aria-pressed={s === time} onClick={() => setTime(s)} className={`tabular ${option(s === time)}`}>
                    {short(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-[10px] bg-[#f0eeec] px-3.5 py-3 text-sm text-[#44403c]">
            Recibe el siguiente turno de hoy y aparece en la agenda sin mover las citas programadas.
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className={label}>Motivo (opcional)</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={field} />
        </label>
        {error && (
          <p className="rounded-[10px] border border-[#b45309] px-3 py-2 text-sm text-[#b45309]" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className={`flex h-12 items-center justify-center gap-2 rounded-[10px] px-4 text-[15px] font-semibold transition-colors ${
            ready ? 'bg-[#0f766e] text-white hover:bg-[#115e59]' : 'bg-[#f0eeec] text-[#57534e]'
          }`}
        >
          {pending && <Spinner />}
          {mode === 'walkin' ? 'Dar turno' : time ? `Agendar a las ${short(time)}` : 'Elija un horario'}
        </button>
      </div>
    </div>
  )
}
