// Monthly report (v4 spec §A.1) — owner only. Month is picked via ?y&m search
// params (server-rendered; prev/next are plain links). Defaults to the previous
// full month: that's the report an owner actually reads at month end.

import Link from 'next/link'
import { requireDashboardSession, requireRole, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { getMonthlyReport, monthRangeUtc } from '@/lib/reports'
import { formatMoney } from '@/lib/format'
import { DEFAULT_TIMEZONE } from '@/lib/constants'
import { btnGhost } from '@/components/primitives'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { RevenueChart } from '@/components/RevenueChart'
import { IconChevronLeft, IconChevronRight } from '@/components/icons'

export const dynamic = 'force-dynamic'

const CARD = 'rounded-[12px] border border-[#e7e5e4] bg-white'
const TH = 'px-3.5 py-2.5 text-left text-xs font-medium whitespace-nowrap text-[#57534e]'
const TD = 'px-3.5 py-[11px] align-middle'

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className={`${CARD} px-4 py-3.5`}>
      <div className="text-xs text-[#57534e]">{label}</div>
      <div className="tabular mt-0.5 text-[22px] font-medium tracking-[-.03em]">{value}</div>
      {hint && <div className="tabular mt-0.5 text-xs text-[#57534e]">{hint}</div>}
    </div>
  )
}

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
    <>
      <AppHeader
        title="Informes"
        subtitle="Citas, ingresos y actividad de los médicos del mes"
        actions={
          <Link href={`/print/report/${y}/${m}`} className={btnGhost}>
            Imprimir resumen
          </Link>
        }
      />
      <AppContent className="flex flex-col gap-3">
        {/* Month picker — arrows are the calendar control, the month name says where you are. */}
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/reports?y=${prev.y}&m=${prev.m}`}
            aria-label="Mes anterior"
            className="flex size-10 items-center justify-center rounded-[10px] border border-[#d6d3d1] bg-white text-[#1c1917] transition-colors hover:border-[#a8a29e]"
          >
            <IconChevronLeft size={16} />
          </Link>
          <div className="min-w-40 text-center text-[17px] font-semibold tracking-[-.02em]">
            {MONTHS[m - 1]} {y}
          </div>
          <Link
            href={nextIsFuture ? '#' : `/dashboard/reports?y=${next.y}&m=${next.m}`}
            aria-label="Mes siguiente"
            aria-disabled={nextIsFuture}
            className={`flex size-10 items-center justify-center rounded-[10px] border border-[#d6d3d1] bg-white transition-colors ${
              nextIsFuture ? 'pointer-events-none text-[#d6d3d1]' : 'text-[#1c1917] hover:border-[#a8a29e]'
            }`}
          >
            <IconChevronRight size={16} />
          </Link>
        </div>

        {empty ? (
          <div className={`${CARD} px-6 py-12 text-center`}>
            <p className="text-sm text-[#57534e]">No hay registros en {MONTHS[m - 1].toLowerCase()} de {y}.</p>
            <Link href={`/dashboard/reports?y=${prev.y}&m=${prev.m}`} className="mt-2 inline-block text-sm font-medium text-[#0f766e]">
              Ver el mes anterior
            </Link>
          </div>
        ) : (
          <>
            {/* Summary figures */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
              <Kpi
                label="Citas"
                value={report.appointments.total}
                hint={`${report.appointments.completed} ${report.appointments.completed === 1 ? 'atendida' : 'atendidas'} · ${pct(report.appointments.completionRate)} de cumplimiento`}
              />
              <Kpi
                label="No asistieron"
                value={report.appointments.noShows}
                hint={`${report.appointments.cancelled} ${report.appointments.cancelled === 1 ? 'cancelada' : 'canceladas'}`}
              />
              <Kpi label="Pacientes nuevos" value={report.newPatients} />
              <Kpi
                label="Ingresos cobrados"
                value={money(report.revenueCollected)}
                hint={`${money(report.outstandingAdded)} de saldo pendiente nuevo`}
              />
            </div>

            {/* Daily revenue */}
            <section className={`${CARD} px-[18px] py-4`}>
              <h2 className="mb-4 text-[15px] font-semibold">Ingresos diarios</h2>
              <RevenueChart data={report.daily} currency={report.currency} period={`en ${MONTHS[m - 1].toLowerCase()} de ${y}`} />
            </section>

            {/* Per-doctor table */}
            <section className={`${CARD} overflow-hidden`}>
              <div className="px-4 py-3.5 text-[15px] font-semibold">Por médico</div>
              {report.doctors.length === 0 ? (
                <p className="border-t border-[#f0eeec] px-4 py-5 text-sm text-[#57534e]">Sin actividad de médicos este mes.</p>
              ) : (
                <div className="overflow-x-auto border-t border-[#f0eeec]">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead>
                      <tr className="bg-[#fafaf7]">
                        <th className={TH}>Médico</th>
                        <th className={`${TH} text-right`}>Citas</th>
                        <th className={`${TH} text-right`}>Atendidas</th>
                        <th className={`${TH} text-right`}>Tasa de inasistencia</th>
                        <th className={`${TH} text-right`}>Ingresos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.doctors.map((d) => (
                        <tr key={d.id} className="border-t border-[#f0eeec] transition-colors hover:bg-[#fafaf7]">
                          <td className={`${TD} font-medium`}>{d.name}</td>
                          <td className={`${TD} tabular text-right`}>{d.total}</td>
                          <td className={`${TD} tabular text-right`}>{d.completed}</td>
                          <td className={`${TD} tabular text-right`}>{pct(d.noShowRate)}</td>
                          <td className={`${TD} tabular text-right font-medium whitespace-nowrap`}>{money(d.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* CSV exports — PII leaves the system, so each download is audit-logged. */}
        <section className={`${CARD} px-[18px] py-4`}>
          <h2 className="text-[15px] font-semibold">Exportar CSV</h2>
          <p className="mt-0.5 text-[13px] text-[#57534e]">
            Registros de {MONTHS[m - 1].toLowerCase()} de {y}. Las exportaciones quedan anotadas en la auditoría.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['appointments', 'patients', 'invoices'] as const).map((t) => (
              <a key={t} href={`/api/export/${t}?${range}`} className={btnGhost}>
                Exportar {EXPORT_LABELS[t].toLowerCase()}
              </a>
            ))}
          </div>
        </section>
      </AppContent>
    </>
  )
}
