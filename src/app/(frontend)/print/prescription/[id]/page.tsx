import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { PrintButton } from '@/components/PrintButton'
import { formatLongDate, formatDate, ageFromDOB } from '@/lib/format'
import { GENDER_LABELS, PRESCRIPTION_FREQUENCIES } from '@/lib/constants'
import { vitalsLine } from '@/lib/clinical'
import { APP_NAME } from '@/lib/brand'
import type { Patient, User, Visit } from '@/payload-types'

const relId = (v: unknown): string =>
  v && typeof v === 'object' && 'id' in (v as Record<string, unknown>) ? String((v as { id: unknown }).id) : String(v)

const FREQ_LABEL: Record<string, string> = Object.fromEntries(
  PRESCRIPTION_FREQUENCIES.map((f) => [f.value, f.label]),
)

const fmtCedula = (d: string) => (d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}` : d)

/**
 * Printable A5 prescription (receta). Browser print-to-PDF — no PDF library.
 * Letterhead carries the doctor's name, specialty and exequátur; the patient line
 * carries the identity document, as pharmacies and insurers expect in DR.
 */
export default async function PrescriptionPrintPage({ params }: { params: Promise<{ id: string }> }) {
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
  if (relId(visit.tenant) !== String(tenantID)) notFound()

  const patient = visit.patient as Patient
  const doctor = visit.doctor as User
  const rx = visit.prescription ?? []
  const age = patient?.dateOfBirth ? ageFromDOB(patient.dateOfBirth) : (patient?.ageYears ?? null)
  const vitals = vitalsLine(visit.vitals)
  const doc = patient?.documentNumber
    ? `${patient.documentType === 'passport' ? 'Pasaporte' : 'Cédula'}: ${
        patient.documentType === 'passport' ? patient.documentNumber : fmtCedula(patient.documentNumber)
      }`
    : null

  return (
    <main className="mx-auto flex min-h-[210mm] w-full max-w-[150mm] flex-col bg-white px-8 py-10 text-[13px] text-ink print:min-h-[208mm] print:max-w-none print:p-[11mm]">
      <style>{`@page { size: A5; margin: 0; } @media print { html, body { background: #fff; } }`}</style>

      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/dashboard/patients/${relId(patient)}?tab=historia`} className="text-[13px] font-medium text-muted-foreground hover:text-ink">
          ‹ Volver al paciente
        </Link>
        <PrintButton />
      </div>

      {/* Letterhead — doctor first: a prescription is issued by a person, not a clinic. */}
      <header className="flex items-start justify-between gap-4 border-b-2 border-primary pb-3">
        <div>
          <h1 className="font-display text-lg leading-tight font-semibold tracking-tight">{doctor?.name}</h1>
          {doctor?.specialty && <div className="text-xs font-medium text-primary">{doctor.specialty}</div>}
          {doctor?.licenseNumber && <div className="text-[11px] text-muted-foreground">Exequátur: {doctor.licenseNumber}</div>}
        </div>
        <div className="text-end text-[11px] leading-relaxed text-muted-foreground">
          <div className="font-semibold text-ink">{tenant?.name}</div>
          {tenant?.address && <div>{tenant.address}</div>}
          {[tenant?.city, tenant?.country].filter(Boolean).join(', ')}
          {tenant?.phone && <div>Tel.: {tenant.phone}</div>}
        </div>
      </header>

      {/* Patient */}
      <section className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-[12px]">
        <div>
          <span className="text-muted-foreground">Paciente: </span>
          <span className="font-semibold">{patient?.name}</span>
        </div>
        <div className="tabular text-end">
          <span className="text-muted-foreground">Fecha: </span>
          {formatLongDate(visit.visitDate, tenant)}
        </div>
        <div className="text-muted-foreground">
          {[
            age != null ? `${age} ${age === 1 ? 'año' : 'años'}` : null,
            patient?.gender ? GENDER_LABELS[patient.gender] : null,
            doc,
            patient?.insurance?.provider ? `${patient.insurance.provider}${patient.insurance.affiliateNumber ? ` #${patient.insurance.affiliateNumber}` : ''}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
        <div className="tabular text-end text-muted-foreground">Exp. {patient?.mrn}</div>
      </section>

      {patient?.allergies && (
        <p className="mt-2 rounded border border-red/30 px-2 py-1 text-[11px] font-medium text-red">
          Alergias: {patient.allergies}
        </p>
      )}
      {vitals && <p className="tabular mt-2 text-[11px] text-muted-foreground">{vitals}</p>}
      {visit.diagnosis && (
        <p className="mt-2 text-[12px]">
          <span className="font-semibold">Diagnóstico:</span> {visit.diagnosis}
        </p>
      )}

      {/* Rx */}
      <div className="mt-4 flex-1">
        <div className="mb-1 font-display text-2xl font-semibold text-primary">℞</div>
        {rx.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin medicamentos indicados.</p>
        ) : (
          <ol className="space-y-2.5">
            {rx.map((r, i) => (
              <li key={i} className="border-b border-border/50 pb-2">
                <div className="font-medium">
                  {i + 1}. {r.medicine}
                  {r.dosage ? <span className="font-normal text-muted-foreground"> — {r.dosage}</span> : null}
                  {r.quantity ? <span className="font-normal text-muted-foreground"> · Cant.: {r.quantity}</span> : null}
                </div>
                <div className="ms-4 text-xs text-muted-foreground">
                  {[
                    r.frequency === 'other' ? r.frequencyNote : r.frequency ? FREQ_LABEL[r.frequency] ?? r.frequency : null,
                    r.durationDays ? `por ${r.durationDays} ${r.durationDays === 1 ? 'día' : 'días'}` : null,
                    r.instructions || null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </li>
            ))}
          </ol>
        )}

        {visit.treatmentPlan && (
          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Indicaciones</div>
            <p className="mt-0.5 whitespace-pre-line text-[12px] leading-relaxed">{visit.treatmentPlan}</p>
          </div>
        )}
        {visit.labOrders && (
          <div className="mt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Estudios indicados</div>
            <p className="mt-0.5 whitespace-pre-line text-[12px] leading-relaxed">{visit.labOrders}</p>
          </div>
        )}
        {visit.followUpDate && (
          <p className="mt-3 text-[12px]">
            <span className="font-semibold">Próxima cita:</span> {formatDate(visit.followUpDate, tenant)}
          </p>
        )}
      </div>

      {/* Signature */}
      <div className="mt-10 flex justify-end">
        <div className="w-52 border-t border-ink/60 pt-1 text-center text-[11px]">
          <div className="font-medium">{doctor?.name}</div>
          {doctor?.licenseNumber && <div className="text-muted-foreground">Exequátur {doctor.licenseNumber}</div>}
        </div>
      </div>

      <footer className="mt-4 text-center text-[9px] text-faint">Generado con {APP_NAME}</footer>
    </main>
  )
}
