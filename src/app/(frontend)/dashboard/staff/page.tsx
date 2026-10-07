import { requireDashboardSession, requireRole, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { StaffManager, type StaffRow } from '@/components/StaffManager'
import { DEFAULT_CURRENCY, WEEKDAYS } from '@/lib/constants'
import { windowOf, formatWindow } from '@/lib/availability'
import type { User } from '@/payload-types'
import { isPractitioner } from '@/lib/practice'

function availabilitySummary(u: User): string {
  const type = (u.availabilityType as string) || 'regular'
  if (type === 'onCall') return 'De guardia'
  if (type === 'byAppointment') return 'Con cita previa'
  const days = (u.availableDays as string[] | undefined) || []
  const allDays = days.length === 0 || days.length === 7
  const dayLabel = allDays ? 'Todos los días' : WEEKDAYS.filter((w) => days.includes(w.value)).map((w) => w.label).join('/')
  return `${dayLabel} · ${formatWindow(windowOf(u))}`
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
    consultationFee: u.consultationFee,
    active: u.active !== false,
    availability: isPractitioner(u) ? availabilitySummary(u) : null,
    availabilityType: (u.availabilityType as string) || 'regular',
    availableDays: (u.availableDays as string[] | undefined) || [],
    availableFrom: u.availableFrom || '09:00',
    availableTo: u.availableTo || '17:00',
  }))

  return <StaffManager staff={staff} currency={session.tenant?.settings?.currency || DEFAULT_CURRENCY} />
}
