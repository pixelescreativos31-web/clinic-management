import { notFound, redirect } from 'next/navigation'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { VisitForm, type VisitInitial } from '@/components/VisitForm'
import { backgroundLine } from '@/lib/clinical'
import { isClinical } from '@/lib/practice'
import { formatDateTime } from '@/lib/format'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { frequentDiagnoses } from '@/lib/clinical'
import { DEFAULT_TIMEZONE } from '@/lib/constants'
import { isNutritionPractice, nutritionToForm } from '@/lib/nutrition'
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
    nutrition: nutritionToForm(visit.nutrition),
    // Older visits have no stored format: infer it from saved nutrition data.
    format:
      visit.format === 'nutrition' || visit.format === 'general'
        ? visit.format
        : Object.values(visit.nutrition ?? {}).some((x) => x != null && x !== '')
          ? 'nutrition'
          : isNutritionPractice(tenant)
            ? 'nutrition'
            : 'general',
  }

  const tz = tenant?.settings?.timezone || DEFAULT_TIMEZONE
  return (
    <>
      <AppHeader
        title="Editar consulta"
        subtitle={`${patient?.name ?? 'Paciente'} · ${formatDateTime(visit.visitDate, tenant)}`}
        backHref={`/dashboard/patients/${relId(patient)}?tab=historia`}
      />
      <AppContent>
        <VisitForm
          visitId={String(visit.id)}
          allergies={patient?.allergies}
          background={backgroundLine(patient)}
          initial={initial}
          defaultFormat={isNutritionPractice(tenant) ? 'nutrition' : 'general'}
          frequentDiagnoses={await frequentDiagnoses(payload, String(tenantID), relId(visit.doctor as User))}
          baseDate={new Date(visit.visitDate).toLocaleDateString('en-CA', { timeZone: tz })}
        />
      </AppContent>
    </>
  )
}
