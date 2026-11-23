import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { PrintButton } from '@/components/PrintButton'
import { ageFromDOB, formatLongDate } from '@/lib/format'
import { APP_NAME } from '@/lib/brand'
import { CONSENT_TEXT, MASSAGE_FIELDS, MASSAGE_GROUP_LABELS, YES_NO_OPTIONS, massageServicesLine, type MassageGroup } from '@/lib/massage'
import type { Patient, User, Visit } from '@/payload-types'

const relId = (v: unknown): string =>
  v && typeof v === 'object' && 'id' in (v as Record<string, unknown>) ? String((v as { id: unknown }).id) : String(v)

const fmtCedula = (d: string) => (d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}` : d)

/**
 * Printable massage sheet (Letter): every question with its answer — not only the
 * «Sí» ones — plus the consent text and signature lines, so the clinic keeps a
 * signed paper copy like the form it replaces.
 */
export default async function MassageSheetPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, tenant } = await requireDashboardSession()
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const { id } = await params

  let visit: Visit
  try {
    visit = (await payload.findByID({ collection: 'visits', id, depth: 1, overrideAccess: false, user })) as Visit
  } catch {
    notFound()
  }
  if (relId(visit.tenant) !== String(tenantID) || visit.format !== 'massage') notFound()

  const m = (visit.massage ?? {}) as Record<string, unknown>
  const patient = visit.patient as Patient
  const therapist = visit.doctor as User
  const age = patient?.dateOfBirth ? ageFromDOB(patient.dateOfBirth) : (patient?.ageYears ?? null)
  const group = (g: MassageGroup) => MASSAGE_FIELDS.filter((f) => f.group === g)
  const label = (opts: { value: string; label: string }[] | undefined, v: unknown) => opts?.find((o) => o.value === v)?.label ?? ''
  const text = (v: unknown) => (v == null ? '' : String(v))

  const yesNoTable = (g: MassageGroup) => (
    <table className="mt-1 w-full border-collapse text-[11px]">
      <tbody>
        {group(g)
          .filter((f) => f.kind === 'yesno')
          .map((f) => (
            <tr key={f.key} className="border-b border-border/60">
              <td className="w-[46%] py-1 pe-2">{f.label}</td>
              <td className="w-[10%] py-1 text-center font-semibold">{label(YES_NO_OPTIONS, m[f.key]) || '—'}</td>
              <td className="py-1 ps-2 text-muted-foreground">{text(m[`${f.key}Detail`])}</td>
            </tr>
          ))}
      </tbody>
    </table>
  )
  const line = (l: string, v: string) => (
    <div className="flex gap-1.5 text-[11px]">
      <span className="shrink-0 text-muted-foreground">{l}:</span>
      <span className="min-w-0 flex-1 border-b border-border/70 font-medium whitespace-pre-line">{v || ' '}</span>
    </div>
  )
  const H = ({ g }: { g: MassageGroup }) => (
    <h2 className="mt-3 text-[11px] font-bold tracking-wide text-primary uppercase">{MASSAGE_GROUP_LABELS[g]}</h2>
  )

  return (
    <main className="mx-auto w-full max-w-[216mm] bg-white px-8 py-8 text-[12px] text-ink print:max-w-none print:p-[10mm]">
      <style>{`@page { size: letter; margin: 0; } @media print { html, body { background: #fff; } }`}</style>

      <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/dashboard/patients/${relId(patient)}?tab=historia`} className="text-[13px] font-medium text-muted-foreground hover:text-ink">
          ‹ Volver al cliente
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
          <div className="text-[13px] font-bold">Ficha técnica del cliente</div>
          <div className="text-[10px] text-muted-foreground">Evaluación y consentimiento para masajes</div>
        </div>
      </header>

      <H g="servicio" />
      <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1">
        {line('Nombre', patient?.name ?? '')}
        {line('Fecha', formatLongDate(visit.visitDate, tenant))}
        {line('Edad', age != null ? String(age) : '')}
        {line('Cédula', patient?.documentNumber ? fmtCedula(patient.documentNumber) : '')}
        {line('Teléfono', patient?.phone ?? '')}
        {line('Contacto de emergencia', [patient?.emergencyContact?.name, patient?.emergencyContact?.phone].filter(Boolean).join(' · '))}
        {line('Ocupación', patient?.occupation ?? '')}
        {line('Correo', patient?.email ?? '')}
      </div>
      <div className="mt-2 flex flex-col gap-1">
        {line('Servicio(s)', massageServicesLine(m))}
        {line('Zona(s) a trabajar', text(m.zones))}
        {line(
          'Objetivo',
          [...(Array.isArray(m.goals) ? (m.goals as string[]) : []).map((g) => label(group('servicio').find((f) => f.key === 'goals')!.options, g)), text(m.goalOther)]
            .filter(Boolean)
            .join(', '),
        )}
        <div className="grid grid-cols-2 gap-x-6">
          {line('Fecha de cirugía', text(m.surgeryDate).split('-').reverse().join('/'))}
          {line('Autorización médica', label(group('servicio').find((f) => f.key === 'medicalAuthorization')!.options, m.medicalAuthorization))}
        </div>
      </div>

      <H g="salud" />
      {yesNoTable('salud')}

      <H g="lesiones" />
      {yesNoTable('lesiones')}
      <div className="mt-1 grid grid-cols-2 gap-x-6">
        {line('Intensidad (0–10)', text(m.painIntensity))}
        {line('Desde cuándo', text(m.painSince))}
      </div>
      <div className="mt-1">{line('Zonas sensibles / que no desea que se toquen', text(m.sensitiveAreas))}</div>

      <H g="alergias" />
      {yesNoTable('alergias')}
      <div className="mt-1">{line('Productos u olores que prefiere evitar', text(m.avoidProducts))}</div>

      <H g="evaluacion" />
      <div className="mt-1 flex flex-col gap-1">
        {line('Observaciones de la piel y zonas a tratar', text(m.skinObservations))}
        {line('Presión recomendada', label(group('evaluacion').find((f) => f.key === 'pressure')!.options, m.pressure))}
        {line('Precauciones / zonas a evitar', text(m.precautions))}
        {line('¿Posponer o pedir autorización médica?', [label(YES_NO_OPTIONS, m.postpone), text(m.postponeDetail)].filter(Boolean).join(' — '))}
        {line('Notas de la sesión', text(m.sessionNotes))}
        {line('Profesional', therapist?.name ?? '')}
      </div>

      <H g="consentimiento" />
      <p className="mt-1 text-justify text-[9.5px] leading-snug text-muted-foreground">{CONSENT_TEXT}</p>
      <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-8 text-center text-[10px]">
        <div className="border-t border-ink/60 pt-1">Firma del cliente · {patient?.name}</div>
        <div className="border-t border-ink/60 pt-1">Firma del terapeuta · {therapist?.name}</div>
        {m.guardianName ? <div className="col-span-2 mx-auto w-1/2 border-t border-ink/60 pt-1">Padre, madre o tutor · {text(m.guardianName)}</div> : null}
      </div>
      <p className="mt-4 text-[9px] text-muted-foreground">
        La ficha se revisa y actualiza antes de cada tratamiento. Ante condición médica, lesión, quemadura, cirugía reciente, dolor inexplicado o reacción
        alérgica se valora la seguridad del servicio y se solicita autorización de un profesional de salud cuando corresponda.
      </p>
      <footer className="mt-3 text-center text-[9px] text-faint">Generado con {APP_NAME}</footer>
    </main>
  )
}
