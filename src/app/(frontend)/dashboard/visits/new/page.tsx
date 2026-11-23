import { notFound, redirect } from 'next/navigation'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { Card, EmptyState } from '@/components/primitives'
import { IconCheck } from '@/components/icons'
import { formatsFor, initialFormat } from '@/lib/profiles'
import { activeProgram, programContext } from '@/lib/programData'
import { canRecordVisits } from '@/lib/practice'
import { massageToForm } from '@/lib/massage'
import type { Visit } from '@/payload-types'
import { VisitForm } from '@/components/VisitForm'
import { PostVisitActions } from '@/components/PostVisitActions'
import { VISIT_ALLOWED_APPOINTMENT_STATUSES } from '@/lib/constants'
import type { Appointment, Patient, User } from '@/payload-types'
import { backgroundLine, frequentDiagnoses } from '@/lib/clinical'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { minutesInTz } from '@/lib/availability'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

const relId = (v: unknown): string =>
  v && typeof v === 'object' && 'id' in (v as Record<string, unknown>) ? String((v as { id: unknown }).id) : String(v)

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams: Promise<{ appointment?: string }>
}) {
  const { user, tenant } = await requireDashboardSession()
  // Only clinical roles and therapists author visits.
  if (!canRecordVisits(user)) redirect('/dashboard/appointments')

  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const appointmentId = (await searchParams).appointment
  if (!appointmentId) notFound()

  let appt: Appointment
  try {
    appt = (await payload.findByID({ collection: 'appointments', id: appointmentId, depth: 1, overrideAccess: false, user })) as Appointment
  } catch {
    notFound()
  }
  if (relId(appt.tenant) !== String(tenantID)) notFound()

  const tz = tenant?.settings?.timezone || DEFAULT_TIMEZONE
  const patientName = (appt.patient as Patient)?.name ?? 'Paciente'
  const startMin = minutesInTz(new Date(appt.start), tz)
  const header = (
    <AppHeader
      title={formatsFor(tenant, user)[0] === 'massage' && formatsFor(tenant, user).length === 1 ? 'Sesión' : 'Consulta'}
      subtitle={`${patientName} · ${Math.floor(startMin / 60) % 12 || 12}:${String(startMin % 60).padStart(2, '0')}`}
      backHref="/dashboard/appointments"
    />
  )

  // Guard: a visit needs a checked-in / completed appointment.
  if (!VISIT_ALLOWED_APPOINTMENT_STATUSES.includes(appt.status as never)) {
    return (
      <>
        {header}
        <AppContent>
          <Card>
            <EmptyState message="Registre la llegada del paciente antes de iniciar la consulta." actionHref="/dashboard/appointments" actionLabel="Volver a la agenda" />
          </Card>
        </AppContent>
      </>
    )
  }

  // One visit per appointment — if it already exists, point there.
  const existing = await payload.find({
    collection: 'visits',
    where: { appointment: { equals: appointmentId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const patient = appt.patient as Patient
  // A visit already exists (either pre-existing, or we just recorded one and the
  // route re-rendered) — show a "what's next" panel rather than a dead end.
  if (existing.totalDocs > 0) {
    return (
      <>
        {header}
        <AppContent>
        <Card className="mx-auto max-w-[720px] p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <IconCheck size={22} />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Consulta registrada</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            La consulta de {patient?.name ?? 'el paciente'} quedó guardada.
          </p>
          <PostVisitActions visitId={String(existing.docs[0].id)} patientId={relId(patient)} />
        </Card>
        </AppContent>
      </>
    )
  }

  const doctorId = relId(appt.doctor as User)
  const formats = formatsFor(tenant, user)
  // A new massage sheet starts from the client's previous one (health answers
  // must be re-confirmed each session, not re-typed). Session-specific fields reset.
  let massagePrefill
  if (formats.includes('massage')) {
    const prev = await payload.find({
      collection: 'visits',
      where: { tenant: { equals: tenantID }, patient: { equals: relId(patient) }, format: { equals: 'massage' } },
      sort: '-visitDate',
      limit: 1,
      depth: 0,
      overrideAccess: false,
      user,
    })
    const last = prev.docs[0] as Visit | undefined
    if (last?.massage) {
      massagePrefill = massageToForm(last.massage)
      for (const k of ['services', 'servicesOther', 'sessionNotes', 'skinObservations', 'consent']) {
        massagePrefill[k] = k === 'services' ? [] : ''
      }
    }
  }
  // Patient in an active programme: the consultation opens on its next control.
  const enrolled = formats.includes('program') ? await activeProgram({ payload, user }, relId(patient)) : null
  const program = enrolled ? await programContext({ payload, user }, enrolled) : undefined
  const apptDate = new Date(appt.start).toLocaleDateString('en-CA', { timeZone: tz })
  return (
    <>
      {header}
      <AppContent>
        <VisitForm
          appointmentId={String(appt.id)}
          allergies={patient?.allergies}
          background={backgroundLine(patient)}
          formats={formats}
          defaultFormat={initialFormat(formats, { activeProgram: Boolean(program), userDefault: user.defaultFormat })}
          program={program}
          massagePrefill={massagePrefill}
          frequentDiagnoses={await frequentDiagnoses(payload, String(tenantID), doctorId)}
          // The consultation is dated when it's saved (Visits hook), so follow-up
          // chips count from today, matching the edit screen.
          baseDate={new Date().toLocaleDateString('en-CA', { timeZone: tz })}
          returnHref={`/dashboard/appointments?date=${apptDate}`}
        />
      </AppContent>
    </>
  )
}
