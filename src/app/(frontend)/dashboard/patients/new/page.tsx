import Link from 'next/link'
import { requireDashboardSession } from '@/lib/auth'
import { PatientForm } from '@/components/PatientForm'
import { isClinical } from '@/lib/practice'

export default async function NewPatientPage() {
  const { user } = await requireDashboardSession()
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/dashboard/patients"
        className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-ink"
      >
        ‹ Pacientes
      </Link>
      <h1 className="mt-2 mb-6 text-[1.45rem] font-semibold">Nuevo paciente</h1>
      <PatientForm clinical={isClinical(user)} />
    </div>
  )
}
