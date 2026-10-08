// Public booking page — recreated from design_handoff_emr/EMR Agendar.dc.html.
// No login: the patient picks a service, a day and a free time, leaves name +
// WhatsApp and gets a confirmed appointment.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getPayloadClient } from '@/lib/auth'
import { bookableDates, dateInTz, getPublicClinic, BOOKING_WINDOW_DAYS, type PublicDoctor } from '@/lib/publicBooking'
import { startOfDayInTz } from '@/lib/reports'
import { weekdayInTz } from '@/lib/availability'
import { WEEKDAYS } from '@/lib/constants'
import { PublicBooking, type BookingDay, type BookingDoctor } from '@/components/PublicBooking'
import { APP_NAME } from '@/lib/brand'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const clinic = await getPublicClinic(await getPayloadClient(), slug)
  return {
    title: clinic ? `Agendar cita — ${clinic.name}` : `Agendar cita — ${APP_NAME}`,
    robots: { index: false },
  }
}

const ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const SHORT: Record<string, string> = { mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom' }

/** "14:30" → "2:30 p. m." */
function ampm(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

/** "Lun a vie · 9:00 a. m. – 5:00 p. m." (consecutive days collapse to a range). */
function hoursLabel(d: PublicDoctor) {
  const idx = d.days.map((x) => ORDER.indexOf(x)).filter((i) => i >= 0).sort((a, b) => a - b)
  const consecutive = idx.length > 2 && idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
  const days = consecutive
    ? `${SHORT[ORDER[idx[0]]]} a ${SHORT[ORDER[idx[idx.length - 1]]].toLowerCase()}`
    : idx.map((i) => WEEKDAYS.find((w) => w.value === ORDER[i])?.label ?? SHORT[ORDER[i]]).join(', ')
  return `${days} · ${ampm(d.from)} – ${ampm(d.to)}`
}

/** Public booking page: patients book a free slot inside each doctor's schedule. */
export default async function BookingPage({ params }: Props) {
  await connection() // slots depend on "now" — never prerender
  const { slug } = await params
  const clinic = await getPublicClinic(await getPayloadClient(), slug)
  if (!clinic) notFound()

  const now = new Date()
  const doctors: BookingDoctor[] = clinic.doctors.map((d) => {
    const open = new Set(bookableDates(clinic, d, now))
    const days: BookingDay[] = []
    for (let i = 0; i <= BOOKING_WINDOW_DAYS; i++) {
      const noon = new Date(startOfDayInTz(clinic.tz, i, now).getTime() + 12 * 3600_000)
      const date = dateInTz(noon, clinic.tz)
      days.push({ date, dow: SHORT[weekdayInTz(noon, clinic.tz)] ?? '', num: Number(date.slice(8, 10)), open: open.has(date) })
    }
    return {
      id: d.id,
      name: d.name,
      specialty: d.specialty,
      licenseNumber: d.licenseNumber,
      hours: hoursLabel(d),
      services: d.services,
      days,
    }
  })

  return (
    <main className="flex min-h-screen flex-col bg-[#f4f6f6] text-[15px] leading-[1.45] text-[#15201e]">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-[#e3e7e7] bg-white px-[18px] py-3.5">
        <span aria-hidden className="flex size-[26px] items-center justify-center rounded-[7px] bg-[#0d6e60] text-[13px] font-bold text-white">
          +
        </span>
        <span className="truncate text-[13px] text-[#6b7577]">
          Agenda en línea · <strong className="font-semibold text-[#15201e]">{clinic.name}</strong>
        </span>
      </header>

      <div className="flex-1 px-3.5 pt-3.5 pb-8 md:px-6 md:pt-8 md:pb-12">
        {doctors.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-[#e3e7e7] bg-white p-6 text-center text-sm text-[#6b7577]">
            Por ahora no hay horarios disponibles en línea. Llame al consultorio
            {clinic.phone ? ` al ${clinic.phone}` : ''} para agendar.
          </div>
        ) : (
          <PublicBooking
            slug={clinic.slug}
            clinic={{
              name: clinic.name,
              phone: clinic.phone,
              address: [clinic.address, clinic.city].filter(Boolean).join(', ') || null,
              currency: clinic.currency,
              requestsEnabled: clinic.requestsEnabled,
            }}
            doctors={doctors}
          />
        )}
        <p className="mx-auto mt-8 max-w-[960px] text-center text-xs text-[#97a09a]">
          Reservas con {APP_NAME} · Si es una emergencia que pone en riesgo la vida, llame al 911.
        </p>
      </div>
    </main>
  )
}
