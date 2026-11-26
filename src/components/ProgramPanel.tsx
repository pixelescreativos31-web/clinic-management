import { regionalOf } from '@/lib/regional'
// «Programa» tab of the patient record: enrolment, summary, weight chart, weekly
// controls, measurement comparison and progress photos. Server component.

import Link from 'next/link'
import type { Payload } from 'payload'
import type { Tenant, User } from '@/payload-types'
import { StartConsultationButton } from './StartConsultationButton'
import { EnrollProgram, ProgramStatusButtons } from './ProgramActions'
import { ProgressPhotos } from './ProgressPhotos'
import { ControlsTable, MeasuresTable, WeightChart } from './ProgramTables'
import { patientPrograms, programControls, programPhotos } from '@/lib/programData'
import { bmiLabel, DEFAULT_PROGRAM_NAME, fmtDelta, fmtWeight, weekLabel } from '@/lib/program'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Activo', cls: 'border-[#0f766e] bg-[#0f766e] text-white' },
  completed: { label: 'Completado', cls: 'border-[#d6d3d1] bg-[#f0eeec] text-[#1c1917]' },
  cancelled: { label: 'Suspendido', cls: 'border-[#b45309] bg-white text-[#b45309]' },
}

/** Card of the redesign: white, 1px #e7e5e4, radius 12. */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[12px] border border-[#e7e5e4] bg-white ${className}`}>{children}</section>
}
const CARD_TITLE = 'text-[15px] font-semibold tracking-[-.01em]'
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
  const unit = regionalOf(tenant).weightUnit
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tenant?.settings?.timezone || DEFAULT_TIMEZONE })
  const programs = await patientPrograms(actor, patientId)
  const active = programs.find((p) => p.status === 'active')
  const program = programs.find((p) => String(p.id) === selected) ?? active ?? programs[0]

  const enrolCard = !active && (
    <Card className="p-4 md:p-[18px]">
      <h2 className={CARD_TITLE}>{programName}</h2>
      <p className="mt-1 mb-3.5 text-sm text-[#57534e]">
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
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 md:px-[18px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-semibold tracking-[-.01em]">{program.name}</h2>
              <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
            </div>
            <p className="tabular mt-1 text-[13px] text-[#57534e]">
              Ingreso {fmtDate(program.startDate)}
              {program.endDate ? ` · cierre ${fmtDate(program.endDate)}` : ''}
              {responsible ? ` · ${responsible}` : ''}
              {program.goal ? ` · Meta: ${program.goal}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/print/programa/${program.id}`}
              target="_blank"
              className="inline-flex h-11 items-center rounded-[10px] border border-[#d6d3d1] bg-white px-4 text-sm font-medium text-[#1c1917] transition-colors hover:bg-[#fafaf7] hover:text-[#1c1917]"
            >
              Imprimir / PDF
            </Link>
            <ProgramStatusButtons programId={String(program.id)} status={program.status} />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px border-t border-[#f0eeec] bg-[#f0eeec] sm:grid-cols-4">
          {[
            { label: 'Controles', value: rows.length ? `${rows.length} · último ${weekLabel(rows[rows.length - 1].week).toLowerCase()}` : 'Sin controles' },
            { label: 'Peso inicial', value: fmtWeight(start?.weightKg, unit) },
            { label: 'Peso actual', value: fmtWeight(last?.weightKg, unit) },
            { label: 'Cambio total', value: last && start && last !== start ? fmtDelta(last.deltaStart, unit) : '—' },
          ].map((s) => (
            <div key={s.label} className="bg-white px-4 py-3 md:px-[18px]">
              <dt className="text-xs text-[#57534e]">{s.label}</dt>
              <dd className="tabular mt-0.5 text-lg font-medium tracking-[-.02em]">{s.value}</dd>
            </div>
          ))}
        </dl>
        {last?.bmi != null && (
          <p className="tabular border-t border-[#f0eeec] px-4 py-2.5 text-[13px] text-[#57534e] md:px-[18px]">
            IMC actual {last.bmi} · {bmiLabel(last.bmi)}
          </p>
        )}

        {program.status === 'active' && (
          <div className="border-t border-[#f0eeec] px-4 py-3.5 md:px-[18px]">
            <StartConsultationButton patientId={patientId} className="sm:w-64" />
            <p className="tabular mt-1.5 text-xs text-[#57534e]">
              Abre el control de la semana {rows.length ? Math.max(...rows.map((r) => r.week)) + 1 : 0} (puede cambiar el número si es un control atrasado).
            </p>
          </div>
        )}
      </Card>

      {rows.length === 0 ? (
        <Card>
          <p className="px-5 py-8 text-center text-sm text-[#57534e]">Falta la evaluación inicial. Use «Atender ahora» para registrarla.</p>
        </Card>
      ) : (
        <>
          {weighed.length >= 2 && (
            <Card className="p-4 md:p-[18px]">
              <h3 className={`${CARD_TITLE} mb-2`}>Evolución del peso</h3>
              <WeightChart rows={rows} unit={unit} />
            </Card>
          )}
          <Card className="p-4 md:p-[18px]">
            <h3 className={`${CARD_TITLE} mb-2`}>Controles</h3>
            <ControlsTable rows={rows} unit={unit} editHref={(id) => `/dashboard/visits/${id}/edit`} />
            {rows.some((r) => r.notes) && (
              <div className="mt-4 flex flex-col gap-3 border-t border-[#f0eeec] pt-3">
                {rows
                  .filter((r) => r.notes)
                  .map((r) => (
                    <div key={r.id}>
                      <p className="tabular text-[13px] font-medium text-[#57534e]">
                        {weekLabel(r.week)} · {fmtDate(r.date)}
                      </p>
                      <p className="text-sm leading-relaxed whitespace-pre-line">{r.notes}</p>
                    </div>
                  ))}
              </div>
            )}
          </Card>
          <Card className="p-4 md:p-[18px]">
            <h3 className={`${CARD_TITLE} mb-2`}>Medidas corporales</h3>
            <MeasuresTable rows={rows} />
          </Card>
        </>
      )}

      <Card className="p-4 md:p-[18px]">
        <h3 className={`${CARD_TITLE} mb-3`}>Fotos de evolución</h3>
        <ProgressPhotos
          programId={String(program.id)}
          photos={photos.map((p) => ({ id: String(p.id), url: p.url ?? '', week: p.week, view: p.view, takenAt: p.takenAt }))}
          weeks={rows.map((r) => r.week)}
          today={today}
          canUpload={program.status === 'active' || rows.length > 0}
        />
      </Card>

      {programs.length > 1 && (
        <Card className="p-4 md:p-[18px]">
          <h3 className={`${CARD_TITLE} mb-2`}>Historial de programas</h3>
          <ul className="tabular flex flex-col gap-1.5 text-sm">
            {programs.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/patients/${patientId}?tab=programa&program=${p.id}`} className={String(p.id) === String(program.id) ? 'font-semibold text-[#1c1917]' : 'text-[#0f766e] hover:text-[#115e59]'}>
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
