import { notFound } from 'next/navigation'
import { requireDashboardSession, requireRole, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { getMonthlyReport } from '@/lib/reports'
import { formatMoney } from '@/lib/format'
import { Letterhead, PrintToolbar } from '../../../_components/Letterhead'
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
    <main className="mx-auto w-full max-w-[190mm] bg-white px-10 py-10 text-[13px] text-[#1c1917] print:max-w-none print:p-[14mm]">
      <style>{`@page { size: A4; margin: 0; } @media print { html, body { background: #fff; } }`}</style>

      <PrintToolbar backHref={`/dashboard/reports?y=${y}&m=${m}`} backLabel="Volver a informes" />

      <Letterhead
        logo={tenant?.logo}
        name={tenant?.name}
        details={
          <>
            {tenant?.address && <>{tenant.address}<br /></>}
            {[tenant?.city, tenant?.country].filter(Boolean).join(', ')}
            {tenant?.phone && <> · {tenant.phone}</>}
          </>
        }
        doc="Informe mensual"
        date={`${String(m).padStart(2, '0')}/${y}`}
      />
      <div className="mt-4 text-lg font-semibold tracking-[-.02em]">Resumen de {title.toLowerCase()}</div>

      {/* Summary */}
      <section className="mt-4 grid grid-cols-4 gap-3">
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
          <div key={k.label} className="rounded-lg border border-[#e7e5e4] p-3">
            <div className="text-xs text-[#57534e]">{k.label}</div>
            <div className="tabular mt-0.5 text-xl font-medium tracking-[-.03em]">{k.value}</div>
            {k.hint && <div className="mt-0.5 text-[11px] text-[#57534e]">{k.hint}</div>}
          </div>
        ))}
      </section>

      {/* Per-doctor table */}
      <section className="mt-8">
        <h2 className="text-[15px] font-semibold">Por médico</h2>
        {report.doctors.length === 0 ? (
          <p className="mt-2 text-xs text-[#57534e]">Sin actividad de médicos este mes.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[#e7e5e4] text-xs text-[#57534e]">
                <th className="py-2 text-start font-medium">Médico</th>
                <th className="py-2 text-end font-medium">Citas</th>
                <th className="py-2 text-end font-medium">Atendidas</th>
                <th className="py-2 text-end font-medium">Tasa de inasistencia</th>
                <th className="py-2 text-end font-medium">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {report.doctors.map((d) => (
                <tr key={d.id} className="border-b border-[#f0eeec]">
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

      <footer className="mt-10 border-t border-[#e7e5e4] pt-3 text-center text-[10px] text-[#78716c]">
        Generado por {APP_NAME} · {tenant?.name} · {title}
      </footer>
    </main>
  )
}
