'use client'

// Interactive parts of the Panel (design_handoff_medira «Panel»): the deep
// «Siguiente paciente» card with one main action that follows the state
// (Registrar llegada → Atender ahora), and the quick actions as text buttons.

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateAppointmentStatus } from '@/app/(frontend)/dashboard/appointments/actions'
import { apptStatusStyle } from '@/lib/apptStatus'
import { QuickBookSheet, type QuickMode } from './QuickBookSheet'
import { Spinner } from './primitives'
import { Toast, useToast } from './Toast'

export type NextPatient = {
  apptId: string
  patientId: string
  name: string
  /** "9:30" in the clinic's time zone. */
  time: string
  /** Reason for the visit (may be empty). */
  note: string
  status: 'scheduled' | 'checked-in'
  isWalkIn: boolean
  token: string | null
  /** Only filled for clinical roles. */
  allergies: string | null
}

const MAIN = 'inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-white px-[18px] text-[15px] font-semibold text-[#042f2e] hover:bg-[#f0eeec] hover:text-[#042f2e] disabled:opacity-60'
const SECOND = 'inline-flex h-11 items-center justify-center rounded-[10px] border border-[#2b6b65] px-[18px] text-[15px] font-medium text-white hover:border-[#b6d4cf] hover:text-white'

export function NextPatientCard({ next, clinical }: { next: NextPatient | null; clinical: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const { toast, say } = useToast()

  if (!next) {
    return (
      <section className="rounded-xl bg-[#042f2e] px-5 py-[18px] text-white">
        <div className="text-xs text-[#b6d4cf]">Siguiente paciente</div>
        <div className="text-[22px] font-semibold tracking-[-.03em]">No hay pacientes pendientes hoy</div>
        <div className="text-sm text-[#b6d4cf]">Las nuevas citas y los pacientes sin cita aparecerán aquí.</div>
      </section>
    )
  }

  const checkIn = () =>
    start(async () => {
      const res = await updateAppointmentStatus(next.apptId, 'checked-in')
      if (!res.ok) return say(res.message)
      say(`${next.name} en sala`)
      router.refresh()
    })

  const st = apptStatusStyle(next.status, { isWalkIn: next.isWalkIn, token: next.token })
  const primary =
    next.status === 'scheduled' ? (
      <button type="button" disabled={pending} onClick={checkIn} className={MAIN}>
        {pending && <Spinner />}
        Registrar llegada
      </button>
    ) : clinical ? (
      <Link href={`/dashboard/visits/new?appointment=${next.apptId}`} className={MAIN}>
        Atender ahora
      </Link>
    ) : (
      <Link href="/dashboard/appointments" className={MAIN}>
        Ver agenda
      </Link>
    )

  return (
    <section className="rounded-xl bg-[#042f2e] px-5 py-[18px] text-white">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="tabular text-xs text-[#b6d4cf]">
            Siguiente paciente · {next.time} · {st.label}
          </div>
          <div className="truncate text-[22px] font-semibold tracking-[-.03em]">{next.name}</div>
          {next.note && <div className="truncate text-sm text-[#b6d4cf]">{next.note}</div>}
        </div>
        {next.allergies && (
          <span className="max-w-full rounded-md bg-[#b91c1c] px-2.5 py-1 text-xs font-semibold text-white">Alergia: {next.allergies}</span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {primary}
        <Link href={`/dashboard/patients/${next.patientId}`} className={SECOND}>
          Expediente
        </Link>
      </div>
      <Toast message={toast} />
    </section>
  )
}

export function QuickActions({
  doctors,
  defaultDoctorId,
  today,
  nowHHMM,
}: {
  doctors: { id: string; name: string }[]
  defaultDoctorId: string
  today: string
  nowHHMM: string
}) {
  const [sheet, setSheet] = useState<QuickMode | null>(null)
  const { toast, say } = useToast()
  const btn =
    'flex min-h-12 items-center rounded-[10px] border border-[#d6d3d1] bg-white px-3 py-2 text-start text-sm font-medium text-[#1c1917] transition-colors hover:border-[#1c1917] hover:text-[#1c1917] disabled:cursor-not-allowed disabled:text-[#a8a29e] disabled:hover:border-[#d6d3d1]'
  const canBook = doctors.length > 0
  return (
    <section className="rounded-xl border border-[#e7e5e4] bg-white px-4 py-3.5">
      <h3 className="text-[15px] font-semibold">Acciones</h3>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button type="button" disabled={!canBook} onClick={() => setSheet('appt')} className={btn}>
          Nueva cita
        </button>
        <button type="button" disabled={!canBook} onClick={() => setSheet('walkin')} className={btn}>
          Paciente sin cita
        </button>
        <Link href="/dashboard/patients/new" className={btn}>
          Nuevo paciente
        </Link>
        <Link href="/dashboard/invoices" className={btn}>
          Cobrar
        </Link>
      </div>
      {sheet && (
        <QuickBookSheet
          mode={sheet}
          doctors={doctors}
          defaultDoctorId={defaultDoctorId}
          date={today}
          dateLabel="hoy"
          nowHHMM={nowHHMM}
          onClose={() => setSheet(null)}
          onDone={(m) => {
            setSheet(null)
            say(m)
          }}
        />
      )}
      <Toast message={toast} />
    </section>
  )
}
