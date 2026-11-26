import { notFound } from 'next/navigation'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { PatientForm } from '@/components/PatientForm'
import { patientToInitial } from '@/lib/patientForm'
import { isClinical } from '@/lib/practice'
import type { Patient } from '@/payload-types'

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireDashboardSession()
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const { id } = await params

  let patient: Patient
  try {
    patient = (await payload.findByID({
      collection: 'patients',
      id,
      depth: 0,
      overrideAccess: false,
      user,
    })) as Patient
  } catch {
    notFound()
  }
  if (String((patient.tenant as { id?: string })?.id ?? patient.tenant) !== String(tenantID)) {
    notFound()
  }

  return (
    <>
      <AppHeader title="Editar paciente" subtitle={patient.name} backHref={`/dashboard/patients/${id}`} />
      <AppContent className="max-w-[860px]">
        <PatientForm
          patientId={id}
          initial={patientToInitial(patient)}
          clinical={isClinical(user)}
          cancelHref={`/dashboard/patients/${id}`}
        />
      </AppContent>
    </>
  )
}
