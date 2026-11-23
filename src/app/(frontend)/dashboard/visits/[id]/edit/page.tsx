import { notFound, redirect } from 'next/navigation'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { VisitForm, type VisitInitial } from '@/components/VisitForm'
import { backgroundLine } from '@/lib/clinical'
import { canRecordVisits, isTherapist } from '@/lib/practice'
import { formatsFor, asFormat, practiceProfile, type ConsultFormat } from '@/lib/profiles'
import { massageToForm } from '@/lib/massage'
import { kgToLb, METRICS } from '@/lib/program'
import { programContext } from '@/lib/programData'
import { formatDateTime } from '@/lib/format'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { frequentDiagnoses } from '@/lib/clinical'
import { DEFAULT_TIMEZONE } from '@/lib/constants'
import { nutritionToForm } from '@/lib/nutrition'
import type { Patient, Program, User, Visit } from '@/payload-types'

const relId = (v: unknown): string =>
  v && typeof v === 'object' && 'id' in (v as Record<string, unknown>) ? String((v as { id: unknown }).id) : String(v)

const str = (v: unknown): string => (v == null ? '' : String(v))

/** Amend a recorded consultation (clinical roles only; every edit is audited). */
export default async function EditVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, tenant } = await requireDashboardSession()
  if (!canRecordVisits(user)) redirect('/dashboard')
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
  if (isTherapist(user) && visit.format !== 'massage') redirect('/dashboard')

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
    massage: massageToForm(visit.massage),
    // Older visits have no stored format: infer it from saved nutrition data.
    format:
      asFormat(visit.format) ??
      (Object.values(visit.nutrition ?? {}).some((x) => x != null && x !== '') || practiceProfile(tenant) === 'nutrition' ? 'nutrition' : 'general'),
  }
  // Offer the clinic's formats, plus the visit's own if the profile changed since.
  // A programme control stays a control (its week and programme are fixed).
  let formats: ConsultFormat[] = [...formatsFor(tenant, user)].filter((f) => f !== 'program')
  if (!formats.includes(initial.format!)) formats.push(initial.format!)
  let program
  if (visit.program) {
    const enrolment = visit.program as Program
    program = await programContext({ payload, user }, enrolment, { id: String(visit.id), week: visit.programWeek ?? 0 })
    formats = ['program']
    initial.format = 'program'
    const body = (visit.body ?? {}) as Record<string, unknown>
    initial.program = {
      week: String(visit.programWeek ?? 0),
      weight: v.weightKg ? String(kgToLb(v.weightKg)) : '',
      weightUnit: 'lb',
      height: str(v.heightCm),
      heightUnit: 'cm',
      body: Object.fromEntries(
        [...METRICS.filter((m) => m.group === 'composition' || m.group === 'measures').map((m) => m.key), 'muscleMassUnit'].map((k) => [k, str(body[k])]),
      ),
    }
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
          formats={formats}
          defaultFormat={formats[0]}
          program={program}
          frequentDiagnoses={await frequentDiagnoses(payload, String(tenantID), relId(visit.doctor as User))}
          baseDate={new Date(visit.visitDate).toLocaleDateString('en-CA', { timeZone: tz })}
        />
      </AppContent>
    </>
  )
}
