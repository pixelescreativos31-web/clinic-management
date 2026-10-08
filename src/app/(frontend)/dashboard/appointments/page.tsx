// Agenda — redesigned (design handoff "EMR App" → Agenda). Server side loads the
// day's appointments with their consultation / invoice so each card can offer the
// right next step; AgendaBoard renders the list, timeline and quick sheets.

import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { startOfDayInTz } from '@/lib/reports'
import { formatDate, formatDateTime } from '@/lib/format'
import { hhmmToMinutes, windowOf, weekdayInTz, minutesInTz } from '@/lib/availability'
import { toWaDigits, waReminderLink } from '@/lib/whatsapp'
import { DEFAULT_TIMEZONE, type AppointmentStatus } from '@/lib/constants'
import type { Appointment, BookingRequest, Invoice, Patient, User, Visit } from '@/payload-types'
import { isClinical, practitionerWhere } from '@/lib/practice'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { AgendaBoard, type AgendaAppt, type AgendaDay, type AgendaDoctor } from '@/components/AgendaBoard'
import { OnlineRequests, type OnlineRequestRow } from '@/components/OnlineRequests'

const relId = (v: unknown) => (v && typeof v === 'object' && 'id' in (v as object) ? String((v as { id: unknown }).id) : String(v))

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10)
}

const DOW = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { user, tenant } = await requireDashboardSession()
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const tz = tenant?.settings?.timezone || DEFAULT_TIMEZONE

  const params = await searchParams
  const todayStr = startOfDayInTz(tz, 0).toLocaleDateString('en-CA', { timeZone: tz })
  const dateStr = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayStr
  const isToday = dateStr === todayStr

  const [y, m, d] = dateStr.split('-').map(Number)
  const dayStart = startOfDayInTz(tz, 0, new Date(Date.UTC(y, m - 1, d, 12)))
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000)

  const [doctorsRes, apptsRes, requestsRes] = await Promise.all([
    payload.find({
      collection: 'users',
      where: { and: [practitionerWhere(String(tenantID)), { active: { equals: true } }] },
      limit: 50,
      overrideAccess: true,
      sort: 'name',
    }),
    payload.find({
      collection: 'appointments',
      where: { tenant: { equals: tenantID }, start: { greater_than_equal: dayStart.toISOString(), less_than: dayEnd.toISOString() } },
      limit: 300,
      depth: 1,
      overrideAccess: true,
      sort: 'start',
    }),
    payload.find({
      collection: 'bookingRequests',
      where: { tenant: { equals: tenantID }, status: { equals: 'pending' } },
      sort: '-createdAt',
      limit: 20,
      depth: 1,
      overrideAccess: false,
      user,
    }),
  ])
  const appts = apptsRes.docs as Appointment[]

  // Consultation + invoice per completed appointment (next step on the card).
  const completedIds = appts.filter((a) => a.status === 'completed').map((a) => String(a.id))
  const visits = completedIds.length
    ? ((await payload.find({ collection: 'visits', where: { tenant: { equals: tenantID }, appointment: { in: completedIds } }, limit: 300, depth: 0, overrideAccess: true })).docs as Visit[])
    : []
  const visitByAppt = new Map(visits.map((v) => [relId(v.appointment), String(v.id)]))
  const invoices = visits.length
    ? ((await payload.find({
        collection: 'invoices',
        where: { tenant: { equals: tenantID }, visit: { in: visits.map((v) => String(v.id)) }, voided: { not_equals: true } },
        limit: 300,
        depth: 0,
        overrideAccess: true,
      })).docs as Invoice[])
    : []
  const invoiceByVisit = new Map(invoices.map((i) => [relId(i.visit), String(i.id)]))

  const viewedWeekday = weekdayInTz(new Date(dayStart.getTime() + 12 * 3600_000), tz)
  const doctors: AgendaDoctor[] = (doctorsRes.docs as User[]).map((doc) => {
    const type = doc.availabilityType || 'regular'
    if (type !== 'regular') {
      return { id: String(doc.id), name: doc.name, fromMin: hhmmToMinutes(tenant?.settings?.openTime || '08:00'), toMin: hhmmToMinutes(tenant?.settings?.closeTime || '18:00') }
    }
    const days = (doc.availableDays as string[] | null | undefined) ?? []
    const works = days.length === 0 || days.includes(viewedWeekday)
    const win = windowOf(doc)
    return { id: String(doc.id), name: doc.name, fromMin: works ? hhmmToMinutes(win.from) : null, toMin: works ? hhmmToMinutes(win.to) : null }
  })

  const prettyDate = dayStart.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz })
  const rows: AgendaAppt[] = appts.map((a) => {
    const p = a.patient as Patient
    const doc = a.doctor as User
    const startMin = minutesInTz(new Date(a.start), tz)
    const visitId = visitByAppt.get(String(a.id)) ?? null
    return {
      id: String(a.id),
      hhmm: '',
      timeLabel: '',
      startMin,
      durationMins: a.durationMins,
      patientId: String(p?.id ?? a.patient),
      patientName: p?.name ?? 'Paciente',
      reason: a.reason ?? '',
      status: a.status as AppointmentStatus,
      isWalkIn: Boolean(a.isWalkIn),
      token: (a as { tokenNumber?: string | null }).tokenNumber ?? null,
      online: a.source === 'online',
      doctorId: String(doc?.id ?? a.doctor),
      doctorName: doc?.name ?? '',
      waHref: waReminderLink({
        phone: p?.phone,
        currency: tenant?.settings?.currency,
        doctorName: doc?.name ?? 'su médico',
        clinicName: tenant?.name ?? 'el consultorio',
        dateLabel: prettyDate,
        timeLabel: `${Math.floor(startMin / 60) % 12 || 12}:${String(startMin % 60).padStart(2, '0')} ${startMin < 720 ? 'a. m.' : 'p. m.'}`,
      }),
      visitId,
      invoiceId: visitId ? invoiceByVisit.get(visitId) ?? null : null,
    }
  })

  // Day strip: three days back, ten ahead.
  const days: AgendaDay[] = Array.from({ length: 14 }, (_, i) => {
    const ds = addDays(todayStr, i - 3)
    const dt = new Date(`${ds}T12:00:00Z`)
    return { date: ds, dow: DOW[dt.getUTCDay()], num: dt.getUTCDate(), href: `/dashboard/appointments?date=${ds}`, active: ds === dateStr }
  })
  if (!days.some((x) => x.active)) {
    const dt = new Date(`${dateStr}T12:00:00Z`)
    days.push({ date: dateStr, dow: DOW[dt.getUTCDay()], num: dt.getUTCDate(), href: `/dashboard/appointments?date=${dateStr}`, active: true })
  }

  const requests: OnlineRequestRow[] = (requestsRes.docs as BookingRequest[]).map((r) => {
    const p = r.patient as Patient
    const digits = toWaDigits(p?.phone, tenant?.settings?.currency)
    const text = `Hola ${p?.name ?? ''}, le escribimos de ${tenant?.name ?? 'el consultorio'} por su solicitud de cita.`
    return {
      id: String(r.id),
      patientId: String(p?.id ?? r.patient),
      patientName: p?.name ?? 'Paciente',
      phone: p?.phone ?? '',
      waHref: digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null,
      doctorName: (r.doctor as User | null | undefined)?.name ?? null,
      preferredDate: r.preferredDate ? formatDate(r.preferredDate, tenant) : null,
      reason: r.reason,
      urgent: Boolean(r.urgent),
      receivedLabel: formatDateTime(r.createdAt, tenant),
    }
  })

  const nowMin = isToday ? minutesInTz(new Date(), tz) : null
  const nowMinutes = minutesInTz(new Date(), tz)
  const nowHHMM = `${String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:${String(nowMinutes % 60).padStart(2, '0')}`
  const defaultDoctorId =
    doctors.find((x) => x.id === String(user.id))?.id ?? doctors.find((x) => rows.some((r) => r.doctorId === x.id))?.id ?? doctors[0]?.id ?? ''
  const subtitle = doctors.length === 1 ? doctors[0].name : prettyDate.charAt(0).toUpperCase() + prettyDate.slice(1)

  return (
    <>
      <AppHeader title="Agenda" subtitle={isToday ? `Hoy · ${subtitle}` : subtitle} />
      <AppContent>
        {requests.length > 0 && <OnlineRequests rows={requests} />}
        {doctors.length === 0 ? (
          <div className="rounded-[14px] border border-[#e3e7e7] bg-white p-6 text-sm text-[#6b7577]">
            Todavía no hay médicos que atiendan pacientes. Configure su perfil médico en Configuración.
          </div>
        ) : (
          <AgendaBoard
            days={days}
            date={dateStr}
            today={todayStr}
            dateLabel={prettyDate}
            isToday={isToday}
            nowMin={nowMin}
            nowHHMM={nowHHMM}
            durationMins={tenant?.settings?.appointmentDurationMins || 20}
            doctors={doctors}
            appts={rows}
            clinical={isClinical(user)}
            defaultDoctorId={defaultDoctorId}
          />
        )}
      </AppContent>
    </>
  )
}
