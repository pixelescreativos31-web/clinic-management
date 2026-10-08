'use client'

// Redesigned Agenda (design handoff "Agenda"): day strip, Lista / Línea de tiempo
// toggle, and appointment cards that offer only the actions valid for their state:
//   Programada → Registrar llegada · WhatsApp · No asistió (· Cancelar)
//   En sala / Sin cita → Atender ahora (clinical roles)
//   Atendido → Cobrar consulta · Imprimir receta
// The timeline shows free slots ("Libre · tocar para agendar") that open the
// quick-booking sheet at that time.

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateAppointmentStatus } from '@/app/(frontend)/dashboard/appointments/actions'
import { createInvoiceFromVisit } from '@/app/(frontend)/dashboard/invoices/actions'
import { apptStatusStyle, avatarTint, initialsOf } from '@/lib/apptStatus'
import type { AppointmentStatus } from '@/lib/constants'
import { QuickBookSheet, type QuickMode } from './QuickBookSheet'
import { Toast, useToast } from './Toast'

export type AgendaAppt = {
  id: string
  hhmm: string
  timeLabel: string
  startMin: number
  durationMins: number
  patientId: string
  patientName: string
  reason: string
  status: AppointmentStatus
  isWalkIn: boolean
  token: string | null
  online: boolean
  doctorId: string
  doctorName: string
  waHref: string | null
  visitId: string | null
  invoiceId: string | null
}
export type AgendaDoctor = { id: string; name: string; fromMin: number | null; toMin: number | null }
export type AgendaDay = { date: string; dow: string; num: number; href: string; active: boolean }

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const label12 = (m: number) => {
  const h = Math.floor(m / 60)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, '0')}`
}

const BTN = 'flex min-h-11 items-center justify-center rounded-[10px] px-3.5 py-[11px] text-[13px] font-semibold'

function ApptCard({
  a,
  clinical,
  showDoctor,
  onDone,
}: {
  a: AgendaAppt
  clinical: boolean
  showDoctor: boolean
  onDone: (msg: string) => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const st = apptStatusStyle(a.status, { isWalkIn: a.isWalkIn, token: a.token })
  const tint = avatarTint(a.patientName)
  const closed = a.status === 'cancelled' || a.status === 'no-show'

  const setStatus = (status: AppointmentStatus, msg: string, cancellationReason?: string) =>
    start(async () => {
      const res = await updateAppointmentStatus(a.id, status, cancellationReason)
      if (!res.ok) return onDone(res.message)
      onDone(msg)
      router.refresh()
    })

  const bill = () =>
    start(async () => {
      if (!a.visitId) return
      const res = await createInvoiceFromVisit(a.visitId)
      if (!res.ok) return onDone(res.message)
      router.push(`/dashboard/invoices/${res.data.id}`)
    })

  return (
    <div
      className={`flex flex-col gap-2.5 rounded-[14px] border border-[#e3e7e7] bg-white px-3.5 py-3 ${closed ? 'opacity-70' : ''}`}
      style={{ borderLeft: `4px solid ${st.fg}` }}
    >
      <div className="flex items-center gap-3">
        <span className="tabular w-12 shrink-0 text-[15px] font-bold">{label12(a.startMin)}</span>
        <Link href={`/dashboard/patients/${a.patientId}`} className="flex min-w-0 flex-1 items-center gap-2.5 text-[#15201e] hover:text-[#15201e]">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
            style={{ background: tint.bg, color: tint.fg }}
          >
            {initialsOf(a.patientName)}
          </span>
          <span className="min-w-0">
            <span className={`block truncate text-[15px] font-semibold ${a.status === 'cancelled' ? 'line-through' : ''}`}>{a.patientName}</span>
            <span className="block truncate text-xs text-[#6b7577]">
              {[showDoctor ? a.doctorName : null, a.reason || null, a.online ? 'En línea' : null].filter(Boolean).join(' · ') || ' '}
            </span>
          </span>
        </Link>
        <span className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold whitespace-nowrap" style={{ background: st.bg, color: st.fg }}>
          {st.label}
        </span>
      </div>

      {a.status === 'scheduled' && !cancelling && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => setStatus('checked-in', `${a.patientName} en sala de espera`)} className={`${BTN} flex-1 bg-[#0d6e60] text-white`}>
            Registrar llegada
          </button>
          {a.waHref && (
            <a href={a.waHref} target="_blank" rel="noreferrer" className={`${BTN} border border-[#e3e7e7] bg-white text-[#1a7a50] hover:text-[#1a7a50]`}>
              WhatsApp
            </a>
          )}
          <button type="button" disabled={pending} onClick={() => setStatus('no-show', `${a.patientName}: no asistió`)} className={`${BTN} border border-[#e3e7e7] bg-white font-medium text-[#6b7577]`}>
            No asistió
          </button>
          <button type="button" onClick={() => setCancelling(true)} className="px-1 text-xs font-medium text-[#6b7577] underline">
            Cancelar
          </button>
        </div>
      )}
      {cancelling && (
        <div className="flex flex-col gap-2 rounded-xl bg-[#f4f6f6] p-2.5">
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo de la cancelación (obligatorio)"
            className="h-11 rounded-[10px] border border-[#e3e7e7] bg-white px-3 text-base outline-none focus:border-[#0d6e60]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || !reason.trim()}
              onClick={() => setStatus('cancelled', 'Cita cancelada', reason.trim())}
              className={`${BTN} flex-1 bg-[#b3261e] text-white disabled:opacity-50`}
            >
              Confirmar cancelación
            </button>
            <button type="button" onClick={() => setCancelling(false)} className={`${BTN} border border-[#e3e7e7] bg-white font-medium`}>
              Volver
            </button>
          </div>
        </div>
      )}
      {a.status === 'checked-in' && clinical && (
        <Link href={`/dashboard/visits/new?appointment=${a.id}`} className={`${BTN} bg-[#2563ab] text-white hover:text-white`}>
          Atender ahora
        </Link>
      )}
      {a.status === 'completed' && a.visitId && (
        <div className="flex gap-2">
          {a.invoiceId ? (
            <Link href={`/dashboard/invoices/${a.invoiceId}`} className={`${BTN} flex-1 border border-[#0d6e60] text-[#0d6e60] hover:text-[#0d6e60]`}>
              Ver cobro
            </Link>
          ) : (
            <button type="button" disabled={pending} onClick={bill} className={`${BTN} flex-1 border border-[#0d6e60] text-[#0d6e60]`}>
              Cobrar consulta
            </button>
          )}
          <a href={`/print/prescription/${a.visitId}`} target="_blank" rel="noreferrer" className={`${BTN} border border-[#e3e7e7] bg-white font-medium text-[#15201e] hover:text-[#15201e]`}>
            Imprimir receta
          </a>
        </div>
      )}
    </div>
  )
}

export function AgendaBoard({
  days,
  date,
  today,
  dateLabel,
  isToday,
  nowMin,
  nowHHMM,
  durationMins,
  doctors,
  appts,
  clinical,
  defaultDoctorId,
}: {
  days: AgendaDay[]
  date: string
  /** Today (YYYY-MM-DD, clinic tz) — walk-ins always arrive today. */
  today: string
  dateLabel: string
  isToday: boolean
  nowMin: number | null
  nowHHMM: string
  durationMins: number
  doctors: AgendaDoctor[]
  appts: AgendaAppt[]
  clinical: boolean
  defaultDoctorId: string
}) {
  const [view, setView] = useState<'list' | 'timeline'>('list')
  const [doctorFilter, setDoctorFilter] = useState<string>(doctors.length > 1 ? 'all' : defaultDoctorId)
  const [sheet, setSheet] = useState<{ mode: QuickMode; time?: string } | null>(null)
  const { toast, say } = useToast()

  const shown = appts.filter((a) => doctorFilter === 'all' || a.doctorId === doctorFilter)
  const waiting = shown.filter((a) => a.status === 'checked-in').length
  const tlDoctor = doctors.find((d) => d.id === (doctorFilter === 'all' ? defaultDoctorId : doctorFilter)) ?? doctors[0]

  // Timeline rows: the doctor's window (or 8–18) on the clinic's grid.
  const from = tlDoctor?.fromMin ?? 8 * 60
  const to = tlDoctor?.toMin ?? 18 * 60
  // Every appointment starting inside a row is listed (walk-ins may share a slot).
  const rows: { m: number; items: AgendaAppt[]; covered: boolean }[] = []
  const tlAppts = appts.filter((a) => a.doctorId === tlDoctor?.id && a.status !== 'cancelled')
  for (let m = from; m < to; m += durationMins) {
    const items = tlAppts.filter((a) => a.startMin >= m && a.startMin < m + durationMins)
    const covered = items.length === 0 && tlAppts.some((a) => a.startMin < m && a.startMin + a.durationMins > m)
    rows.push({ m, items, covered })
  }
  const extra = tlAppts.filter((a) => a.startMin < from || a.startMin >= to)

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
        {days.map((d) => (
          <Link
            key={d.date}
            href={d.href}
            aria-current={d.active ? 'date' : undefined}
            className={`w-[52px] flex-none rounded-xl border py-2 text-center ${
              d.active ? 'border-[#15201e] bg-[#15201e] text-white hover:text-white' : 'border-[#e3e7e7] bg-white text-[#15201e] hover:text-[#15201e]'
            }`}
          >
            <span className="block text-[10px] tracking-[.06em] uppercase opacity-80">{d.dow}</span>
            <span className="tabular mt-0.5 block text-[17px] font-semibold">{d.num}</span>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-[10px] border border-[#e3e7e7] bg-white p-[3px]">
          {(['list', 'timeline'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold ${view === v ? 'bg-[#15201e] text-white' : 'text-[#6b7577]'}`}
            >
              {v === 'list' ? 'Lista' : 'Línea de tiempo'}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <span className="text-xs text-[#6b7577]">
          {shown.length} {shown.length === 1 ? 'cita' : 'citas'}
          {waiting ? ` · ${waiting} en sala` : ''}
        </span>
        <button type="button" onClick={() => setSheet({ mode: 'walkin' })} className="hidden rounded-[10px] border border-[#e3e7e7] bg-white px-3.5 py-2 text-[13px] font-semibold md:block">
          Paciente sin cita
        </button>
        <button type="button" onClick={() => setSheet({ mode: 'appt' })} className="hidden rounded-[10px] bg-[#0d6e60] px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(13,110,96,.6)] md:block">
          + Nueva cita
        </button>
      </div>

      {doctors.length > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
          {[{ id: 'all', name: 'Todos' }, ...doctors].map((d) =>
            view === 'timeline' && d.id === 'all' ? null : (
              <button
                key={d.id}
                type="button"
                aria-pressed={doctorFilter === d.id || (view === 'timeline' && doctorFilter === 'all' && d.id === tlDoctor?.id)}
                onClick={() => setDoctorFilter(d.id)}
                className={`flex-none rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  doctorFilter === d.id || (view === 'timeline' && doctorFilter === 'all' && d.id === tlDoctor?.id)
                    ? 'border-[#0d6e60] bg-[#e6f1ee] text-[#0d6e60]'
                    : 'border-[#e3e7e7] bg-white text-[#6b7577]'
                }`}
              >
                {d.name}
              </button>
            ),
          )}
        </div>
      )}

      {view === 'list' ? (
        shown.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[#cfd6d6] bg-white px-4 py-8 text-center text-sm text-[#6b7577]">
            No hay citas este día.{' '}
            <button type="button" onClick={() => setSheet({ mode: 'appt' })} className="font-semibold text-[#0d6e60]">
              Agendar una
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-28 md:pb-0">
            {shown.map((a) => (
              <ApptCard key={a.id} a={a} clinical={clinical} showDoctor={doctors.length > 1 && doctorFilter === 'all'} onDone={say} />
            ))}
          </div>
        )
      ) : (
        <div className="mb-28 overflow-hidden rounded-[14px] border border-[#e3e7e7] bg-white md:mb-0">
          {tlDoctor?.fromMin === null && (
            <div className="border-b border-[#eef1f1] px-3 py-2 text-xs text-[#6b7577]">{tlDoctor.name} no consulta este día según su horario.</div>
          )}
          {[...extra.map((a) => ({ m: a.startMin, items: [a], covered: false })), ...rows].map((r) => {
            const now = nowMin !== null && nowMin >= r.m && nowMin < r.m + durationMins
            const past = isToday && nowMin !== null && r.m + durationMins <= nowMin
            return (
              <div key={`${r.m}-${r.items[0]?.id ?? ''}`} className={`grid min-h-[52px] grid-cols-[56px_1fr] border-b border-[#eef1f1] last:border-0 ${past && !r.items.length ? 'bg-[#f4f6f6]' : 'bg-white'}`}>
                <div className="tabular relative border-r border-[#eef1f1] pt-2.5 pl-3 text-xs text-[#6b7577]">
                  {label12(r.m)}
                  {now && <span aria-label="Ahora" className="absolute top-3.5 -right-[5px] size-[9px] rounded-full bg-[#b3261e]" />}
                </div>
                {r.items.length > 0 ? (
                  <div className="flex flex-col">
                    {r.items.map((a) => {
                      const st = apptStatusStyle(a.status, { isWalkIn: a.isWalkIn, token: a.token })
                      return (
                        <Link
                          key={a.id}
                          href={`/dashboard/patients/${a.patientId}`}
                          className="mx-2.5 my-1.5 flex min-h-10 items-center gap-2 rounded-lg px-2.5 py-2 text-[#15201e] hover:text-[#15201e]"
                          style={{ background: st.bg, borderLeft: `3px solid ${st.fg}` }}
                        >
                          <span className="tabular shrink-0 text-[11px] text-[#6b7577]">{label12(a.startMin)}</span>
                          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{a.patientName}</span>
                          <span className="text-[11px] font-semibold" style={{ color: st.fg }}>
                            {st.label}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                ) : r.covered ? (
                  <span />
                ) : past ? (
                  <span />
                ) : (
                  <button
                    type="button"
                    onClick={() => setSheet({ mode: 'appt', time: hhmm(r.m) })}
                    className="mx-2.5 my-1.5 flex min-h-10 items-center justify-center rounded-lg border border-dashed border-[#cfd6d6] text-xs text-[#6b7577] hover:border-[#0d6e60] hover:text-[#0d6e60]"
                  >
                    Libre · tocar para agendar
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Floating actions (phones) — desktop has them in the header */}
      <div className="fixed right-4 bottom-[92px] z-20 flex flex-col items-end gap-2 md:hidden">
        <button type="button" onClick={() => setSheet({ mode: 'walkin' })} className="rounded-full border border-[#e3e7e7] bg-white px-4 py-2.5 text-[13px] font-semibold shadow-[0_8px_20px_-10px_rgba(0,0,0,.35)]">
          Sin cita
        </button>
        <button type="button" onClick={() => setSheet({ mode: 'appt' })} className="rounded-full bg-[#0d6e60] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(13,110,96,.6)]">
          + Nueva cita
        </button>
      </div>

      {sheet && (
        <QuickBookSheet
          mode={sheet.mode}
          doctors={doctors.map(({ id, name }) => ({ id, name }))}
          defaultDoctorId={tlDoctor?.id ?? defaultDoctorId}
          date={sheet.mode === 'walkin' ? today : date}
          dateLabel={sheet.mode === 'walkin' ? 'hoy' : dateLabel}
          presetTime={sheet.time}
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
