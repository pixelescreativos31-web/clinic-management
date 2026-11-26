import { compactClock, regionalOf, type TimeFormat } from '@/lib/regional'
// Panel — design_handoff_medira «Panel»: greeting, four figures, the deep
// «Siguiente paciente» card with one main action, today's agenda, quick actions
// as text buttons, pending items (balances for the owner, online requests) and
// the welcome checklist for fresh clinics. Money charts live in Informes.

import Link from 'next/link'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { getRevenueData, startOfDayInTz } from '@/lib/reports'
import { formatMoney } from '@/lib/format'
import { minutesInTz } from '@/lib/availability'
import { DEFAULT_TIMEZONE, type AppointmentStatus } from '@/lib/constants'
import { APP_NAME } from '@/lib/brand'
import { canStartVisits, isPractitioner, practitionerWhere } from '@/lib/practice'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { ApptChip } from '@/components/AgendaBoard'
import { NextPatientCard, QuickActions, type NextPatient } from '@/components/HomeBoard'
import type { Appointment, Patient, User } from '@/payload-types'

function greetingFor(tz: string): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date()))
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

const time12 = (iso: string, tz: string, fmt?: TimeFormat) => compactClock(minutesInTz(new Date(iso), tz), fmt)

const CARD = 'overflow-hidden rounded-xl border border-[#e7e5e4] bg-white'
const ROW = 'border-t border-[#f0eeec] px-4 py-2.5 text-sm text-[#1c1917] hover:bg-[#fafaf7] hover:text-[#1c1917]'

export default async function DashboardHome({ searchParams }: { searchParams?: Promise<{ welcome?: string }> }) {
  const { user, tenant } = await requireDashboardSession()
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const tz = tenant?.settings?.timezone || DEFAULT_TIMEZONE
  const params = (await searchParams) ?? {}

  const todayStart = startOfDayInTz(tz, 0)
  const tomorrowStart = startOfDayInTz(tz, 1)
  const [doctorsRes, todayRes, patientsCount, apptsCount, requestsCount] = await Promise.all([
    payload.find({
      collection: 'users',
      where: { and: [practitionerWhere(String(tenantID)), { active: { equals: true } }] },
      limit: 50,
      sort: 'name',
      overrideAccess: true,
    }),
    payload.find({
      collection: 'appointments',
      where: { tenant: { equals: tenantID }, start: { greater_than_equal: todayStart.toISOString(), less_than: tomorrowStart.toISOString() } },
      sort: 'start',
      limit: 300,
      depth: 1,
      overrideAccess: true,
    }),
    payload.count({ collection: 'patients', where: { tenant: { equals: tenantID } }, overrideAccess: true }),
    payload.count({ collection: 'appointments', where: { tenant: { equals: tenantID } }, overrideAccess: true }),
    // Read with the user's own access (same as the Agenda's request list).
    payload
      .count({ collection: 'bookingRequests', where: { tenant: { equals: tenantID }, status: { equals: 'pending' } }, overrideAccess: false, user })
      .then((r) => r.totalDocs)
      .catch(() => 0),
  ])
  const doctors = (doctorsRes.docs as User[]).map((d) => ({ id: String(d.id), name: d.name }))

  // In a multi-doctor clinic a practitioner follows their own patients.
  const mine = isPractitioner(user) && doctors.length > 1
  const today = (todayRes.docs as Appointment[]).filter(
    (a) => a.status !== 'cancelled' && (!mine || String((a.doctor as User)?.id ?? a.doctor) === String(user.id)),
  )
  const waitingList = today.filter((a) => a.status === 'checked-in')
  const nowMs = Date.now()
  const scheduled = today.filter((a) => a.status === 'scheduled')
  const nextAppt =
    waitingList[0] ?? scheduled.find((a) => new Date(a.end ?? a.start).getTime() >= nowMs) ?? scheduled[0] ?? null
  const clinical = canStartVisits(user)
  const nextPatient = nextAppt ? (nextAppt.patient as Patient) : null
  const next: NextPatient | null = nextAppt
    ? {
        apptId: String(nextAppt.id),
        patientId: String(nextPatient?.id ?? nextAppt.patient),
        name: nextPatient?.name ?? 'Paciente',
        time: time12(nextAppt.start, tz, regionalOf(tenant).timeFormat),
        note: nextAppt.reason ?? '',
        status: nextAppt.status as 'scheduled' | 'checked-in',
        isWalkIn: Boolean(nextAppt.isWalkIn),
        token: (nextAppt as { tokenNumber?: string | null }).tokenNumber ?? null,
        // Allergies are clinical data: only for people who see patients.
        allergies: clinical ? nextPatient?.allergies?.trim() || null : null,
      }
    : null

  const kpiDone = today.filter((a) => a.status === 'completed').length

  // Pending balances are money figures: owner only.
  const revenue = user.role === 'owner' ? await getRevenueData(payload, tenantID, tenant) : null

  // Welcome checklist for fresh self-serve clinics (derived from counts only).
  const showWelcome = params.welcome === '1' || (tenant?.onboardingSource === 'self-serve' && patientsCount.totalDocs <= 3)
  const checklist = [
    { done: doctors.length > 0, title: 'Agregue a sus médicos', href: '/dashboard/staff', ownerOnly: true },
    { done: patientsCount.totalDocs > 0, title: 'Registre un paciente', href: '/dashboard/patients/new', ownerOnly: false },
    { done: apptsCount.totalDocs > 0, title: 'Agende una cita', href: '/dashboard/appointments', ownerOnly: false },
  ].filter((s) => !s.ownerOnly || user.role === 'owner')
  const welcomePct = checklist.length ? Math.round((checklist.filter((s) => s.done).length / checklist.length) * 100) : 0

  const parts = (user.name ?? '').trim().split(/\s+/).filter(Boolean)
  const firstName = /^dra?\.?$/i.test(parts[0] ?? '') ? parts[1] ?? '' : parts[0] ?? ''
  const dateLine = new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz })
  const nowMin = minutesInTz(new Date(), tz)
  const nowHHMM = `${String(Math.floor(nowMin / 60)).padStart(2, '0')}:${String(nowMin % 60).padStart(2, '0')}`
  const todayStr = todayStart.toLocaleDateString('en-CA', { timeZone: tz })
  const defaultDoctorId = doctors.find((d) => d.id === String(user.id))?.id ?? doctors[0]?.id ?? ''

  const kpis = [
    { label: 'Citas hoy', value: String(today.length) },
    { label: 'En sala', value: String(waitingList.length) },
    { label: 'Atendidas', value: String(kpiDone) },
    revenue
      ? { label: 'Saldo pendiente', value: formatMoney(revenue.outstandingTotal, tenant) }
      : { label: 'Por llegar', value: String(scheduled.length) },
  ]
  const agenda = today.slice(0, 8)

  return (
    <>
      <AppHeader title="Panel" />
      <AppContent>
        <h2 className="text-[22px] font-semibold tracking-[-.03em]">
          {greetingFor(tz)}
          {firstName ? `, ${firstName}` : ''}
        </h2>
        <p className="text-sm text-[#57534e]">{dateLine.charAt(0).toUpperCase() + dateLine.slice(1)}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="min-w-0 rounded-xl border border-[#e7e5e4] bg-white px-4 py-3.5">
              <div className="text-xs text-[#57534e]">{k.label}</div>
              <div className="tabular mt-0.5 truncate text-2xl font-medium tracking-[-.03em]">{k.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-start gap-3">
          {/* Main column */}
          <div className="flex min-w-0 flex-[1.4_1_360px] flex-col gap-3">
            <NextPatientCard next={next} clinical={clinical} />

            <section className={CARD}>
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <h3 className="text-[15px] font-semibold">Agenda de hoy</h3>
                <Link href="/dashboard/appointments" className="text-sm font-medium text-[#0f766e] hover:text-[#115e59]">
                  Ver agenda
                </Link>
              </div>
              {agenda.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f0eeec] px-4 py-4 text-sm text-[#57534e]">
                  No hay citas hoy.
                  <Link href="/dashboard/appointments" className="font-medium text-[#0f766e]">
                    Abrir la agenda
                  </Link>
                </div>
              ) : (
                agenda.map((a) => {
                  const p = a.patient as Patient
                  return (
                    <Link key={a.id} href={`/dashboard/patients/${p?.id ?? a.patient}`} className={`grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2.5 ${ROW}`}>
                      <span className="tabular text-[#57534e]">{time12(a.start, tz, regionalOf(tenant).timeFormat)}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p?.name ?? 'Paciente'}</span>
                        <span className="block truncate text-[13px] text-[#57534e]">{a.reason || (a.source === 'online' ? 'Reserva en línea' : ' ')}</span>
                      </span>
                      <ApptChip status={a.status as AppointmentStatus} isWalkIn={Boolean(a.isWalkIn)} token={(a as { tokenNumber?: string | null }).tokenNumber} />
                    </Link>
                  )
                })
              )}
              {today.length > agenda.length && (
                <Link href="/dashboard/appointments" className={`block text-[13px] font-medium text-[#0f766e] ${ROW}`}>
                  {today.length - agenda.length} más en la agenda
                </Link>
              )}
            </section>
          </div>

          {/* Side column */}
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
            <QuickActions doctors={doctors} defaultDoctorId={defaultDoctorId} today={todayStr} nowHHMM={nowHHMM} />

            <section className={CARD}>
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <h3 className="text-[15px] font-semibold">Pendientes</h3>
                {revenue && revenue.outstandingTotal > 0 && (
                  <span className="tabular text-sm font-medium text-[#b45309]">{formatMoney(revenue.outstandingTotal, tenant)}</span>
                )}
              </div>
              {requestsCount > 0 && (
                <Link href="/dashboard/appointments" className={`flex items-center justify-between gap-3 ${ROW}`}>
                  <span>
                    {requestsCount} {requestsCount === 1 ? 'solicitud' : 'solicitudes'} de cita en línea
                  </span>
                  <span className="shrink-0 font-medium text-[#0f766e]">Abrir</span>
                </Link>
              )}
              {revenue?.outstanding.slice(0, 4).map((o) => (
                <Link key={o.id} href={`/dashboard/invoices/${o.id}`} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 ${ROW}`}>
                  <span className="min-w-0">
                    <span className="block truncate">{o.patientName}</span>
                    <span className="block font-mono text-xs text-[#57534e]">{o.invoiceNumber}</span>
                  </span>
                  <span className="tabular font-medium">{formatMoney(o.balanceDue, { settings: { currency: o.currency } })}</span>
                </Link>
              ))}
              {requestsCount === 0 && !revenue?.outstanding.length && (
                <p className="border-t border-[#f0eeec] px-4 py-4 text-sm text-[#57534e]">Nada pendiente por ahora.</p>
              )}
            </section>

            {showWelcome && (
              <section className={CARD}>
                <div className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[15px] font-semibold">Bienvenido(a) a {APP_NAME}</h3>
                    <span className="tabular text-sm text-[#57534e]">{welcomePct}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f0eeec]">
                    <div className="h-full bg-[#0f766e]" style={{ width: `${welcomePct}%` }} />
                  </div>
                </div>
                {checklist.map((step) => (
                  <Link key={step.href} href={step.href} className={`flex items-center justify-between gap-3 ${ROW}`}>
                    <span className={step.done ? 'text-[#57534e] line-through' : ''}>{step.title}</span>
                    <span className={`shrink-0 text-xs font-semibold ${step.done ? 'text-[#57534e]' : 'text-[#0f766e]'}`}>{step.done ? 'Listo' : 'Hacer'}</span>
                  </Link>
                ))}
              </section>
            )}
          </div>
        </div>
      </AppContent>
    </>
  )
}
