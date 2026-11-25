// Caja — invoice list (design handoff «Tabla»/«Caja»): figures on top, a text
// filter (?q, server-side over the loaded rows) and two tables inside cards:
// pending balances first, then recent invoices. Same queries as before.

import Link from 'next/link'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { formatDate, formatMoney } from '@/lib/format'
import { avatarTint, initialsOf } from '@/lib/apptStatus'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { StatusBadge } from '@/components/ui-kit'
import { btnPrimary } from '@/components/primitives'
import type { Invoice, Patient } from '@/payload-types'

const CARD = 'rounded-[12px] border border-[#e7e5e4] bg-white'
const TH = 'px-3.5 py-2.5 text-left text-xs font-medium whitespace-nowrap text-[#57534e]'
const TD = 'px-3.5 py-[11px] align-middle'

function statusOf(inv: Invoice): string {
  if (inv.voided) return 'voided'
  if ((inv.balanceDue ?? 0) > 0) return (inv.amountPaid ?? 0) > 0 ? 'partial' : 'unpaid'
  return 'paid'
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={`${CARD} px-4 py-3.5`}>
      <div className="text-xs text-[#57534e]">{label}</div>
      <div className="tabular mt-0.5 text-[22px] font-medium tracking-[-.03em]">{value}</div>
    </div>
  )
}

function InvoiceTable({
  title,
  aside,
  rows,
  tenant,
  empty,
}: {
  title: string
  aside?: React.ReactNode
  rows: Invoice[]
  tenant: Parameters<typeof formatDate>[1]
  empty: React.ReactNode
}) {
  return (
    <section className={`${CARD} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {aside}
      </div>
      {rows.length === 0 ? (
        <div className="border-t border-[#f0eeec] px-4 py-5 text-sm text-[#57534e]">{empty}</div>
      ) : (
        <div className="overflow-x-auto border-t border-[#f0eeec]">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="bg-[#fafaf7]">
                <th className={TH}>Paciente</th>
                <th className={TH}>Factura</th>
                <th className={TH}>Fecha</th>
                <th className={`${TH} text-right`}>Total</th>
                <th className={`${TH} text-right`}>Saldo</th>
                <th className={TH}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const p = inv.patient as Patient
                const name = p?.name ?? 'Paciente'
                const tint = avatarTint(name)
                const money = (n: number) => formatMoney(n, { settings: { currency: inv.currency } })
                const balance = inv.balanceDue ?? 0
                const href = `/dashboard/invoices/${inv.id}`
                return (
                  <tr key={inv.id} className="border-t border-[#f0eeec] transition-colors hover:bg-[#fafaf7]">
                    <td className={TD}>
                      <Link href={href} className="flex min-w-0 items-center gap-2.5 text-[#1c1917] hover:text-[#1c1917]">
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                          style={{ background: tint.bg, color: tint.fg }}
                          aria-hidden
                        >
                          {initialsOf(name)}
                        </span>
                        <span className="truncate font-medium">{name}</span>
                      </Link>
                    </td>
                    <td className={TD}>
                      <Link href={href} className="font-mono text-[13px] text-[#1c1917] hover:text-[#0f766e]">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className={`${TD} tabular whitespace-nowrap text-[#57534e]`}>{formatDate(inv.createdAt, tenant)}</td>
                    <td className={`${TD} tabular text-right whitespace-nowrap`}>{money(inv.totalAmount ?? 0)}</td>
                    <td className={`${TD} tabular text-right font-medium whitespace-nowrap`}>
                      {balance > 0 && !inv.voided ? <span className="text-[#b45309]">{money(balance)}</span> : <span className="text-[#57534e]">—</span>}
                    </td>
                    <td className={TD}>
                      <StatusBadge status={statusOf(inv)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default async function InvoicesPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const { user, tenant } = await requireDashboardSession()
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const q = ((await searchParams)?.q ?? '').trim()

  const [pendingRes, recentRes] = await Promise.all([
    payload.find({
      collection: 'invoices',
      where: { tenant: { equals: tenantID }, balanceDue: { greater_than: 0 }, voided: { not_equals: true } },
      sort: '-createdAt',
      limit: 50,
      depth: 1,
      overrideAccess: false,
      user,
    }),
    payload.find({
      collection: 'invoices',
      where: { tenant: { equals: tenantID } },
      sort: '-createdAt',
      limit: 30,
      depth: 1,
      overrideAccess: false,
      user,
    }),
  ])
  const pending = pendingRes.docs as Invoice[]
  const pendingIds = new Set(pending.map((i) => String(i.id)))
  const recentAll = recentRes.docs as Invoice[]
  const recent = recentAll.filter((i) => !pendingIds.has(String(i.id)))
  const pendingTotal = pending.reduce((sum, i) => sum + (i.balanceDue ?? 0), 0)
  const paidRecent = recentAll.filter((i) => statusOf(i) === 'paid').length

  // Text filter: patient name or invoice number, over the rows already loaded.
  const needle = q.toLowerCase()
  const match = (i: Invoice) =>
    !needle ||
    ((i.patient as Patient)?.name ?? '').toLowerCase().includes(needle) ||
    (i.invoiceNumber ?? '').toLowerCase().includes(needle)
  const pendingShown = pending.filter(match)
  const recentShown = recent.filter(match)

  return (
    <>
      <AppHeader
        title="Caja"
        subtitle={pending.length ? `${pending.length} con saldo pendiente` : 'Sin saldos pendientes'}
        actions={
          <Link href="/dashboard/appointments" className={btnPrimary}>
            Cobrar desde la agenda
          </Link>
        }
      />
      <AppContent className="flex flex-col gap-3">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          <Kpi label="Por cobrar" value={formatMoney(pendingTotal, tenant)} />
          <Kpi label="Facturas con saldo" value={pending.length} />
          <Kpi label="Pagadas · últimas 30 facturas" value={paidRecent} />
        </div>

        <form method="get" className="flex max-w-[420px] items-center gap-2" role="search">
          <input
            name="q"
            defaultValue={q}
            placeholder="Filtrar por paciente o factura"
            aria-label="Filtrar por paciente o factura"
            className="h-10 min-w-0 flex-1 rounded-[10px] border border-[#d6d3d1] bg-white px-3 text-base outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] md:text-sm"
          />
          {q && (
            <Link href="/dashboard/invoices" className="flex h-10 items-center rounded-[10px] border border-[#d6d3d1] bg-white px-3 text-sm font-medium text-[#1c1917]">
              Quitar
            </Link>
          )}
        </form>

        <InvoiceTable
          title="Saldos pendientes"
          aside={<span className="tabular text-sm font-semibold text-[#b45309]">{formatMoney(pendingTotal, tenant)}</span>}
          rows={pendingShown}
          tenant={tenant}
          empty={q ? `Ninguna factura con saldo coincide con «${q}».` : 'Todo cobrado. Las facturas con saldo aparecerán aquí.'}
        />
        <InvoiceTable
          title="Facturas recientes"
          rows={recentShown}
          tenant={tenant}
          empty={
            q ? (
              <>
                Ninguna factura coincide con «{q}».{' '}
                <Link href="/dashboard/invoices" className="font-medium text-[#0f766e]">
                  Quitar el filtro
                </Link>
              </>
            ) : (
              <>
                Todavía no hay facturas. Se crean desde la agenda con «Cobrar consulta» al terminar una consulta.{' '}
                <Link href="/dashboard/appointments" className="font-medium text-[#0f766e]">
                  Ir a la agenda
                </Link>
              </>
            )
          }
        />
      </AppContent>
    </>
  )
}
