'use client'

// Interactive parts of the redesigned Inicio (design handoff "Inicio"): the teal
// «Siguiente paciente» card with one primary action that follows the state
// (Registrar llegada → Atender ahora), and the four quick actions.

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateAppointmentStatus } from '@/app/(frontend)/dashboard/appointments/actions'
import { initialsOf } from '@/lib/apptStatus'
import { IconCalendarAdd, IconMoney, IconUserPlus, IconWalkIn } from './icons'
import { QuickBookSheet, type QuickMode } from './QuickBookSheet'
import { Toast, useToast } from './Toast'

export type NextPatient = {
  apptId: string
  patientId: string
  name: string
  line: string
  status: 'scheduled' | 'checked-in'
  badge: string
}

export function NextPatientCard({ next, clinical }: { next: NextPatient | null; clinical: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const { toast, say } = useToast()

  if (!next) {
    return (
      <div className="col-span-full flex flex-col gap-2 rounded-2xl bg-[#0d6e60] p-[18px] text-white">
        <span className="text-[11px] font-semibold tracking-[.12em] text-[#9fe3d4] uppercase">Siguiente paciente</span>
        <span className="font-display text-xl font-semibold tracking-[-.01em]">No hay pacientes pendientes hoy</span>
        <span className="text-[13px] text-[#cfe8e1]">Las nuevas citas y los pacientes sin cita aparecerán aquí.</span>
      </div>
    )
  }

  const checkIn = () =>
    start(async () => {
      const res = await updateAppointmentStatus(next.apptId, 'checked-in')
      if (!res.ok) return say(res.message)
      say(`${next.name} en sala`)
      router.refresh()
    })

  const primary =
    next.status === 'scheduled' ? (
      <button type="button" disabled={pending} onClick={checkIn} className="min-h-[46px] flex-1 rounded-[10px] bg-white p-[13px] text-center text-sm font-semibold text-[#0d6e60]">
        Registrar llegada
      </button>
    ) : clinical ? (
      <Link href={`/dashboard/visits/new?appointment=${next.apptId}`} className="min-h-[46px] flex-1 rounded-[10px] bg-white p-[13px] text-center text-sm font-semibold text-[#0d6e60] hover:text-[#0d6e60]">
        Atender ahora
      </Link>
    ) : (
      <Link href="/dashboard/appointments" className="min-h-[46px] flex-1 rounded-[10px] bg-white p-[13px] text-center text-sm font-semibold text-[#0d6e60] hover:text-[#0d6e60]">
        Ver agenda
      </Link>
    )

  return (
    <div className="col-span-full flex flex-col gap-3.5 rounded-2xl bg-[#0d6e60] p-[18px] text-white">
      <div className="flex items-center justify-between gap-2.5">
        <span className="text-[11px] font-semibold tracking-[.12em] text-[#9fe3d4] uppercase">Siguiente paciente</span>
        <span className="rounded-full bg-white/15 px-2.5 py-[3px] text-xs">{next.badge}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/18 text-[13px] font-semibold">{initialsOf(next.name)}</span>
        <span className="min-w-0">
          <span className="block truncate font-display text-xl font-semibold tracking-[-.01em]">{next.name}</span>
          <span className="block truncate text-[13px] text-[#cfe8e1]">{next.line}</span>
        </span>
      </div>
      <div className="flex gap-2">
        {primary}
        <Link href={`/dashboard/patients/${next.patientId}`} className="min-h-[46px] rounded-[10px] border border-white/30 px-4 py-[13px] text-sm font-medium text-white hover:text-white">
          Expediente
        </Link>
      </div>
      <Toast message={toast} />
    </div>
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
  const tile = 'flex min-h-[76px] flex-col justify-between gap-2 rounded-[14px] border border-[#e3e7e7] bg-white p-4 text-start text-[#15201e] hover:border-[#0d6e60] hover:text-[#15201e]'
  const icon = 'flex size-7 items-center justify-center rounded-lg'
  const canBook = doctors.length > 0
  return (
    <div className="grid grid-cols-2 content-start gap-2.5">
      <button type="button" disabled={!canBook} onClick={() => setSheet('appt')} className={tile}>
        <span className={`${icon} bg-[#e6f1ee] text-[#0d6e60]`}>
          <IconCalendarAdd size={18} />
        </span>
        <span className="text-sm font-semibold">Nueva cita</span>
      </button>
      <button type="button" disabled={!canBook} onClick={() => setSheet('walkin')} className={tile}>
        <span className={`${icon} bg-[#e9f0f9] text-[#2563ab]`}>
          <IconWalkIn size={18} />
        </span>
        <span className="text-sm font-semibold">Paciente sin cita</span>
      </button>
      <Link href="/dashboard/patients/new" className={tile}>
        <span className={`${icon} bg-[#f1f3f3] text-[#15201e]`}>
          <IconUserPlus size={18} />
        </span>
        <span className="text-sm font-semibold">Nuevo paciente</span>
      </Link>
      <Link href="/dashboard/invoices" className={tile}>
        <span className={`${icon} bg-[#faf3e6] text-[#b45309]`}>
          <IconMoney size={18} />
        </span>
        <span className="text-sm font-semibold">Cobrar</span>
      </Link>
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
    </div>
  )
}
