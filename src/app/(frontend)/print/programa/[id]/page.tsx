import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { PrintButton } from '@/components/PrintButton'
import { ControlsTable, MeasuresTable, WeightChart } from '@/components/ProgramTables'
import { ageFromDOB, formatLongDate } from '@/lib/format'
import { isClinical } from '@/lib/practice'
import { bmiLabel, fmtDelta, fmtWeight, weekLabel } from '@/lib/program'
import { programControls } from '@/lib/programData'
import { GENDER_LABELS } from '@/lib/constants'
import type { Patient, Program, User } from '@/payload-types'

const relId = (v: unknown): string =>
  v && typeof v === 'object' && 'id' in (v as Record<string, unknown>) ? String((v as { id: unknown }).id) : String(v)
const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

/**
 * Printable follow-up sheet of a programme (Letter; «Guardar como PDF» from the
 * print dialog): patient, background, every control, measurement comparison and
 * notes. Clinical roles only.
 */
export default async function ProgramPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, tenant } = await requireDashboardSession()
  if (!isClinical(user)) redirect('/dashboard')
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const { id } = await params

  let program: Program
  try {
    program = (await payload.findByID({ collection: 'programs', id, depth: 1, overrideAccess: false, user })) as Program
  } catch {
    notFound()
  }
  if (relId(program.tenant) !== String(tenantID)) notFound()

  const patient = program.patient as Patient
  const rows = await programControls({ payload, user }, String(program.id))
  const weighed = rows.filter((r) => r.weightKg != null)
  const start = weighed[0]
  const last = weighed[weighed.length - 1]
  const age = patient?.dateOfBirth ? ageFromDOB(patient.dateOfBirth) : (patient?.ageYears ?? null)
  const h = patient?.history ?? {}
  const o = h.obstetric
  const eapc =
    patient?.gender === 'female' && o && [o.pregnancies, o.abortions, o.births, o.cesareans].some((x) => x != null)
      ? `E ${o.pregnancies ?? '—'} · A ${o.abortions ?? '—'} · P ${o.births ?? '—'} · C ${o.cesareans ?? '—'}`
      : ''
  const background: [string, string | null | undefined][] = [
    ['Patologías de la niñez', h.childhood],
    ['Patologías de la adultez', h.personal],
    ['Enfermedades crónicas', h.chronicConditions],
    ['Quirúrgicos', h.surgical],
    ['Familiares — Madre', h.familyMother],
    ['Familiares — Padre', h.familyFather],
    ['Familiares — Hermanos', h.familySiblings],
    ['Familiares — Otros', h.family],
    ['Medicamentos', h.medications],
    ['E-A-P-C', eapc],
    ['Otros antecedentes y hallazgos', h.otherFindings],
  ]
  const shownBackground = background.filter(([, v]) => v)

  return (
    <main className="mx-auto w-full max-w-[216mm] bg-white px-8 py-8 text-[12px] text-ink print:max-w-none print:p-[10mm]">
      <style>{`@page { size: letter; margin: 0; } @media print { html, body { background: #fff; } }`}</style>

      <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/dashboard/patients/${relId(patient)}?tab=programa`} className="text-[13px] font-medium text-muted-foreground hover:text-ink">
          ‹ Volver al paciente
        </Link>
        <PrintButton />
      </div>

      <header className="flex items-center justify-between gap-4 border-b-2 border-primary pb-2">
        {tenant?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logo} alt={tenant.name} className="h-14 w-auto" />
        ) : (
          <div className="font-display text-lg font-semibold">{tenant?.name}</div>
        )}
        <div className="text-end">
          <div className="text-[13px] font-bold">{program.name}</div>
          <div className="text-[10px] text-muted-foreground">Hoja de seguimiento · impresa {formatLongDate(new Date().toISOString(), tenant)}</div>
        </div>
      </header>

      <section className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
        <div><span className="text-muted-foreground">Paciente: </span><b>{patient?.name}</b> {patient?.mrn ? `(${patient.mrn})` : ''}</div>
        <div><span className="text-muted-foreground">Sexo / edad: </span>{[patient?.gender ? GENDER_LABELS[patient.gender] : null, age != null ? `${age} años` : null].filter(Boolean).join(' · ') || '—'}</div>
        <div><span className="text-muted-foreground">Teléfono: </span>{patient?.phone}</div>
        <div><span className="text-muted-foreground">Ingreso: </span>{fmtDate(program.startDate)}{program.endDate ? ` · cierre ${fmtDate(program.endDate)}` : ''}</div>
        <div><span className="text-muted-foreground">Responsable: </span>{(program.responsible as User)?.name ?? '—'}</div>
        <div><span className="text-muted-foreground">Meta: </span>{program.goal || '—'}</div>
        {patient?.allergies && <div className="col-span-2 font-semibold text-red">Alergias: {patient.allergies}</div>}
      </section>

      {shownBackground.length > 0 && (
        <section className="mt-3">
          <h2 className="text-[11px] font-bold tracking-wide text-primary uppercase">Antecedentes</h2>
          <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
            {shownBackground.map(([l, v]) => (
              <div key={l} className={l.startsWith('Otros') ? 'col-span-2' : ''}>
                <dt className="inline text-muted-foreground">{l}: </dt>
                <dd className="inline whitespace-pre-line">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mt-3 grid grid-cols-4 gap-2 rounded border border-border p-2 text-[11px]">
        <div><div className="text-muted-foreground">Peso inicial</div><b>{fmtWeight(start?.weightKg)}</b></div>
        <div><div className="text-muted-foreground">Peso actual</div><b>{fmtWeight(last?.weightKg)}</b></div>
        <div><div className="text-muted-foreground">Cambio total</div><b>{last && start && last !== start ? fmtDelta(last.deltaStart) : '—'}</b></div>
        <div><div className="text-muted-foreground">IMC actual</div><b>{last?.bmi != null ? `${last.bmi} · ${bmiLabel(last.bmi)}` : '—'}</b></div>
      </section>

      {weighed.length >= 2 && (
        <section className="mt-3 break-inside-avoid">
          <WeightChart rows={rows} />
        </section>
      )}

      <section className="mt-3">
        <h2 className="text-[11px] font-bold tracking-wide text-primary uppercase">Controles</h2>
        {rows.length ? <ControlsTable rows={rows} /> : <p className="text-muted-foreground">Sin controles registrados.</p>}
      </section>

      <section className="mt-3 break-inside-avoid">
        <h2 className="text-[11px] font-bold tracking-wide text-primary uppercase">Medidas corporales</h2>
        <MeasuresTable rows={rows} />
      </section>

      {rows.some((r) => r.notes) && (
        <section className="mt-3">
          <h2 className="text-[11px] font-bold tracking-wide text-primary uppercase">Notas de los controles</h2>
          {rows
            .filter((r) => r.notes)
            .map((r) => (
              <p key={r.id} className="mt-1 whitespace-pre-line text-[11px]">
                <b>{weekLabel(r.week)} ({fmtDate(r.date)}):</b> {r.notes}
              </p>
            ))}
        </section>
      )}

      <footer className="mt-10 grid grid-cols-2 gap-10 text-center text-[11px]">
        <div className="border-t border-ink pt-1">Firma del médico</div>
        <div className="border-t border-ink pt-1">Firma del paciente</div>
      </footer>
    </main>
  )
}
