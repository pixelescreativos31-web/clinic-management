import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { VisitForm, type VisitInitial } from '@/components/VisitForm'
import { backgroundLine } from '@/lib/clinical'
import { isClinical } from '@/lib/practice'
import { formatDateTime } from '@/lib/format'
import type { Patient, User, Visit } from '@/payload-types'

const relId = (v: unknown): string =>
  v && typeof v === 'object' && 'id' in (v as Record<string, unknown>) ? String((v as { id: unknown }).id) : String(v)

const str = (v: unknown): string => (v == null ? '' : String(v))

/** Amend a recorded consultation (clinical roles only; every edit is audited). */
export default async function EditVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, tenant } = await requireDashboardSession()
  if (!isClinical(user)) redirect('/dashboard')
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const { id } = await params

  let visit: Visit
  try {
    visit = (await payload.findByID({ collection: 'visits', id, depth: 1, overrideAccess: false, user })) as Visit
  } catch {
    notFound()
  }
  if (relId(visit.tenant) !== String(tenantID)) notFound()

  const patient = visit.patient as Patient
  const v = visit.vitals ?? {}
  const initial: VisitInitial = {
    chiefComplaint: str(visit.chiefComplaint),
    symptoms: str(visit.symptoms),
    physicalExam: str(visit.physicalExam),
    diagnosis: str(visit.diagnosis),
    treatmentPlan: str(visit.treatmentPlan),
    labOrders: str(visit.labOrders),
    notes: str(visit.notes),
    followUpDate: visit.followUpDate ? visit.followUpDate.slice(0, 10) : '',
    vitals: {
      bpSystolic: str(v.bpSystolic),
      bpDiastolic: str(v.bpDiastolic),
      pulse: str(v.pulse),
      respiratoryRate: str(v.respiratoryRate),
      temperatureC: str(v.temperatureC),
      oxygenSaturation: str(v.oxygenSaturation),
      weightKg: str(v.weightKg),
      heightCm: str(v.heightCm),
      glucoseMgDl: str(v.glucoseMgDl),
    },
    prescription: (visit.prescription ?? []).map((r) => ({
      medicine: r.medicine,
      dosage: r.dosage ?? '',
      frequency: r.frequency ?? '',
      frequencyNote: r.frequencyNote ?? '',
      durationDays: r.durationDays ?? undefined,
      quantity: r.quantity ?? '',
      instructions: r.instructions ?? '',
    })),
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/dashboard/patients/${relId(patient)}?tab=historia`}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-ink"
      >
        ‹ {patient?.name ?? 'Paciente'}
      </Link>
      <h1 className="mt-2 text-[1.45rem] font-semibold">Editar consulta</h1>
      <p className="mb-6 text-sm text-muted-foreground">{formatDateTime(visit.visitDate, tenant)}</p>
      <VisitForm
        visitId={String(visit.id)}
        patientName={patient?.name ?? 'Paciente'}
        doctorName={(visit.doctor as User)?.name ?? 'Médico'}
        allergies={patient?.allergies}
        background={backgroundLine(patient)}
        initial={initial}
      />
    </div>
  )
}
