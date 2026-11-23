// «Programa» tab of the patient record: enrolment, summary, weight chart, weekly
// controls, measurement comparison and progress photos. Server component.

import Link from 'next/link'
import type { Payload } from 'payload'
import type { Tenant, User } from '@/payload-types'
import { Card } from './primitives'
import { IconPrinter } from './icons'
import { StartConsultationButton } from './StartConsultationButton'
import { EnrollProgram, ProgramStatusButtons } from './ProgramActions'
import { ProgressPhotos } from './ProgressPhotos'
import { ControlsTable, MeasuresTable, WeightChart } from './ProgramTables'
import { patientPrograms, programControls, programPhotos } from '@/lib/programData'
import { bmiLabel, DEFAULT_PROGRAM_NAME, fmtDelta, fmtWeight, weekLabel } from '@/lib/program'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Activo', cls: 'bg-[#e6f1ee] text-[#0d6e60]' },
  completed: { label: 'Completado', cls: 'bg-[#eef1f1] text-[#15201e]' },
  cancelled: { label: 'Suspendido', cls: 'bg-amber-soft text-amber' },
}
const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

export async function ProgramPanel({
  payload,
  user,
  tenant,
  patientId,
  selected,
}: {
  payload: Payload
  user: User
  tenant: Tenant | null
  patientId: string
  /** ?program=<id> to view an earlier (closed) enrolment. */
  selected?: string
}) {
  const actor = { payload, user }
  const programName = tenant?.settings?.programName?.trim() || DEFAULT_PROGRAM_NAME
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tenant?.settings?.timezone || DEFAULT_TIMEZONE })
  const programs = await patientPrograms(actor, patientId)
  const active = programs.find((p) => p.status === 'active')
  const program = programs.find((p) => String(p.id) === selected) ?? active ?? programs[0]

  const enrolCard = !active && (
    <Card className="p-5">
      <h2 className="text-sm font-semibold">{programName}</h2>
      <p className="mb-3 mt-1 text-[13px] text-muted-foreground">
        {programs.length ? 'El paciente no tiene un programa activo.' : 'El paciente no está inscrito.'} Al inscribirlo se abre la evaluación inicial (semana 0); luego cada
        consulta registra el control de la semana siguiente.
      </p>
      <EnrollProgram patientId={patientId} programName={programName} today={today} />
    </Card>
  )
  if (!program) return enrolCard

  const rows = await programControls(actor, String(program.id))
  const photos = await programPhotos(actor, String(program.id))
  const weighed = rows.filter((r) => r.weightKg != null)
  const start = weighed[0]
  const last = weighed[weighed.length - 1]
  const st = STATUS[program.status] ?? STATUS.active
  const responsible = program.responsible && typeof program.responsible === 'object' ? (program.responsible as User).name : null

  return (
    <>
      {enrolCard}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{program.name}</h2>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${st.cls}`}>{st.label}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Ingreso {fmtDate(program.startDate)}
              {program.endDate ? ` · cierre ${fmtDate(program.endDate)}` : ''}
              {responsible ? ` · ${responsible}` : ''}
              {program.goal ? ` · Meta: ${program.goal}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/print/programa/${program.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <IconPrinter size={13} /> Imprimir / PDF
            </Link>
            <ProgramStatusButtons programId={String(program.id)} status={program.status} />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          {[
            { label: 'Controles', value: rows.length ? `${rows.length} · último ${weekLabel(rows[rows.length - 1].week).toLowerCase()}` : 'Sin controles' },
            { label: 'Peso inicial', value: fmtWeight(start?.weightKg) },
            { label: 'Peso actual', value: fmtWeight(last?.weightKg) },
            { label: 'Cambio total', value: last && start && last !== start ? fmtDelta(last.deltaStart) : '—' },
          ].map((s) => (
            <div key={s.label} className="bg-card px-5 py-3">
              <dt className="text-[11px] text-muted-foreground">{s.label}</dt>
              <dd className="tabular mt-0.5 text-sm font-semibold">{s.value}</dd>
            </div>
          ))}
        </dl>
        {last?.bmi != null && (
          <p className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
            IMC actual {last.bmi} · {bmiLabel(last.bmi)}
          </p>
        )}

        {program.status === 'active' && (
          <div className="border-t border-border px-5 py-3">
            <StartConsultationButton patientId={patientId} className="sm:w-64" />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Abre el control de la semana {rows.length ? Math.max(...rows.map((r) => r.week)) + 1 : 0} (puede cambiar el número si es un control atrasado).
            </p>
          </div>
        )}
      </Card>

      {rows.length === 0 ? (
        <Card>
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Falta la evaluación inicial. Use «Atender ahora» para registrarla.</p>
        </Card>
      ) : (
        <>
          {weighed.length >= 2 && (
            <Card className="p-5">
              <WeightChart rows={rows} />
            </Card>
          )}
          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold">Controles</h3>
            <ControlsTable rows={rows} editHref={(id) => `/dashboard/visits/${id}/edit`} />
            {rows.some((r) => r.notes) && (
              <div className="mt-4 flex flex-col gap-2">
                {rows
                  .filter((r) => r.notes)
                  .map((r) => (
                    <div key={r.id}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {weekLabel(r.week)} · {fmtDate(r.date)}
                      </p>
                      <p className="whitespace-pre-line text-[13px] leading-relaxed">{r.notes}</p>
                    </div>
                  ))}
              </div>
            )}
          </Card>
          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold">Medidas corporales</h3>
            <MeasuresTable rows={rows} />
          </Card>
        </>
      )}

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Fotos de evolución</h3>
        <ProgressPhotos
          programId={String(program.id)}
          photos={photos.map((p) => ({ id: String(p.id), url: p.url ?? '', week: p.week, view: p.view, takenAt: p.takenAt }))}
          weeks={rows.map((r) => r.week)}
          today={today}
          canUpload={program.status === 'active' || rows.length > 0}
        />
      </Card>

      {programs.length > 1 && (
        <Card className="p-5">
          <h3 className="mb-2 text-sm font-semibold">Historial de programas</h3>
          <ul className="flex flex-col gap-1 text-[13px]">
            {programs.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/patients/${patientId}?tab=programa&program=${p.id}`} className={String(p.id) === String(program.id) ? 'font-semibold' : 'text-primary hover:underline'}>
                  {p.name} · {fmtDate(p.startDate)}
                  {p.endDate ? ` – ${fmtDate(p.endDate)}` : ''} · {STATUS[p.status]?.label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
