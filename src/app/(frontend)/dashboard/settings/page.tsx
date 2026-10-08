import { requireDashboardSession, requireRole } from '@/lib/auth'
import { PageTitle } from '@/components/primitives'
import { SettingsForm } from '@/components/SettingsForm'
import {
  DEFAULT_APPOINTMENT_DURATION,
  DEFAULT_CLOSE_TIME,
  DEFAULT_CURRENCY,
  DEFAULT_OPEN_TIME,
  DEFAULT_TIMEZONE,
} from '@/lib/constants'

export default async function SettingsPage() {
  const session = await requireDashboardSession()
  await requireRole(session, ['owner'])
  const t = session.tenant
  const u = session.user

  return (
    <div>
      <PageTitle subtitle="Datos del consultorio, agenda y su perfil médico.">Configuración</PageTitle>
      <SettingsForm
        initial={{
          name: t?.name ?? '',
          phone: t?.phone ?? '',
          address: t?.address ?? '',
          city: t?.city ?? '',
          country: t?.country ?? '',
          appointmentDurationMins: t?.settings?.appointmentDurationMins ?? DEFAULT_APPOINTMENT_DURATION,
          openTime: t?.settings?.openTime ?? DEFAULT_OPEN_TIME,
          closeTime: t?.settings?.closeTime ?? DEFAULT_CLOSE_TIME,
          currency: t?.settings?.currency ?? DEFAULT_CURRENCY,
          timezone: t?.settings?.timezone ?? DEFAULT_TIMEZONE,
          taxId: t?.taxId ?? '',
          practiceType: t?.practiceType === 'clinic' ? 'clinic' : 'individual',
          consultTemplate: t?.settings?.consultTemplate === 'nutrition' ? 'nutrition' : 'general',
        }}
        profile={{
          practitioner: u.practitioner === true,
          specialty: u.specialty ?? '',
          licenseNumber: u.licenseNumber ?? '',
          consultationFee: u.consultationFee != null ? String(u.consultationFee) : '',
          availableDays: (u.availableDays as string[] | null | undefined) ?? ['mon', 'tue', 'wed', 'thu', 'fri'],
          availableFrom: u.availableFrom ?? DEFAULT_OPEN_TIME,
          availableTo: u.availableTo ?? DEFAULT_CLOSE_TIME,
        }}
      />
    </div>
  )
}
