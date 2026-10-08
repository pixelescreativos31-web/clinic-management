// Cobros — invoice list behind the «Cobros» tab (design handoff shell). Pending
// balances first, then recent invoices. The invoice screen itself (Cobrar) is
// the next redesign step.

import Link from 'next/link'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { formatDate, formatMoney } from '@/lib/format'
import { avatarTint, initialsOf } from '@/lib/apptStatus'
import { AppHeader, AppContent } from '@/components/AppHeader'
import type { Invoice, Patient } from '@/payload-types'

function Row({ inv, tenant }: { inv: Invoice; tenant: Parameters<typeof formatDate>[1] }) {
  const p = inv.patient as Patient
  const name = p?.name ?? 'Paciente'
  const tint = avatarTint(name)
  const money = (n: number) => formatMoney(n, { settings: { currency: inv.currency } })
  const balance = inv.balanceDue ?? 0
  const status = inv.voided
    ? { label: 'Anulada', bg: '#eef1f1', fg: '#6b7577' }
    : balance > 0
      ? { label: (inv.amountPaid ?? 0) > 0 ? 'Pago parcial' : 'Pendiente', bg: '#faf3e6', fg: '#b45309' }
      : { label: 'Pagada', bg: '#e8f4ec', fg: '#1a7a50' }
  return (
    <Link
      href={`/dashboard/invoices/${inv.id}`}
      className="flex min-h-[60px] items-center gap-3 border-b border-[#eef1f1] px-4 py-3 text-[#15201e] last:border-0 hover:bg-[#fafbfb] hover:text-[#15201e]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: tint.bg, color: tint.fg }}>
        {initialsOf(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{name}</span>
        <span className="tabular block truncate text-xs text-[#6b7577]">
          {inv.invoiceNumber} · {formatDate(inv.createdAt, tenant)} · {money(inv.totalAmount ?? 0)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {balance > 0 && !inv.voided && <span className="tabular text-sm font-semibold text-[#b45309]">{money(balance)}</span>}
        <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: status.bg, color: status.fg }}>
          {status.label}
        </span>
      </span>
    </Link>
  )
}

export default async function InvoicesPage() {
  const { user, tenant } = await requireDashboardSession()
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!

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
  const recent = (recentRes.docs as Invoice[]).filter((i) => !pendingIds.has(String(i.id)))
  const pendingTotal = pending.reduce((sum, i) => sum + (i.balanceDue ?? 0), 0)

  return (
    <>
      <AppHeader title="Cobros" subtitle={pending.length ? `${pending.length} con saldo pendiente` : 'Sin saldos pendientes'} />
      <AppContent className="flex flex-col gap-3.5">
        <section className="overflow-hidden rounded-[14px] border border-[#e3e7e7] bg-white">
          <div className="flex items-center justify-between border-b border-[#eef1f1] px-4 py-3.5">
            <span className="text-sm font-semibold">Saldos pendientes</span>
            <span className="tabular text-sm font-semibold text-[#b45309]">{formatMoney(pendingTotal, tenant)}</span>
          </div>
          {pending.length === 0 ? (
            <p className="px-4 py-5 text-sm text-[#6b7577]">Todo cobrado. Las facturas con saldo aparecerán aquí.</p>
          ) : (
            pending.map((inv) => <Row key={inv.id} inv={inv} tenant={tenant} />)
          )}
        </section>
        <section className="overflow-hidden rounded-[14px] border border-[#e3e7e7] bg-white">
          <div className="border-b border-[#eef1f1] px-4 py-3.5 text-sm font-semibold">Facturas recientes</div>
          {recent.length === 0 ? (
            <p className="px-4 py-5 text-sm text-[#6b7577]">
              Todavía no hay facturas. Se crean desde la agenda con «Cobrar consulta» al terminar una consulta.
            </p>
          ) : (
            recent.map((inv) => <Row key={inv.id} inv={inv} tenant={tenant} />)
          )}
        </section>
      </AppContent>
    </>
  )
}
