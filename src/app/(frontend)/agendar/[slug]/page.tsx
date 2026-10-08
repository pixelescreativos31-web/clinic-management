import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getPayloadClient } from '@/lib/auth'
import { bookableDates, getPublicClinic, BOOKING_WINDOW_DAYS } from '@/lib/publicBooking'
import { PublicBooking } from '@/components/PublicBooking'
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

/** Public booking page: patients book a free slot inside each doctor's schedule. */
export default async function BookingPage({ params }: Props) {
  await connection() // slots depend on "now" — never prerender
  const { slug } = await params
  const clinic = await getPublicClinic(await getPayloadClient(), slug)
  if (!clinic) notFound()

  const doctors = clinic.doctors.map((d) => ({
    id: d.id,
    name: d.name,
    specialty: d.specialty,
    dates: bookableDates(clinic, d),
  }))

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <header className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Agendar cita</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">{clinic.name}</h1>
          {(clinic.address || clinic.city) && (
            <p className="mt-1 text-sm text-muted-foreground">{[clinic.address, clinic.city].filter(Boolean).join(', ')}</p>
          )}
        </header>

        {doctors.length === 0 ? (
          <div className="card-flat p-6 text-center text-sm text-muted-foreground">
            Por ahora no hay horarios disponibles en línea. Llame al consultorio
            {clinic.phone ? ` al ${clinic.phone}` : ''} para agendar.
          </div>
        ) : (
          <PublicBooking
            slug={clinic.slug}
            clinicName={clinic.name}
            clinicPhone={clinic.phone}
            currency={clinic.currency}
            durationMins={clinic.durationMins}
            requestsEnabled={clinic.requestsEnabled}
            windowDays={BOOKING_WINDOW_DAYS}
            doctors={doctors}
          />
        )}

        <p className="mt-8 text-center text-xs text-faint">
          Reservas con {APP_NAME} · Si es una emergencia que pone en riesgo la vida, llame al 911.
        </p>
      </div>
    </main>
  )
}
