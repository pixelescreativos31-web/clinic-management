// Monthly report (v4 spec §A.1) — owner only. Month is picked via ?y&m search
// params (server-rendered; prev/next are plain links). Defaults to the previous
// full month: that's the report an owner actually reads at month end.

import Link from 'next/link'
import { requireDashboardSession, requireRole, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { getMonthlyReport, monthRangeUtc } from '@/lib/reports'
import { formatMoney } from '@/lib/format'
import { DEFAULT_TIMEZONE } from '@/lib/constants'
import { Card, PageTitle, KpiCard, EmptyState, Th, Td } from '@/components/primitives'
import { RevenueChart } from '@/components/RevenueChart'
import { IconChevronLeft, IconChevronRight, IconDownload, IconPrinter } from '@/components/icons'

export const dynamic = 'force-dynamic'

/** Current month on the tenant's wall clock. */
function currentMonth(tz: string): { y: number; m: number } {
  const parts = new Date().toLocaleDateString('en-CA', { timeZone: tz }) // YYYY-MM-DD
  return { y: Number(parts.slice(0, 4)), m: Number(parts.slice(5, 7)) }
}

/** Previous full month on the tenant's wall clock. */
function previousMonth(tz: string): { y: number; m: number } {
  const { y, m } = currentMonth(tz)
  return m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>
}) {
  const session = await requireDashboardSession()
  await requireRole(session, ['owner'])
  const { user, tenant } = session
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const tz = tenant?.settings?.timezone || DEFAULT_TIMEZONE

  const fallback = previousMonth(tz)
  const sp = await searchParams
  let y = Number(sp.y) || fallback.y
  let m = Number(sp.m) || fallback.m
  if (m < 1 || m > 12 || y < 2000 || y > 2100) {
    y = fallback.y
    m = fallback.m
  }

  const report = await getMonthlyReport(payload, tenantID, tenant, y, m)
  const money = (n: number) => formatMoney(n, tenant)
  const pct = (n: number) => `${Math.round(n * 100)}%`

  // Month navigation — plain links, no client state.
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
  // The (partial) current month is viewable; anything beyond it is not.
  const cur = currentMonth(tz)
  const nextIsFuture = next.y > cur.y || (next.y === cur.y && next.m > cur.m)

  // Export links cover exactly this tenant-local month.
  const { start, end } = monthRangeUtc(tz, y, m)
  const range = `from=${start.toISOString()}&to=${end.toISOString()}`

  const EXPORT_LABELS = { appointments: 'Citas', patients: 'Pacientes', invoices: 'Facturas' } as const

  const empty = report.appointments.total === 0 && report.revenueCollected === 0 && report.newPatients === 0

  return (
    <div className="animate-fade-up">
      <PageTitle
        subtitle="Citas, ingresos y actividad de los médicos del mes."
        action={
          <Link
            href={`/print/report/${y}/${m}`}
            className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-canvas hover:text-ink"
          >
            <IconPrinter size={15} />
            Imprimir resumen
          </Link>
        }
      >
        Reportes
      </PageTitle>

      {/* Month picker */}
      <div className="mb-5 flex items-center gap-2">
        <Link
          href={`/dashboard/reports?y=${prev.y}&m=${prev.m}`}
          aria-label="Mes anterior"
          className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:bg-canvas hover:text-ink"
        >
          <IconChevronLeft size={15} />
        </Link>
        <div className="min-w-40 text-center font-display text-lg font-semibold">
          {MONTHS[m - 1]} {y}
        </div>
        <Link
          href={nextIsFuture ? '#' : `/dashboard/reports?y=${next.y}&m=${next.m}`}
          aria-label="Mes siguiente"
          aria-disabled={nextIsFuture}
          className={`flex size-8 items-center justify-center rounded-lg border border-border bg-surface transition-colors ${
            nextIsFuture
              ? 'pointer-events-none text-border'
              : 'text-muted-foreground hover:bg-canvas hover:text-ink'
          }`}
        >
          <IconChevronRight size={15} />
        </Link>
      </div>

      {empty ? (
        <Card>
          <EmptyState message={`No hay registros en ${MONTHS[m - 1].toLowerCase()} de ${y}.`} />
        </Card>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Citas"
              value={report.appointments.total}
              hint={`${report.appointments.completed} ${report.appointments.completed === 1 ? 'atendida' : 'atendidas'} · ${pct(report.appointments.completionRate)} de cumplimiento`}
            />
            <KpiCard
              label="No asistieron"
              value={report.appointments.noShows}
              hint={`${report.appointments.cancelled} ${report.appointments.cancelled === 1 ? 'cancelada' : 'canceladas'}`}
            />
            <KpiCard label="Pacientes nuevos" value={report.newPatients} />
            <KpiCard
              label="Ingresos cobrados"
              value={money(report.revenueCollected)}
              hint={`${money(report.outstandingAdded)} de saldo pendiente nuevo`}
            />
          </div>

          {/* Daily revenue */}
          <Card className="mt-5 p-5">
            <h2 className="mb-4 text-sm font-semibold">Ingresos diarios</h2>
            <RevenueChart
              data={report.daily}
              currency={report.currency}
              period={`en ${MONTHS[m - 1].toLowerCase()} de ${y}`}
            />
          </Card>

          {/* Per-doctor table */}
          <Card className="mt-5 overflow-hidden">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-sm font-semibold">Por médico</h2>
            </div>
            {report.doctors.length === 0 ? (
              <EmptyState message="Sin actividad de médicos este mes." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <Th className="ps-6">Médico</Th>
                      <Th className="text-end">Citas</Th>
                      <Th className="hidden text-end sm:table-cell">Atendidas</Th>
                      <Th className="hidden text-end sm:table-cell">Tasa de inasistencia</Th>
                      <Th className="pe-6 text-end">Ingresos</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.doctors.map((d) => (
                      <tr key={d.id} className="border-b border-border/60 last:border-0">
                        <Td className="ps-6 font-medium">{d.name}</Td>
                        <Td className="tabular text-end">{d.total}</Td>
                        <Td className="tabular hidden text-end sm:table-cell">{d.completed}</Td>
                        <Td className="tabular hidden text-end sm:table-cell">{pct(d.noShowRate)}</Td>
                        <Td className="tabular pe-6 text-end font-medium whitespace-nowrap">{money(d.revenue)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* CSV exports — PII leaves the system, so each download is audit-logged. */}
      <Card className="mt-5 p-5">
        <h2 className="text-sm font-semibold">Exportar CSV</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Registros de {MONTHS[m - 1].toLowerCase()} de {y}. Las exportaciones quedan anotadas en el registro de actividad.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['appointments', 'patients', 'invoices'] as const).map((t) => (
            <a
              key={t}
              href={`/api/export/${t}?${range}`}
              className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-canvas hover:text-ink"
            >
              <IconDownload size={14} />
              {EXPORT_LABELS[t]}
            </a>
          ))}
        </div>
      </Card>
    </div>
  )
}
