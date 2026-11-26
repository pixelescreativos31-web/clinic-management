// Ficha del paciente — design_handoff_medira: header card with the allergies
// always visible, underlined text tabs (the record's existing sections) and
// 12px cards. Permissions are unchanged: clinical tabs/cards only for the roles
// that had them, and visits are read with the user's own field-level access.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { StatusBadge } from '@/components/primitives'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { StartConsultationButton } from '@/components/StartConsultationButton'
import { GENDER_LABELS, MARITAL_STATUSES, PRESCRIPTION_FREQUENCIES } from '@/lib/constants'
import { nutritionLines, NUTRITION_GROUP_LABELS, type NutritionGroup } from '@/lib/nutrition'
import { massageAlerts, massageLines, massageServicesLine, MASSAGE_GROUP_LABELS, type MassageGroup } from '@/lib/massage'
import { hasProgram, practiceProfile } from '@/lib/profiles'
import { ProgramPanel } from '@/components/ProgramPanel'
import { bodyLine, DEFAULT_PROGRAM_NAME } from '@/lib/program'
import { NutritionFollowUp } from '@/components/NutritionFollowUp'
import { canRecordVisits, isClinical } from '@/lib/practice'
import { vitalsLine } from '@/lib/clinical'
import { ageFromDOB, formatDate, formatDateTime, formatMoney } from '@/lib/format'
import { getPatientTimeline } from '@/lib/timeline'
import type { Appointment, Invoice, Patient, User, Visit } from '@/payload-types'
import type { AppointmentStatus } from '@/lib/constants'

const HISTORY_PAGE_SIZE = 15

const fmtCedula = (d: string) => (d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}` : d)

type TabKey = 'historia' | 'programa' | 'timeline' | 'appointments' | 'invoices'
const ALL_TABS: { key: TabKey; label: string; clinicalOnly?: boolean; doctorsOnly?: boolean }[] = [
  { key: 'historia', label: 'Historia clínica', clinicalOnly: true },
  { key: 'programa', label: 'Programa', doctorsOnly: true },
  { key: 'timeline', label: 'Resumen' },
  { key: 'appointments', label: 'Citas' },
  { key: 'invoices', label: 'Facturas' },
]

const FREQ_LABEL: Record<string, string> = Object.fromEntries(
  PRESCRIPTION_FREQUENCIES.map((f) => [f.value, f.label]),
)

const BACKGROUND_FIELDS: { key: keyof NonNullable<Patient['history']>; label: string }[] = [
  { key: 'chronicConditions', label: 'Enfermedades crónicas' },
  { key: 'childhood', label: 'Patologías de la niñez' },
  { key: 'personal', label: 'Patologías de la adultez' },
  { key: 'surgical', label: 'Quirúrgicos' },
  { key: 'familyMother', label: 'Familiares — Madre' },
  { key: 'familyFather', label: 'Familiares — Padre' },
  { key: 'familySiblings', label: 'Familiares — Hermanos' },
  { key: 'family', label: 'Familiares — Otros' },
  { key: 'medications', label: 'Medicamentos actuales' },
  { key: 'habits', label: 'Hábitos' },
  { key: 'gynecoObstetric', label: 'Gineco-obstétricos' },
  { key: 'vaccines', label: 'Vacunas' },
  { key: 'otherFindings', label: 'Otros antecedentes y hallazgos' },
]

// Redesign tokens (BRIEF §9–10).
const BTN_PRIMARY =
  'inline-flex h-11 items-center justify-center rounded-[10px] bg-[#0f766e] px-[18px] text-[15px] font-medium text-white transition-colors hover:bg-[#115e59] hover:text-white'
const BTN_SECONDARY =
  'inline-flex h-11 items-center justify-center rounded-[10px] border border-[#d6d3d1] bg-white px-4 text-[15px] font-medium text-[#1c1917] transition-colors hover:bg-[#fafaf7] hover:text-[#1c1917]'
const HEADER_BTN =
  'inline-flex h-9 items-center rounded-[8px] border border-[#d6d3d1] bg-white px-3 text-[13px] font-medium text-[#1c1917] transition-colors hover:bg-[#fafaf7] hover:text-[#1c1917]'
const TEXT_LINK = 'text-[13px] font-medium text-[#0f766e] hover:text-[#115e59]'
const TAG = 'me-2 inline-block rounded-md border px-1.5 py-px align-[1px] text-xs font-semibold'

/** "E 2 · A 0 · P 1 · C 1" when any E-A-P-C count is recorded. */
function eapcLine(h: Patient['history']): string | null {
  const o = h?.obstetric
  if (!o || [o.pregnancies, o.abortions, o.births, o.cesareans].every((x) => x == null)) return null
  const f = (x?: number | null) => (x == null ? '—' : x)
  return `E ${f(o.pregnancies)} · A ${f(o.abortions)} · P ${f(o.births)} · C ${f(o.cesareans)}`
}

/** Card of the redesign: white, 1px #e7e5e4, radius 12. */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white ${className}`}>{children}</section>
}

/** Card title row (15/600) with an optional count or action on the right. */
function CardHead({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#f0eeec] px-4 py-3.5 md:px-[18px]">
      <h2 className="text-[15px] font-semibold tracking-[-.01em]">{title}</h2>
      {aside}
    </div>
  )
}

/** Labelled free-text block inside a consultation card (skips empty values). */
function Block({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-[13px] font-medium text-[#57534e]">{label}</dt>
      <dd className="tabular mt-0.5 text-[15px] leading-relaxed whitespace-pre-line">{value}</dd>
    </div>
  )
}

/** Header of a consultation card: tag + title, date · professional, text actions. */
function VisitHead({
  tag,
  title,
  meta,
  children,
}: {
  tag?: React.ReactNode
  title: string
  meta: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-[#f0eeec] px-4 py-3.5 md:px-[18px]">
      <div className="min-w-0">
        <div className="text-[15px] font-semibold tracking-[-.01em]">
          {tag}
          {title}
        </div>
        <div className="tabular text-[13px] text-[#57534e]">{meta}</div>
      </div>
      <div className="flex flex-wrap gap-4">{children}</div>
    </div>
  )
}

export default async function PatientProfile({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ hp?: string; tab?: string; program?: string }>
}) {
  const { user, tenant } = await requireDashboardSession()
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const { id } = await params
  const sp = await searchParams
  const hp = Math.max(1, Number(sp.hp) || 1)
  const clinical = isClinical(user)
  // Therapists see the record tab too, but only their massage sheets reach them
  // readable (field-level access hides the medical narrative).
  const recorder = canRecordVisits(user)
  const TABS = ALL_TABS.filter((t) => (t.doctorsOnly ? clinical && hasProgram(tenant) : recorder || !t.clinicalOnly)).map((t) =>
    t.key === 'programa' ? { ...t, label: tenant?.settings?.programName?.trim() || DEFAULT_PROGRAM_NAME } : t,
  )
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : TABS[0].key

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

  // Belt-and-suspenders: never reveal another tenant's patient.
  if (String((patient.tenant as { id?: string })?.id ?? patient.tenant) !== String(tenantID)) {
    notFound()
  }

  // Appointment history (paginated) drives the Appointments tab; its total also
  // feeds the "Citas" count in the patient data card. Always fetched (cheap).
  const history = await payload.find({
    collection: 'appointments',
    where: { tenant: { equals: tenantID }, patient: { equals: id } },
    sort: '-start',
    limit: HISTORY_PAGE_SIZE,
    page: hp,
    depth: 1,
    overrideAccess: true,
  })
  const appts = history.docs as Appointment[]

  // v2 — clinical history. Timeline tab = merged feed; Invoices tab = invoice list.
  const timeline = tab === 'timeline' ? await getPatientTimeline(payload, tenantID, id) : []
  const invoicesRes =
    tab === 'invoices'
      ? await payload.find({
          collection: 'invoices',
          where: { tenant: { equals: tenantID }, patient: { equals: id } },
          sort: '-createdAt',
          limit: 25,
          depth: 0,
          overrideAccess: true,
        })
      : null
  const invoices = (invoicesRes?.docs ?? []) as Invoice[]
  // Clinical record: consultations read WITH the user's access, so field-level
  // rules (private notes, exam) apply exactly as they do everywhere else.
  const visitsRes =
    tab === 'historia'
      ? await payload.find({
          collection: 'visits',
          where: { tenant: { equals: tenantID }, patient: { equals: id } },
          sort: '-visitDate',
          limit: 30,
          depth: 1,
          overrideAccess: false,
          user,
        })
      : null
  const visits = (visitsRes?.docs ?? []) as Visit[]
  const background = BACKGROUND_FIELDS.filter((f) => patient.history?.[f.key])
  const eapc = patient.gender === 'female' ? eapcLine(patient.history) : null
  const tabHref = (key: TabKey) => `/dashboard/patients/${id}?tab=${key}`

  const age = patient.ageYears ?? (patient.dateOfBirth ? ageFromDOB(patient.dateOfBirth) : null)
  // Weight follow-up sheet: every consultation in a nutrition practice; in mixed
  // profiles (aesthetic) only the consultations recorded in the nutrition format.
  const profile = practiceProfile(tenant)
  const nutritionVisits =
    profile === 'nutrition' ? visits.filter((v) => v.format !== 'massage') : profile === 'aesthetic' ? visits.filter((v) => v.format === 'nutrition') : []
  const shownVisits = clinical ? visits : visits.filter((v) => v.format === 'massage')
  const maritalLabel = MARITAL_STATUSES.find((m) => m.value === patient.maritalStatus)?.label
  const ageText = age != null ? `${age} ${age === 1 ? 'año' : 'años'}` : null
  const visitMeta = (v: Visit, extra = '') =>
    `${formatDateTime(v.visitDate, tenant)}${(v.doctor as User)?.name ? ` · ${(v.doctor as User).name}` : ''}${extra}`

  const details: { label: string; value: React.ReactNode }[] = [
    { label: 'Teléfono', value: <span className="tabular">{patient.phone}</span> },
    ...(patient.documentNumber
      ? [
          {
            label: patient.documentType === 'passport' ? 'Pasaporte' : patient.documentType === 'other' ? 'Documento' : 'Cédula',
            value: (
              <span className="tabular">
                {patient.documentType === 'cedula' || !patient.documentType ? fmtCedula(patient.documentNumber) : patient.documentNumber}
              </span>
            ),
          },
        ]
      : []),
    { label: 'Sexo', value: patient.gender ? GENDER_LABELS[patient.gender] : '—' },
    { label: 'Edad', value: <span className="tabular">{ageText ?? '—'}</span> },
    { label: 'Grupo sanguíneo', value: patient.bloodGroup || '—' },
    ...(patient.occupation ? [{ label: 'Ocupación', value: patient.occupation }] : []),
    ...(patient.nationality ? [{ label: 'Nacionalidad', value: patient.nationality }] : []),
    ...(maritalLabel ? [{ label: 'Estado civil', value: maritalLabel }] : []),
    ...(patient.religion ? [{ label: 'Religión', value: patient.religion }] : []),
    ...(patient.referredBy ? [{ label: 'Referido por', value: patient.referredBy }] : []),
    ...(patient.insurance?.provider
      ? [
          {
            label: 'Seguro',
            value: (
              <span className="tabular">
                {patient.insurance.provider}
                {patient.insurance.affiliateNumber ? ` · ${patient.insurance.affiliateNumber}` : ''}
              </span>
            ),
          },
        ]
      : []),
    ...(patient.emergencyContact?.name
      ? [
          {
            label: 'Emergencia',
            value: (
              <span className="tabular">
                {patient.emergencyContact.name}
                {patient.emergencyContact.phone ? ` · ${patient.emergencyContact.phone}` : ''}
              </span>
            ),
          },
        ]
      : []),
    { label: 'Citas', value: <span className="tabular">{history.totalDocs}</span> },
  ]

  return (
    <>
      <AppHeader
        title="Ficha del paciente"
        backHref="/dashboard/patients"
        actions={
          <Link href={`/dashboard/patients/${patient.id}/edit`} className={HEADER_BTN}>
            Editar
          </Link>
        }
      />
      <AppContent className="flex flex-col gap-3">
        {/* Patient header: identity, allergies always visible, main actions */}
        <Card className="px-4 py-4 md:px-5 md:py-[18px]">
          <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
            <div className="min-w-0">
              <h2 className="text-[22px] font-semibold tracking-[-.03em] md:text-2xl">{patient.name}</h2>
              <p className="tabular mt-0.5 text-sm text-[#57534e]">
                <span className="font-mono text-[13px]">{patient.mrn}</span>
                {[patient.phone, patient.gender ? GENDER_LABELS[patient.gender] : null, ageText, patient.bloodGroup, patient.insurance?.provider]
                  .filter(Boolean)
                  .map((x) => ` · ${x}`)
                  .join('')}
              </p>
              {(patient.allergies?.trim() || patient.pendingIntake) && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {patient.allergies?.trim() && (
                    <span className="rounded-md bg-[#b91c1c] px-2.5 py-1 text-[13px] font-semibold text-white" role="note">
                      Alergias: {patient.allergies}
                    </span>
                  )}
                  {patient.pendingIntake && (
                    <Link
                      href={`/dashboard/patients/${patient.id}/edit`}
                      className="rounded-md border border-[#b45309] px-2.5 py-1 text-[13px] font-medium text-[#b45309] hover:text-[#b45309]"
                    >
                      Datos por completar: falta{' '}
                      {[!patient.gender && 'el sexo', patient.ageYears == null && !patient.dateOfBirth && 'la edad'].filter(Boolean).join(' y ') ||
                        'revisar sus datos'}
                    </Link>
                  )}
                </div>
              )}
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              {recorder && <StartConsultationButton patientId={String(patient.id)} className="flex-1 sm:flex-none" />}
              <Link
                href={`/dashboard/appointments/new?patient=${patient.id}`}
                className={`${clinical ? BTN_SECONDARY : BTN_PRIMARY} flex-1 sm:flex-none`}
              >
                Agendar cita
              </Link>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-3">
            {/* Tabs: Historia clínica (clinical) · Programa · Resumen · Citas · Facturas */}
            <nav
              aria-label="Secciones del expediente"
              className="flex gap-5 overflow-x-auto border-b border-[#e7e5e4] [scrollbar-width:none]"
            >
              {TABS.map((t) => {
                const active = t.key === tab
                return (
                  <Link
                    key={t.key}
                    href={tabHref(t.key)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex h-11 flex-none items-center border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
                      active ? 'border-[#0f766e] text-[#1c1917] hover:text-[#1c1917]' : 'border-transparent text-[#57534e] hover:text-[#1c1917]'
                    }`}
                  >
                    {t.label}
                  </Link>
                )
              })}
            </nav>

            {/* Historia clínica — background + full consultation notes */}
            {tab === 'historia' && (
              <>
                {clinical && (
                  <Card>
                    <CardHead
                      title="Antecedentes"
                      aside={
                        <Link href={`/dashboard/patients/${patient.id}/edit`} className={TEXT_LINK}>
                          Editar
                        </Link>
                      }
                    />
                    {background.length === 0 && !eapc ? (
                      <p className="px-4 py-4 text-sm text-[#57534e] md:px-[18px]">Sin antecedentes registrados.</p>
                    ) : (
                      <dl className="grid gap-4 px-4 py-4 sm:grid-cols-2 md:px-[18px]">
                        {eapc && <Block label="E-A-P-C" value={eapc} />}
                        {background.map((f) => (
                          <Block key={f.key} label={f.label} value={patient.history?.[f.key] as string} />
                        ))}
                      </dl>
                    )}
                  </Card>
                )}

                {nutritionVisits.length > 0 && <NutritionFollowUp visits={nutritionVisits} tenant={tenant} />}

                {shownVisits.length === 0 ? (
                  <Card>
                    <p className="px-5 py-8 text-center text-sm text-[#57534e]">
                      Todavía no hay consultas registradas. Use «Atender ahora» para iniciar una.
                    </p>
                  </Card>
                ) : (
                  shownVisits.map((v) => {
                    const vl = vitalsLine(v.vitals)
                    if (v.format === 'program') {
                      const bl = bodyLine(v.body)
                      return (
                        <Card key={v.id}>
                          <VisitHead
                            tag={<span className={`${TAG} border-[#0f766e] text-[#0f766e]`}>Programa</span>}
                            title={v.chiefComplaint || 'Control'}
                            meta={visitMeta(v)}
                          >
                            <Link href={`/dashboard/visits/${v.id}/edit`} className={TEXT_LINK}>
                              Editar
                            </Link>
                            <Link href={tabHref('programa')} className={TEXT_LINK}>
                              Ver seguimiento
                            </Link>
                          </VisitHead>
                          <dl className="flex flex-col gap-3 px-4 py-4 md:px-[18px]">
                            {vl && <Block label="Signos vitales" value={vl} />}
                            {bl && <Block label="Composición y medidas" value={bl} />}
                            {(v.prescription?.length ?? 0) > 0 && <Block label="Receta" value={v.prescription!.map((r) => r.medicine).join('\n')} />}
                            <Block label="Plan e indicaciones" value={v.treatmentPlan} />
                            <Block label="Notas del control" value={v.notes} />
                            {v.followUpDate && <Block label="Próximo control" value={formatDate(v.followUpDate, tenant)} />}
                          </dl>
                        </Card>
                      )
                    }
                    if (v.format === 'massage') {
                      const alerts = massageAlerts(v.massage)
                      return (
                        <Card key={v.id}>
                          <VisitHead
                            tag={<span className={`${TAG} border-[#d6d3d1] text-[#57534e]`}>Masajes</span>}
                            title={massageServicesLine(v.massage) || 'Sesión'}
                            meta={visitMeta(v, v.massage?.consent ? ' · consentimiento aceptado' : '')}
                          >
                            <Link href={`/dashboard/visits/${v.id}/edit`} className={TEXT_LINK}>
                              Editar
                            </Link>
                            <Link href={`/print/ficha/${v.id}`} target="_blank" className={TEXT_LINK}>
                              Imprimir ficha
                            </Link>
                          </VisitHead>
                          <dl className="flex flex-col gap-3 px-4 py-4 md:px-[18px]">
                            {alerts.length > 0 && <Block label="Atención" value={alerts.join('\n')} />}
                            {(['servicio', 'lesiones', 'evaluacion'] as MassageGroup[]).map((g) => {
                              const lines = massageLines(v.massage, g)
                              return lines.length ? (
                                <Block key={g} label={MASSAGE_GROUP_LABELS[g]} value={lines.map((l) => `${l.label}: ${l.value}`).join('\n')} />
                              ) : null
                            })}
                            {v.followUpDate && <Block label="Próxima sesión" value={formatDate(v.followUpDate, tenant)} />}
                          </dl>
                        </Card>
                      )
                    }
                    return (
                      <Card key={v.id}>
                        <VisitHead title={v.diagnosis || v.chiefComplaint || 'Consulta'} meta={visitMeta(v)}>
                          <Link href={`/dashboard/visits/${v.id}/edit`} className={TEXT_LINK}>
                            Editar
                          </Link>
                          <Link href={`/print/prescription/${v.id}`} target="_blank" className={TEXT_LINK}>
                            Imprimir receta
                          </Link>
                        </VisitHead>
                        <dl className="flex flex-col gap-3 px-4 py-4 md:px-[18px]">
                          <Block label="Motivo de consulta" value={v.chiefComplaint} />
                          <Block label="Historia de la enfermedad actual" value={v.symptoms} />
                          {vl && <Block label="Signos vitales" value={vl} />}
                          {(['antropometria', 'interrogatorio', 'laboratorio', 'seguimiento'] as NutritionGroup[]).map((g) => {
                            const lines = nutritionLines(v.nutrition, g)
                            return lines.length ? (
                              <Block key={g} label={NUTRITION_GROUP_LABELS[g]} value={lines.map((l) => `${l.label}: ${l.value}`).join('\n')} />
                            ) : null
                          })}
                          <Block label="Examen físico" value={v.physicalExam} />
                          <Block label="Diagnóstico" value={v.diagnosis} />
                          {(v.prescription?.length ?? 0) > 0 && (
                            <div>
                              <dt className="text-[13px] font-medium text-[#57534e]">Receta</dt>
                              <dd className="mt-1">
                                <ul className="tabular space-y-1 text-[15px]">
                                  {v.prescription!.map((r, i) => (
                                    <li key={i}>
                                      <span className="font-medium">{r.medicine}</span>
                                      {[
                                        r.dosage,
                                        r.frequency ? (r.frequency === 'other' ? r.frequencyNote : FREQ_LABEL[r.frequency]) : null,
                                        r.durationDays ? `${r.durationDays} días` : null,
                                        r.instructions,
                                      ]
                                        .filter(Boolean)
                                        .map((x) => ` · ${x}`)
                                        .join('')}
                                    </li>
                                  ))}
                                </ul>
                              </dd>
                            </div>
                          )}
                          <Block label="Plan e indicaciones" value={v.treatmentPlan} />
                          <Block label="Estudios indicados" value={v.labOrders} />
                          <Block label="Nota personal" value={v.notes} />
                          {v.followUpDate && <Block label="Próxima cita" value={formatDate(v.followUpDate, tenant)} />}
                        </dl>
                      </Card>
                    )
                  })
                )}
              </>
            )}

            {tab === 'programa' && (
              <ProgramPanel payload={payload} user={user} tenant={tenant} patientId={String(patient.id)} selected={sp.program} />
            )}

            {/* Timeline tab — merged chronological feed */}
            {tab === 'timeline' && (
              <Card>
                <CardHead title="Resumen" aside={<span className="tabular text-[13px] text-[#57534e]">{timeline.length}</span>} />
                {timeline.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-[#57534e]">Todavía no hay registros.</p>
                ) : (
                  <ul>
                    {timeline.map((e) => (
                      <li
                        key={`${e.kind}-${e.id}`}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#f0eeec] px-4 py-3 text-sm first:border-t-0 sm:flex-nowrap sm:gap-4 md:px-[18px]"
                      >
                        <span className="tabular basis-full text-[13px] text-[#57534e] sm:w-44 sm:shrink-0 sm:basis-auto">
                          {formatDateTime(e.at, tenant)}
                        </span>
                        {e.kind === 'visit' && (
                          <>
                            <span className="min-w-0 flex-1 truncate">
                              <span className={`${TAG} ${e.massage ? 'border-[#d6d3d1] text-[#57534e]' : 'border-[#0f766e] text-[#0f766e]'}`}>
                                {e.massage ? 'Masajes' : 'Consulta'}
                              </span>
                              <span className="font-medium">{e.diagnosis || (e.massage ? 'Sesión' : 'Consulta')}</span>
                              {e.doctorName && <span className="text-[#57534e]"> · {e.doctorName}</span>}
                            </span>
                            {e.rxCount > 0 && (
                              <span className="tabular shrink-0 text-[13px] text-[#57534e]">
                                {e.rxCount} {e.rxCount === 1 ? 'medicamento' : 'medicamentos'}
                              </span>
                            )}
                            <Link
                              href={e.massage ? `/print/ficha/${e.id}` : `/print/prescription/${e.id}`}
                              target="_blank"
                              className={`${TEXT_LINK} shrink-0`}
                            >
                              {e.massage ? 'Imprimir ficha' : 'Imprimir receta'}
                            </Link>
                          </>
                        )}
                        {e.kind === 'invoice' && (
                          <Link
                            href={`/dashboard/invoices/${e.id}`}
                            className="flex min-w-0 flex-1 items-center gap-3 text-[#1c1917] hover:text-[#0f766e]"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              <span className={`${TAG} border-[#d6d3d1] text-[#57534e]`}>Factura</span>
                              <span className="tabular font-medium">{e.invoiceNumber}</span>
                              <span className="tabular text-[#57534e]">
                                {' · '}
                                {formatMoney(e.amount, { settings: { currency: e.currency } })}
                              </span>
                            </span>
                            <StatusBadge status={e.status} />
                          </Link>
                        )}
                        {e.kind === 'appointment' && (
                          <>
                            <span className="min-w-0 flex-1 truncate">
                              <span className={`${TAG} border-[#d6d3d1] text-[#57534e]`}>Cita</span>
                              {e.doctorName && <span className="font-medium">{e.doctorName}</span>}
                              {e.reason && <span className="text-[#57534e]"> · {e.reason}</span>}
                            </span>
                            <StatusBadge status={e.status} />
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}

            {/* Appointments tab — full paginated history */}
            {tab === 'appointments' && (
              <Card>
                <CardHead title="Historial de citas" aside={<span className="tabular text-[13px] text-[#57534e]">{history.totalDocs}</span>} />
                {appts.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-[#57534e]">
                    Todavía no hay citas.{' '}
                    <Link href={`/dashboard/appointments/new?patient=${id}`} className="font-medium text-[#0f766e] hover:text-[#115e59]">
                      Agendar una
                    </Link>
                  </p>
                ) : (
                  <ul>
                    {appts.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#f0eeec] px-4 py-3 text-sm first:border-t-0 sm:flex-nowrap sm:gap-4 md:px-[18px]"
                      >
                        <span className="tabular basis-full text-[13px] text-[#57534e] sm:w-44 sm:shrink-0 sm:basis-auto">
                          {formatDateTime(a.start, tenant)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium">{(a.doctor as User)?.name}</span>
                          {a.reason && <span className="text-[#57534e]"> · {a.reason}</span>}
                        </span>
                        <StatusBadge status={a.status as AppointmentStatus} />
                      </li>
                    ))}
                  </ul>
                )}
                {history.totalPages > 1 && (
                  <div className="flex items-center justify-between gap-3 border-t border-[#f0eeec] px-4 py-2.5 md:px-[18px]">
                    <span className="tabular text-[13px] text-[#57534e]">
                      Página {history.page} de {history.totalPages}
                    </span>
                    <div className="flex gap-4">
                      {history.hasPrevPage && (
                        <Link href={`/dashboard/patients/${id}?tab=appointments&hp=${hp - 1}`} className={TEXT_LINK}>
                          Más recientes
                        </Link>
                      )}
                      {history.hasNextPage && (
                        <Link href={`/dashboard/patients/${id}?tab=appointments&hp=${hp + 1}`} className={TEXT_LINK}>
                          Anteriores
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Invoices tab — billing history */}
            {tab === 'invoices' && (
              <Card>
                <CardHead title="Facturas" aside={<span className="tabular text-[13px] text-[#57534e]">{invoicesRes?.totalDocs ?? 0}</span>} />
                {invoices.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-[#57534e]">Todavía no hay facturas.</p>
                ) : (
                  <ul>
                    {invoices.map((inv) => (
                      <li key={inv.id} className="border-t border-[#f0eeec] first:border-t-0">
                        <Link
                          href={`/dashboard/invoices/${inv.id}`}
                          className="flex min-h-[52px] items-center gap-3 px-4 py-3 text-sm text-[#1c1917] hover:bg-[#fafaf7] hover:text-[#1c1917] md:px-[18px]"
                        >
                          <span className="w-24 shrink-0 font-mono text-[13px] font-medium">{inv.invoiceNumber}</span>
                          <span className="tabular min-w-0 flex-1 truncate text-[#57534e]">
                            {formatMoney(inv.totalAmount ?? 0, { settings: { currency: inv.currency } })}
                          </span>
                          <StatusBadge status={inv.voided ? 'voided' : (inv.paymentStatus ?? 'unpaid')} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>

          {/* Patient data — right column on wide screens, after the record on phone */}
          <div className="flex flex-col gap-3">
            <Card>
              <CardHead title="Datos del paciente" />
              <dl>
                {details.map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[minmax(0,.8fr)_minmax(0,1fr)] gap-3 border-t border-[#f0eeec] px-4 py-2.5 text-sm first:border-t-0 md:px-[18px]"
                  >
                    <dt className="text-[#57534e]">{row.label}</dt>
                    <dd className="min-w-0 break-words">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            {patient.notes && (
              <Card>
                <CardHead title="Notas" />
                <p className="px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-[#1c1917] md:px-[18px]">{patient.notes}</p>
              </Card>
            )}
          </div>
        </div>
      </AppContent>
    </>
  )
}
