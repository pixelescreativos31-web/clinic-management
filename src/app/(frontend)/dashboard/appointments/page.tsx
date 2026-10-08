import Link from 'next/link'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { startOfDayInTz } from '@/lib/reports'
import { formatDate, formatDateTime, formatTime } from '@/lib/format'
import { btnPrimary, PageTitle } from '@/components/primitives'
import { IconChevronLeft, IconChevronRight, IconPlus } from '@/components/icons'
import { DayRail, type DoctorColumn } from '@/components/DayRail'
import { hhmmToMinutes, windowOf, weekdayInTz, minutesInTz } from '@/lib/availability'
import { toWaDigits, waReminderLink } from '@/lib/whatsapp'
import { OnlineRequests, type OnlineRequestRow } from '@/components/OnlineRequests'
import { DEFAULT_TIMEZONE, WEEKDAYS, type AppointmentStatus } from '@/lib/constants'
import type { Appointment, BookingRequest, Patient, User } from '@/payload-types'
import { practitionerWhere } from '@/lib/practice'

function minutesFromMidnight(date: Date, tz: string): number {
  return minutesInTz(date, tz)
}

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + delta))
  return dt.toISOString().slice(0, 10)
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { user, tenant } = await requireDashboardSession()
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const tz = tenant?.settings?.timezone || DEFAULT_TIMEZONE

  const params = await searchParams
  const todayStr = startOfDayInTz(tz, 0).toLocaleDateString('en-CA', { timeZone: tz })
  const dateStr = params.date || todayStr
  const isToday = dateStr === todayStr

  // Day range in tenant tz for the chosen date.
  const [y, m, d] = dateStr.split('-').map(Number)
  const dayStart = startOfDayInTz(tz, 0, new Date(Date.UTC(y, m - 1, d, 12)))
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000)

  const [doctorsRes, apptsRes] = await Promise.all([
    payload.find({
      collection: 'users',
      where: { and: [practitionerWhere(String(tenantID)), { active: { equals: true } }] },
      limit: 50,
      overrideAccess: true,
      sort: 'name',
    }),
    payload.find({
      collection: 'appointments',
      where: {
        tenant: { equals: tenantID },
        start: { greater_than_equal: dayStart.toISOString(), less_than: dayEnd.toISOString() },
      },
      limit: 200,
      depth: 1,
      overrideAccess: true,
      sort: 'start',
    }),
  ])

  const openMinutes = hhmmToMinutes(tenant?.settings?.openTime || '09:00')
  const closeMinutes = hhmmToMinutes(tenant?.settings?.closeTime || '21:00')
  const viewedWeekday = weekdayInTz(dayStart, tz)
  const nowMinutes = isToday ? minutesFromMidnight(new Date(), tz) : null

  const prettyDate = new Date(dayStart).toLocaleDateString('es-DO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: tz,
  })

  const columns: DoctorColumn[] = (doctorsRes.docs as User[]).map((doc) => {
    const type = (doc.availabilityType as string) || 'regular'
    let windowFrom: number | null = null
    let windowTo: number | null = null
    let availabilityNote: string | null = null

    if (type === 'onCall') {
      availabilityNote = 'De guardia'
    } else if (type === 'byAppointment') {
      availabilityNote = 'Previa cita'
    } else {
      const days = (doc.availableDays as string[] | undefined) || []
      const onToday = days.length === 0 || days.includes(viewedWeekday)
      const win = windowOf(doc)
      if (onToday) {
        windowFrom = hhmmToMinutes(win.from)
        windowTo = hhmmToMinutes(win.to)
      } else {
        const dayList = WEEKDAYS.filter((w) => days.includes(w.value)).map((w) => w.label).join('/')
        availabilityNote = `No consulta hoy · ${dayList || '—'}`
      }
    }

    return {
      id: String(doc.id),
      name: doc.name,
      windowFrom,
      windowTo,
      availabilityNote,
      blocks: (apptsRes.docs as Appointment[])
        .filter((a) => String((a.doctor as User)?.id ?? a.doctor) === String(doc.id))
        .map((a) => ({
          id: String(a.id),
          patientName: (a.patient as Patient)?.name ?? 'Paciente',
          reason: a.reason ?? '',
          status: a.status as AppointmentStatus,
          timeLabel: formatTime(a.start, tenant),
          startMinutes: minutesFromMidnight(new Date(a.start), tz),
          durationMins: a.durationMins,
          isWalkIn: Boolean(a.isWalkIn),
          online: a.source === 'online',
          token: (a as { tokenNumber?: string }).tokenNumber,
          doctorName: doc.name,
          waHref: waReminderLink({
            phone: (a.patient as Patient)?.phone,
            currency: tenant?.settings?.currency,
            doctorName: doc.name,
            clinicName: tenant?.name ?? 'el consultorio',
            dateLabel: prettyDate,
            timeLabel: formatTime(a.start, tenant),
          }),
        })),
    }
  })

  const totalToday = apptsRes.docs.length

  // Pending "extra / emergency" requests from the public booking page.
  const requestsRes = await payload.find({
    collection: 'bookingRequests',
    where: { tenant: { equals: tenantID }, status: { equals: 'pending' } },
    sort: '-createdAt',
    limit: 20,
    depth: 1,
    overrideAccess: false,
    user,
  })
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

  return (
    <div>
      <PageTitle
        subtitle={`${prettyDate.charAt(0).toUpperCase() + prettyDate.slice(1)} · ${totalToday} ${totalToday === 1 ? 'cita' : 'citas'}`}
        action={
          <>
            <div className="flex items-center rounded-lg border border-border bg-surface">
              <Link
                href={`/dashboard/appointments?date=${addDays(dateStr, -1)}`}
                className="flex size-9 items-center justify-center rounded-s-lg text-muted-foreground transition-colors hover:bg-canvas hover:text-ink"
                title="Día anterior"
              >
                <IconChevronLeft size={15} />
              </Link>
              <Link
                href="/dashboard/appointments"
                className={`tabular border-x border-border px-3.5 text-[13px] font-medium leading-9 transition-colors hover:bg-canvas ${
                  isToday ? 'text-primary' : 'text-ink'
                }`}
              >
                {isToday ? 'Hoy' : dateStr}
              </Link>
              <Link
                href={`/dashboard/appointments?date=${addDays(dateStr, 1)}`}
                className="flex size-9 items-center justify-center rounded-e-lg text-muted-foreground transition-colors hover:bg-canvas hover:text-ink"
                title="Día siguiente"
              >
                <IconChevronRight size={15} />
              </Link>
            </div>
            <Link href="/dashboard/appointments/new" className={btnPrimary}>
              <IconPlus size={15} />
              Nueva cita
            </Link>
          </>
        }
      >
        Citas
      </PageTitle>

      {requests.length > 0 && <OnlineRequests rows={requests} />}

      <DayRail
        columns={columns}
        openMinutes={openMinutes}
        closeMinutes={closeMinutes}
        nowMinutes={nowMinutes}
        canRecordVisit={user.role === 'doctor' || user.role === 'owner'}
      />
    </div>
  )
}
