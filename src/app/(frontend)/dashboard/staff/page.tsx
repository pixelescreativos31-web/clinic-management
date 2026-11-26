import { requireDashboardSession, requireRole, getPayloadClient } from '@/lib/auth'
import { regionalOf, sortByWeek, type Regional } from '@/lib/regional'
import { getTenantID } from '@/access'
import { StaffManager, type StaffRow } from '@/components/StaffManager'
import { DEFAULT_CURRENCY, WEEKDAYS } from '@/lib/constants'
import { windowOf, formatWindow } from '@/lib/availability'
import type { User } from '@/payload-types'
import { isIndividualPractice, isPractitioner } from '@/lib/practice'
import { profileFormats } from '@/lib/profiles'
import { orgTypeOf } from '@/lib/specialties'

function availabilitySummary(u: User, r: Regional): string {
  const type = (u.availabilityType as string) || 'regular'
  if (type === 'onCall') return 'De guardia'
  if (type === 'byAppointment') return 'Con cita previa'
  const days = (u.availableDays as string[] | undefined) || []
  const allDays = days.length === 0 || days.length === 7
  const dayLabel = allDays ? 'Todos los días' : sortByWeek(WEEKDAYS, r.weekStart).filter((w) => days.includes(w.value)).map((w) => w.label).join('/')
  return `${dayLabel} · ${formatWindow(windowOf(u), r.timeFormat)}`
}

export default async function StaffPage() {
  const session = await requireDashboardSession()
  await requireRole(session, ['owner'])
  const payload = await getPayloadClient()
  const tenantID = getTenantID(session.user)!

  const res = await payload.find({
    collection: 'users',
    where: { tenant: { equals: tenantID } },
    limit: 100,
    sort: 'name',
    overrideAccess: true,
  })

  const staff: StaffRow[] = (res.docs as User[]).map((u) => ({
    id: String(u.id),
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    specialty: u.specialty,
    defaultFormat: u.defaultFormat ?? '',
    specialtyKey: u.specialtyKey ?? '',
    consultationFee: u.consultationFee,
    active: u.active !== false,
    availability: isPractitioner(u) ? availabilitySummary(u, regionalOf(session.tenant)) : null,
    availabilityType: (u.availabilityType as string) || 'regular',
    availableDays: (u.availableDays as string[] | undefined) || [],
    availableFrom: u.availableFrom || '09:00',
    availableTo: u.availableTo || '17:00',
  }))

  // Templates a doctor can default to: the profile's, minus massage (therapists) and
  // the programme (opened automatically for enrolled patients).
  const formatOptions = profileFormats(session.tenant).filter((f) => f !== 'massage' && f !== 'program')
  return (
    <StaffManager
      title={isIndividualPractice(session.tenant) ? 'Asistente' : 'Equipo'}
      staff={staff}
      currency={session.tenant?.settings?.currency || DEFAULT_CURRENCY}
      formatOptions={formatOptions}
      orgType={orgTypeOf(session.tenant)}
    />
  )
}
