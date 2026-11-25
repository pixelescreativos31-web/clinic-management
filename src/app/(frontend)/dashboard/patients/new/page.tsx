import { requireDashboardSession } from '@/lib/auth'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { PatientForm } from '@/components/PatientForm'
import { isClinical } from '@/lib/practice'

export default async function NewPatientPage() {
  const { user } = await requireDashboardSession()
  return (
    <>
      <AppHeader title="Nuevo paciente" backHref="/dashboard/patients" />
      <AppContent className="max-w-[860px]">
        <PatientForm clinical={isClinical(user)} cancelHref="/dashboard/patients" />
      </AppContent>
    </>
  )
}
