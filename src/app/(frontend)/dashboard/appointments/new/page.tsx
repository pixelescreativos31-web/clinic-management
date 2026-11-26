import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { regionalOf, sortByWeek, type Regional } from '@/lib/regional'
import { getTenantID } from '@/access'
import { startOfDayInTz } from '@/lib/reports'
import { windowOf, formatWindow } from '@/lib/availability'
import { BookingForm, type DoctorOption } from '@/components/BookingForm'
import { DEFAULT_TIMEZONE, WEEKDAYS } from '@/lib/constants'
import { EmptyState } from '@/components/primitives'
import { AppHeader, AppContent } from '@/components/AppHeader'
import type { User } from '@/payload-types'
import { practitionerWhere } from '@/lib/practice'

function noteFor(d: User, r: Regional): { tag: string; note: string } {
  const type = (d.availabilityType as string) || 'regular'
  if (type === 'onCall') return { tag: 'onCall', note: 'De guardia' }
  if (type === 'byAppointment') return { tag: 'byAppointment', note: 'Previa cita' }
  const days = (d.availableDays as string[] | undefined) || []
  const allDays = days.length === 0 || days.length === 7
  const dayLabel = allDays
    ? 'Todos los días'
    : sortByWeek(WEEKDAYS, r.weekStart).filter((w) => days.includes(w.value)).map((w) => w.label).join('/')
  return { tag: 'regular', note: `${dayLabel} · ${formatWindow(windowOf(d), r.timeFormat)}` }
}

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>
}) {
  const { user, tenant } = await requireDashboardSession()
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const tz = tenant?.settings?.timezone || DEFAULT_TIMEZONE

  const doctorsRes = await payload.find({
    collection: 'users',
    where: { and: [practitionerWhere(String(tenantID)), { active: { equals: true } }] },
    limit: 50,
    sort: 'name',
    overrideAccess: true,
  })

  const doctors: DoctorOption[] = (doctorsRes.docs as User[]).map((d) => {
    const { tag, note } = noteFor(d, regionalOf(tenant))
    return { id: String(d.id), name: d.name, tag, note }
  })
  // Optional prefill from a patient file — fetched with the user's access so a
  // foreign id simply resolves to nothing.
  const patientParam = (await searchParams).patient
  const prefill = patientParam
    ? await payload
        .findByID({ collection: 'patients', id: patientParam, depth: 0, overrideAccess: false, user })
        .then((p) => ({ id: String(p.id), name: p.name, phone: p.phone, mrn: p.mrn ?? '' }))
        .catch(() => null)
    : null
  const single = doctors.length === 1
  const todayStr = startOfDayInTz(tz, 0).toLocaleDateString('en-CA', { timeZone: tz })

  return (
    <>
      <AppHeader title="Nueva cita" subtitle={single ? doctors[0].name : undefined} backHref="/dashboard/appointments" />
      <AppContent>
        {doctors.length === 0 ? (
          <div className="rounded-xl border border-[#e7e5e4] bg-white">
            <EmptyState
              message="Todavía no hay un médico que atienda. Active «Atiendo pacientes» en su perfil médico o agregue un médico."
              actionHref="/dashboard/settings"
              actionLabel="Ir a Configuración"
            />
          </div>
        ) : (
          <div className={`grid items-start gap-4 ${single ? 'max-w-3xl' : 'lg:grid-cols-[minmax(0,1fr)_300px]'}`}>
            <BookingForm
              initialPatient={prefill}
              doctors={doctors}
              defaultDate={todayStr}
              defaultDuration={tenant?.settings?.appointmentDurationMins ?? 20}
              openTime={tenant?.settings?.openTime ?? '09:00'}
              closeTime={tenant?.settings?.closeTime ?? '21:00'}
            />

            {/* Availability cheat-sheet — "who sees patients when" while booking (multi-doctor only) */}
            {!single && (
              <aside className="sticky top-20 hidden overflow-hidden rounded-xl border border-[#e7e5e4] bg-white lg:block">
                <div className="px-4 py-3.5">
                  <h2 className="text-[15px] font-semibold">Médicos y horarios</h2>
                  <p className="mt-0.5 text-[13px] text-[#57534e]">Referencia rápida mientras agenda.</p>
                </div>
                <ul>
                  {doctors.map((d) => (
                    <li key={d.id} className="border-t border-[#f0eeec] px-4 py-2.5">
                      <div className="truncate text-sm font-medium">{d.name}</div>
                      <div className="tabular mt-0.5 text-[13px] text-[#57534e]">{d.note}</div>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-[#f0eeec] bg-[#fafaf7] px-4 py-3 text-[13px] leading-relaxed text-[#57534e]">
                  Los pacientes sin cita quedan en espera de inmediato y reciben un turno. Los horarios que se superponen se rechazan automáticamente.
                </div>
              </aside>
            )}
          </div>
        )}
      </AppContent>
    </>
  )
}
