// Inicio — redesigned (design handoff "EMR App" → Inicio): «Siguiente paciente»,
// three KPIs, quick actions, pending balances (owner) and today's upcoming list.
// Desktop: two-column grid. Money charts moved to Reportes.

import Link from 'next/link'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { getRevenueData, startOfDayInTz } from '@/lib/reports'
import { formatMoney } from '@/lib/format'
import { minutesInTz } from '@/lib/availability'
import { DEFAULT_TIMEZONE, type AppointmentStatus } from '@/lib/constants'
import { APP_NAME } from '@/lib/brand'
import { apptStatusStyle, avatarTint, initialsOf } from '@/lib/apptStatus'
import { isClinical, isPractitioner, practitionerWhere } from '@/lib/practice'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { NextPatientCard, QuickActions, type NextPatient } from '@/components/HomeBoard'
import { IconCheck } from '@/components/icons'
import type { Appointment, Patient, User } from '@/payload-types'

function greetingFor(tz: string): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date()))
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

const time12 = (iso: string, tz: string) => {
  const m = minutesInTz(new Date(iso), tz)
  return `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')}`
}

export default async function DashboardHome({ searchParams }: { searchParams?: Promise<{ welcome?: string }> }) {
  const { user, tenant } = await requireDashboardSession()
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const tz = tenant?.settings?.timezone || DEFAULT_TIMEZONE
  const params = (await searchParams) ?? {}

  const todayStart = startOfDayInTz(tz, 0)
  const tomorrowStart = startOfDayInTz(tz, 1)
  const [doctorsRes, todayRes, patientsCount, apptsCount] = await Promise.all([
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
  const next: NextPatient | null = nextAppt
    ? {
        apptId: String(nextAppt.id),
        patientId: String((nextAppt.patient as Patient)?.id ?? nextAppt.patient),
        name: (nextAppt.patient as Patient)?.name ?? 'Paciente',
        line: [time12(nextAppt.start, tz), nextAppt.reason].filter(Boolean).join(' · '),
        status: nextAppt.status as 'scheduled' | 'checked-in',
        badge: apptStatusStyle(nextAppt.status as AppointmentStatus, {
          isWalkIn: Boolean(nextAppt.isWalkIn),
          token: (nextAppt as { tokenNumber?: string | null }).tokenNumber,
        }).label,
      }
    : null

  const upcoming = today.filter((a) => a.status === 'scheduled' || a.status === 'checked-in').slice(0, 4)
  const kpiDone = today.filter((a) => a.status === 'completed').length

  // Pending balances are money figures: owner only.
  const revenue = user.role === 'owner' ? await getRevenueData(payload, tenantID, tenant) : null

  // Welcome checklist for fresh self-serve clinics (derived from counts only).
  const showWelcome = params.welcome === '1' || (tenant?.onboardingSource === 'self-serve' && patientsCount.totalDocs <= 3)
  const checklist = [
    { done: doctors.length > 0, title: 'Agregue a sus médicos', desc: 'Defina especialidades y horarios', href: '/dashboard/staff', ownerOnly: true },
    { done: patientsCount.totalDocs > 0, title: 'Registre un paciente', desc: 'Basta con nombre y teléfono', href: '/dashboard/patients/new', ownerOnly: false },
    { done: apptsCount.totalDocs > 0, title: 'Agende una cita', desc: 'O registre un paciente sin cita', href: '/dashboard/appointments', ownerOnly: false },
  ].filter((s) => !s.ownerOnly || user.role === 'owner')

  const parts = (user.name ?? '').trim().split(/\s+/).filter(Boolean)
  const firstName = /^dra?\.?$/i.test(parts[0] ?? '') ? parts[1] ?? '' : parts[0] ?? ''
  const dateLine = new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz })
  const nowMin = minutesInTz(new Date(), tz)
  const nowHHMM = `${String(Math.floor(nowMin / 60)).padStart(2, '0')}:${String(nowMin % 60).padStart(2, '0')}`
  const todayStr = todayStart.toLocaleDateString('en-CA', { timeZone: tz })
  const defaultDoctorId = doctors.find((d) => d.id === String(user.id))?.id ?? doctors[0]?.id ?? ''

  return (
    <>
      <AppHeader
        title={`${greetingFor(tz)}${firstName ? `, ${firstName}` : ''}`}
        subtitle={`${dateLine.charAt(0).toUpperCase() + dateLine.slice(1)} · ${today.length} ${today.length === 1 ? 'cita' : 'citas'}`}
      />
      <AppContent>
        {showWelcome && (
          <section className="mb-3.5 overflow-hidden rounded-2xl border border-[#cfe3dd] bg-[#e6f1ee]">
            <div className="px-4 py-3.5">
              <h2 className="font-display text-base font-semibold text-[#0d6e60]">Bienvenido(a) a {APP_NAME}</h2>
              <p className="mt-0.5 text-[13px] text-[#6b7577]">Hágalo suyo en tres pasos.</p>
            </div>
            <ol className="divide-y divide-[#cfe3dd] border-t border-[#cfe3dd] bg-white">
              {checklist.map((step, i) => (
                <li key={step.href}>
                  <Link href={step.href} className="flex min-h-12 items-center gap-3 px-4 py-3 text-[#15201e] hover:text-[#15201e]">
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        step.done ? 'bg-[#0d6e60] text-white' : 'border border-[#0d6e60]/30 text-[#0d6e60]'
                      }`}
                    >
                      {step.done ? <IconCheck size={14} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${step.done ? 'text-[#6b7577] line-through' : ''}`}>{step.title}</span>
                      <span className="block truncate text-xs text-[#6b7577]">{step.desc}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <NextPatientCard next={next} clinical={isClinical(user)} />

          <div className="col-span-full grid grid-cols-3 gap-2.5">
            {[
              { label: 'Citas hoy', value: today.length, color: '#15201e' },
              { label: 'Atendidas', value: kpiDone, color: '#1a7a50' },
              { label: 'En sala', value: waitingList.length, color: '#2563ab' },
            ].map((k) => (
              <div key={k.label} className="rounded-[14px] border border-[#e3e7e7] bg-white p-3.5">
                <div className="text-xs text-[#6b7577]">{k.label}</div>
                <div className="tabular mt-1 font-display text-[28px] leading-[1.1] font-bold" style={{ color: k.color }}>
                  {k.value}
                </div>
              </div>
            ))}
          </div>

          <QuickActions doctors={doctors} defaultDoctorId={defaultDoctorId} today={todayStr} nowHHMM={nowHHMM} />

          {revenue ? (
            <div className="overflow-hidden rounded-[14px] border border-[#e3e7e7] bg-white">
              <div className="flex items-center justify-between border-b border-[#eef1f1] px-4 py-3.5">
                <span className="text-sm font-semibold">Saldos pendientes</span>
                <span className="tabular text-xs font-semibold text-[#b45309]">{formatMoney(revenue.outstandingTotal, tenant)}</span>
              </div>
              {revenue.outstanding.length === 0 ? (
                <p className="px-4 py-5 text-sm text-[#6b7577]">Sin saldos pendientes.</p>
              ) : (
                revenue.outstanding.slice(0, 4).map((o) => (
                  <Link
                    key={o.id}
                    href={`/dashboard/invoices/${o.id}`}
                    className="flex min-h-[52px] items-center gap-3 border-b border-[#eef1f1] px-4 py-3 text-[#15201e] last:border-0 hover:bg-[#fafbfb] hover:text-[#15201e]"
                  >
                    <span className="tabular w-16 shrink-0 text-xs text-[#6b7577]">{o.invoiceNumber}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{o.patientName}</span>
                    <span className="tabular text-sm font-semibold text-[#b45309]">{formatMoney(o.balanceDue, { settings: { currency: o.currency } })}</span>
                  </Link>
                ))
              )}
            </div>
          ) : (
            <div />
          )}

          <div className="col-span-full overflow-hidden rounded-[14px] border border-[#e3e7e7] bg-white">
            <div className="flex items-center justify-between border-b border-[#eef1f1] px-4 py-3.5">
              <span className="text-sm font-semibold">Próximas hoy</span>
              <Link href="/dashboard/appointments" className="text-[13px] font-semibold text-[#0d6e60]">
                Ver agenda ›
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="px-4 py-5 text-sm text-[#6b7577]">No quedan citas pendientes hoy.</p>
            ) : (
              upcoming.map((a) => {
                const p = a.patient as Patient
                const name = p?.name ?? 'Paciente'
                const tint = avatarTint(name)
                const st = apptStatusStyle(a.status as AppointmentStatus, { isWalkIn: Boolean(a.isWalkIn), token: (a as { tokenNumber?: string | null }).tokenNumber })
                return (
                  <Link
                    key={a.id}
                    href={`/dashboard/patients/${p?.id ?? a.patient}`}
                    className="flex min-h-14 items-center gap-3 border-b border-[#eef1f1] px-4 py-3 text-[#15201e] last:border-0 hover:bg-[#fafbfb] hover:text-[#15201e]"
                  >
                    <span className="tabular w-11 shrink-0 text-[13px] font-semibold">{time12(a.start, tz)}</span>
                    <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: tint.bg, color: tint.fg }}>
                      {initialsOf(name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{name}</span>
                      <span className="block truncate text-xs text-[#6b7577]">{a.reason || (a.source === 'online' ? 'Reserva en línea' : ' ')}</span>
                    </span>
                    <span className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold whitespace-nowrap" style={{ background: st.bg, color: st.fg }}>
                      {st.label}
                    </span>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </AppContent>
    </>
  )
}
