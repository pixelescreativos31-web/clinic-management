import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireDashboardSession, requireRole, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { getMonthlyReport } from '@/lib/reports'
import { formatMoney } from '@/lib/format'
import { PrintButton } from '@/components/PrintButton'
import { APP_NAME } from '@/lib/brand'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/**
 * Printable monthly summary (v4 spec §A.1) — A4 with the clinic letterhead, same
 * print-CSS approach as the v2 receipt/prescription routes: no PDF library, the
 * browser's "Save as PDF" does the job. Owner only, like the on-screen report.
 */
export default async function ReportPrintPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>
}) {
  const session = await requireDashboardSession()
  await requireRole(session, ['owner'])
  const { user, tenant } = session
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!

  const { year, month } = await params
  const y = Number(year)
  const m = Number(month)
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12 || y < 2000 || y > 2100) {
    notFound()
  }

  const report = await getMonthlyReport(payload, tenantID, tenant, y, m)
  const money = (n: number) => formatMoney(n, tenant)
  const pct = (n: number) => `${Math.round(n * 100)}%`
  const title = `${MONTHS[m - 1]} de ${y}`

  return (
    <main className="mx-auto w-full max-w-[190mm] bg-white px-10 py-10 text-[13px] text-ink print:max-w-none print:p-[14mm]">
      <style>{`@page { size: A4; margin: 0; } @media print { html, body { background: #fff; } }`}</style>

      {/* Toolbar — hidden when printing */}
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/dashboard/reports?y=${y}&m=${m}`} className="text-[13px] font-medium text-muted-foreground hover:text-ink">
          ‹ Volver a reportes
        </Link>
        <PrintButton />
      </div>

      {/* Letterhead */}
      <header className="flex items-start justify-between border-b border-border pb-4">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">{tenant?.name}</h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {tenant?.address && <>{tenant.address}<br /></>}
            {[tenant?.city, tenant?.country].filter(Boolean).join(', ')}
            {tenant?.phone && <><br />{tenant.phone}</>}
          </p>
        </div>
        <div className="text-end">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reporte mensual</div>
          <div className="mt-0.5 text-lg font-semibold">{title}</div>
        </div>
      </header>

      {/* Summary */}
      <section className="mt-6 grid grid-cols-4 gap-4">
        {[
          {
            label: 'Citas',
            value: String(report.appointments.total),
            hint: `${report.appointments.completed} ${report.appointments.completed === 1 ? 'atendida' : 'atendidas'} · ${pct(report.appointments.completionRate)}`,
          },
          {
            label: 'No asistieron',
            value: String(report.appointments.noShows),
            hint: `${report.appointments.cancelled} ${report.appointments.cancelled === 1 ? 'cancelada' : 'canceladas'}`,
          },
          { label: 'Pacientes nuevos', value: String(report.newPatients), hint: '' },
          {
            label: 'Ingresos cobrados',
            value: money(report.revenueCollected),
            hint: `${money(report.outstandingAdded)} de saldo pendiente nuevo`,
          },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-border p-3">
            <div className="text-[11px] font-medium text-muted-foreground">{k.label}</div>
            <div className="tabular mt-1 font-display text-xl font-semibold">{k.value}</div>
            {k.hint && <div className="mt-0.5 text-[10px] text-faint">{k.hint}</div>}
          </div>
        ))}
      </section>

      {/* Per-doctor table */}
      <section className="mt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Por médico</h2>
        {report.doctors.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Sin actividad de médicos este mes.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-y border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 text-start font-medium">Médico</th>
                <th className="py-2 text-end font-medium">Citas</th>
                <th className="py-2 text-end font-medium">Atendidas</th>
                <th className="py-2 text-end font-medium">Tasa de inasistencia</th>
                <th className="py-2 text-end font-medium">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {report.doctors.map((d) => (
                <tr key={d.id} className="border-b border-border/60">
                  <td className="py-2 font-medium">{d.name}</td>
                  <td className="tabular py-2 text-end">{d.total}</td>
                  <td className="tabular py-2 text-end">{d.completed}</td>
                  <td className="tabular py-2 text-end">{pct(d.noShowRate)}</td>
                  <td className="tabular py-2 text-end font-medium">{money(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="mt-10 border-t border-border pt-3 text-center text-[10px] text-faint">
        Generado por {APP_NAME} · {tenant?.name} · {title}
      </footer>
    </main>
  )
}
