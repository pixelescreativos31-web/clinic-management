'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btnGhost, btnPrimary, Spinner } from './primitives'
import { enrollInProgram, updateProgram } from '@/app/(frontend)/dashboard/programs/actions'

const INPUT = 'h-11 w-full rounded-[10px] border border-[#d6d3d1] bg-white px-3 text-base text-[#1c1917] outline-none transition-colors focus:border-[#0f766e] md:text-[15px]'

/** Enrol the patient and jump straight into the initial evaluation (week 0). */
export function EnrollProgram({ patientId, programName, today }: { patientId: string; programName: string; today: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(today)
  const [goal, setGoal] = useState('')

  const go = () => {
    setError(null)
    start(async () => {
      const res = await enrollInProgram(patientId, { startDate, goal })
      if (!res.ok) return setError(res.message)
      if (res.data.appointmentId) router.push(`/dashboard/visits/new?appointment=${res.data.appointmentId}`)
      else {
        setError(res.data.message ?? 'Inscrito. Registre la evaluación inicial con «Atender ahora».')
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-[#44403c]">Fecha de ingreso</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-[#44403c]">Meta (opcional)</span>
          <input value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={200} placeholder="p. ej. Bajar 15 lb en 12 semanas" className={INPUT} />
        </label>
      </div>
      <button type="button" onClick={go} disabled={pending} className={`${btnPrimary} w-fit`}>
        {pending && <Spinner />}
        Inscribir en {programName} y hacer evaluación inicial
      </button>
      {error && <p className="text-[13px] text-[#b45309]" role="alert">{error}</p>}
    </div>
  )
}

/** Close (completed / suspended) or reopen the programme. */
export function ProgramStatusButtons({ programId, status }: { programId: string; status: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<null | 'completed' | 'cancelled'>(null)

  const set = (next: 'active' | 'completed' | 'cancelled') =>
    start(async () => {
      setError(null)
      const res = await updateProgram(programId, { status: next })
      if (!res.ok) setError(res.message)
      setConfirming(null)
      router.refresh()
    })

  if (status !== 'active') {
    return (
      <div className="flex flex-col gap-1">
        <button type="button" disabled={pending} onClick={() => set('active')} className={btnGhost}>
          {pending && <Spinner />}
          Reactivar programa
        </button>
        {error && <p className="text-[13px] text-[#b45309]" role="alert">{error}</p>}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{confirming === 'completed' ? '¿Marcar como completado?' : '¿Suspender el programa?'}</span>
          <button type="button" disabled={pending} onClick={() => set(confirming)} className="inline-flex h-9 items-center rounded-[8px] bg-[#1c1917] px-3 text-[13px] font-medium text-white">
            {pending ? <Spinner /> : 'Sí'}
          </button>
          <button type="button" onClick={() => setConfirming(null)} className="inline-flex h-9 items-center rounded-[8px] border border-[#d6d3d1] bg-white px-3 text-[13px] font-medium">
            No
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={() => setConfirming('completed')} className={btnGhost}>
            Completar
          </button>
          <button type="button" onClick={() => setConfirming('cancelled')} className={btnGhost}>
            Suspender
          </button>
        </div>
      )}
      {error && <p className="text-[13px] text-[#b45309]" role="alert">{error}</p>}
    </div>
  )
}
