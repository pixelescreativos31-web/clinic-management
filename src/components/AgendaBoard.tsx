'use client'

// Agenda (design_handoff_medira «Agenda»): day strip, Lista / Línea de tiempo
// toggle, «Nueva cita» and «Sin cita», and appointment cards that offer only the
// actions valid for their state:
//   Programada → Registrar llegada · WhatsApp · No asistió (· Cancelar)
//   En sala / Sin cita → Atender ahora (clinical roles)
//   Atendida → Cobrar consulta / Ver cobro · Imprimir receta
// The timeline shows free slots («Libre · agendar») that open the quick-booking
// sheet at that time.

import { useRegional } from './RegionalProvider'
import { compactClock } from '@/lib/regional'
import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateAppointmentStatus } from '@/app/(frontend)/dashboard/appointments/actions'
import { createInvoiceFromVisit } from '@/app/(frontend)/dashboard/invoices/actions'
import { apptStatusStyle } from '@/lib/apptStatus'
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
/** Clock in the clinic's format, compact ("2:30" / "14:30"). */
function Clock({ m }: { m: number }) {
  const { timeFormat } = useRegional()
  return <>{compactClock(m, timeFormat)}</>
}

/** Appointment status chip (12/600, radius 6). Programada carries a grey border. */
export function ApptChip({ status, isWalkIn, token, className = '' }: { status: AppointmentStatus; isWalkIn?: boolean; token?: string | null; className?: string }) {
  const st = apptStatusStyle(status, { isWalkIn, token })
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}
      style={{ background: st.bg, color: st.fg, borderColor: status === 'scheduled' ? '#d6d3d1' : st.bg }}
    >
      {st.label}
    </span>
  )
}

const BTN = 'inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-3.5 text-sm font-medium transition-colors disabled:opacity-60'
const PRIMARY = `${BTN} bg-[#0f766e] text-white hover:bg-[#115e59] hover:text-white`
const SECONDARY = `${BTN} border border-[#d6d3d1] bg-white text-[#1c1917] hover:border-[#1c1917] hover:text-[#1c1917]`

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
  const closed = a.status === 'cancelled' || a.status === 'no-show'

  const setStatus = (status: AppointmentStatus, msg: string, cancellationReason?: string) =>
    start(async () => {
      const res = await updateAppointmentStatus(a.id, status, cancellationReason)
      if (!res.ok) return onDone(res.message)
      setCancelling(false)
      setReason('')
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

  const note = [showDoctor ? a.doctorName : null, a.reason || null, a.online ? 'En línea' : null].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#e7e5e4] bg-white px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <span className={`tabular w-[52px] flex-none text-[17px] font-medium tracking-[-.02em] ${closed ? 'text-[#57534e]' : ''}`}><Clock m={a.startMin} /></span>
        <div className="min-w-0 flex-[1_1_200px]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <Link
              href={`/dashboard/patients/${a.patientId}`}
              className={`min-w-0 truncate font-semibold text-[#1c1917] hover:text-[#0f766e] ${a.status === 'cancelled' ? 'line-through' : ''}`}
            >
              {a.patientName}
            </Link>
            <ApptChip status={a.status} isWalkIn={a.isWalkIn} token={a.token} />
          </div>
          {note && <div className="truncate text-[13px] text-[#57534e]">{note}</div>}
        </div>

        {a.status === 'scheduled' && !cancelling && (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={pending} onClick={() => setStatus('checked-in', `${a.patientName} en sala de espera`)} className={PRIMARY}>
              Registrar llegada
            </button>
            {a.waHref && (
              <a href={a.waHref} target="_blank" rel="noreferrer" className={SECONDARY}>
                WhatsApp
              </a>
            )}
            <button type="button" disabled={pending} onClick={() => setStatus('no-show', `${a.patientName}: no asistió`)} className={SECONDARY}>
              No asistió
            </button>
            <button type="button" onClick={() => setCancelling(true)} className={`${BTN} px-2 text-[#57534e] underline underline-offset-2 hover:text-[#1c1917]`}>
              Cancelar
            </button>
          </div>
        )}
        {a.status === 'checked-in' && clinical && (
          <Link href={`/dashboard/visits/new?appointment=${a.id}`} className={PRIMARY}>
            Atender ahora
          </Link>
        )}
        {a.status === 'completed' && a.visitId && (
          <div className="flex flex-wrap gap-1.5">
            {a.invoiceId ? (
              <Link href={`/dashboard/invoices/${a.invoiceId}`} className={SECONDARY}>
                Ver cobro
              </Link>
            ) : (
              <button type="button" disabled={pending} onClick={bill} className={PRIMARY}>
                Cobrar consulta
              </button>
            )}
            <a href={`/print/prescription/${a.visitId}`} target="_blank" rel="noreferrer" className={SECONDARY}>
              Imprimir receta
            </a>
          </div>
        )}
      </div>

      {cancelling && (
        <div className="flex flex-col gap-2 rounded-[10px] bg-[#f0eeec] p-3">
          <label className="flex flex-col gap-1 text-[13px] font-medium text-[#44403c]">
            Motivo de la cancelación
            <input
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Obligatorio"
              className="h-11 rounded-[10px] border border-[#d6d3d1] bg-white px-3 text-base font-normal text-[#1c1917] outline-none focus:border-[#0f766e]"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !reason.trim()}
              onClick={() => setStatus('cancelled', 'Cita cancelada', reason.trim())}
              className={`${BTN} h-11 bg-[#1c1917] text-white hover:text-white disabled:opacity-50`}
            >
              Confirmar cancelación
            </button>
            <button type="button" onClick={() => setCancelling(false)} className={`${SECONDARY} h-11`}>
              Volver
            </button>
          </div>
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
  initialToast,
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
  /** One-off message after returning from another screen (e.g. «Consulta guardada»). */
  initialToast?: string
}) {
  const [view, setView] = useState<'list' | 'timeline'>('list')
  const [doctorFilter, setDoctorFilter] = useState<string>(doctors.length > 1 ? 'all' : defaultDoctorId)
  const [sheet, setSheet] = useState<{ mode: QuickMode; time?: string } | null>(null)
  const { toast, say } = useToast()
  const router = useRouter()
  useEffect(() => {
    if (!initialToast) return
    say(initialToast)
    // Drop ?ok= so a refresh doesn't repeat the message.
    const url = new URL(window.location.href)
    url.searchParams.delete('ok')
    router.replace(url.pathname + url.search, { scroll: false })
  }, [initialToast, say, router])

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-1 flex min-w-0 max-w-full gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
          {days.map((d) => (
            <Link
              key={d.date}
              href={d.href}
              aria-current={d.active ? 'date' : undefined}
              className={`flex h-[58px] w-[54px] flex-none flex-col items-center justify-center rounded-[10px] border leading-tight transition-colors ${
                d.active ? 'border-[#1c1917] bg-[#1c1917] text-white hover:text-white' : 'border-[#e7e5e4] bg-white text-[#1c1917] hover:border-[#d6d3d1] hover:text-[#1c1917]'
              }`}
            >
              <span className="text-xs">{d.dow}</span>
              <span className="tabular text-[17px] font-semibold">{d.num}</span>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex gap-0.5 rounded-[10px] bg-[#f0eeec] p-[3px]" role="group" aria-label="Vista">
            {(['list', 'timeline'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`h-[34px] rounded-lg px-3 text-sm font-medium ${view === v ? 'bg-white text-[#1c1917]' : 'text-[#57534e] hover:text-[#1c1917]'}`}
              >
                {v === 'list' ? 'Lista' : 'Línea de tiempo'}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setSheet({ mode: 'appt' })} className={PRIMARY}>
            Nueva cita
          </button>
          <button type="button" onClick={() => setSheet({ mode: 'walkin' })} className={SECONDARY}>
            Sin cita
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {doctors.length > 1 && (
          <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
            {[{ id: 'all', name: 'Todos' }, ...doctors].map((d) => {
              if (view === 'timeline' && d.id === 'all') return null
              const on = doctorFilter === d.id || (view === 'timeline' && doctorFilter === 'all' && d.id === tlDoctor?.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDoctorFilter(d.id)}
                  className={`h-10 flex-none rounded-[10px] border px-3.5 text-sm font-medium ${
                    on ? 'border-[#1c1917] bg-[#1c1917] text-white' : 'border-[#d6d3d1] bg-white text-[#1c1917] hover:border-[#1c1917]'
                  }`}
                >
                  {d.name}
                </button>
              )
            })}
          </div>
        )}
        <span className="tabular ml-auto text-[13px] text-[#57534e]">
          {shown.length} {shown.length === 1 ? 'cita' : 'citas'}
          {waiting ? ` · ${waiting} en sala` : ''}
        </span>
      </div>

      {view === 'list' ? (
        shown.length === 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border border-[#e7e5e4] bg-white px-4 py-8 text-sm text-[#57534e]">
            No hay citas este día.
            <button type="button" onClick={() => setSheet({ mode: 'appt' })} className="font-medium text-[#0f766e] hover:text-[#115e59]">
              Agendar una
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {shown.map((a) => (
              <ApptCard key={a.id} a={a} clinical={clinical} showDoctor={doctors.length > 1 && doctorFilter === 'all'} onDone={say} />
            ))}
          </div>
        )
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e7e5e4] bg-white">
          {tlDoctor?.fromMin === null && (
            <div className="border-b border-[#f0eeec] px-4 py-2.5 text-[13px] text-[#57534e]">{tlDoctor.name} no consulta este día según su horario.</div>
          )}
          {[...extra.map((a) => ({ m: a.startMin, items: [a], covered: false })), ...rows].map((r) => {
            const now = nowMin !== null && nowMin >= r.m && nowMin < r.m + durationMins
            const past = isToday && nowMin !== null && r.m + durationMins <= nowMin
            return (
              <div
                key={`${r.m}-${r.items[0]?.id ?? ''}`}
                className={`grid min-h-[52px] grid-cols-[56px_minmax(0,1fr)] border-t border-[#f0eeec] first:border-t-0 ${past && !r.items.length ? 'bg-[#fafaf7]' : 'bg-white'}`}
              >
                <div className={`tabular relative pt-2.5 pl-4 text-[13px] ${now ? 'font-semibold text-[#0f766e]' : 'text-[#57534e]'}`}>
                  <Clock m={r.m} />
                  {now && <span className="sr-only"> (ahora)</span>}
                </div>
                <div className="flex flex-col gap-1.5 py-1.5 pr-3">
                  {r.items.length > 0 ? (
                    r.items.map((a) => {
                      const st = apptStatusStyle(a.status, { isWalkIn: a.isWalkIn, token: a.token })
                      return (
                        <Link
                          key={a.id}
                          href={`/dashboard/patients/${a.patientId}`}
                          className="flex h-10 items-center justify-between gap-3 rounded-lg border px-3 text-sm"
                          style={{ background: st.bg, color: st.fg, borderColor: a.status === 'scheduled' ? '#d6d3d1' : st.bg }}
                        >
                          <span className="min-w-0 truncate font-medium">
                            <span className="tabular mr-2 opacity-80"><Clock m={a.startMin} /></span>
                            {a.patientName}
                          </span>
                          <span className="flex-none text-xs font-semibold">{st.label}</span>
                        </Link>
                      )
                    })
                  ) : r.covered || past ? null : (
                    <button
                      type="button"
                      onClick={() => setSheet({ mode: 'appt', time: hhmm(r.m) })}
                      className="h-10 w-full rounded-lg border border-dashed border-[#d6d3d1] px-3 text-left text-[13px] text-[#57534e] transition-colors hover:border-[#0f766e] hover:text-[#0f766e]"
                    >
                      Libre · agendar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
