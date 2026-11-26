import { notFound } from 'next/navigation'
import { getPayloadClient, requireDashboardSession, requireRole } from '@/lib/auth'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { PrintButton } from '@/components/PrintButton'
import { formatDate } from '@/lib/billing/service'
import { APP_NAME, SUPPORT_EMAIL } from '@/lib/brand'

/** medira's receipt to the clinic (spec §3). No taxes: clinics are not charged ITBIS. */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireDashboardSession()
  await requireRole(session, ['owner'])
  const { id } = await params
  const payload = await getPayloadClient()
  // tenantScoped read access keeps every clinic to its own receipts.
  const receipt = await payload
    .findByID({ collection: 'billingReceipts', id, depth: 0, user: session.user, overrideAccess: false })
    .catch(() => null)
  if (!receipt) notFound()
  const tz = session.tenant?.settings?.timezone ?? undefined
  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-4 border-b border-[#f0eeec] py-2 text-sm last:border-0">
      <dt className="text-[#57534e]">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
  return (
    <>
      <AppHeader title="Recibo" subtitle={receipt.number} actions={<PrintButton />} />
      <AppContent>
        <article className="max-w-xl rounded-[12px] border border-[#e7e5e4] bg-white px-6 py-6 print:border-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-display text-lg font-semibold text-[#042f2e]">{APP_NAME}</div>
              <div className="text-xs text-[#57534e]">{SUPPORT_EMAIL}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#57534e]">Recibo</div>
              <div className="tabular font-semibold">{receipt.number}</div>
            </div>
          </div>
          <div className="mt-5 text-sm">
            <div className="text-xs text-[#57534e]">Cliente</div>
            <div className="font-medium">{session.tenant?.name}</div>
          </div>
          <dl className="mt-5">
            {row('Fecha', formatDate(receipt.paidAt, tz))}
            {row('Concepto', receipt.concept)}
            {receipt.periodStart && receipt.periodEnd
              ? row('Periodo', `${formatDate(receipt.periodStart, tz)} – ${formatDate(receipt.periodEnd, tz)}`)
              : null}
            {row('Método', `PayPal${receipt.payerEmailMasked ? ` · ${receipt.payerEmailMasked}` : ''}`)}
            {row('Transacción de PayPal', receipt.transactionId)}
            {row('Total', `US$${receipt.totalUsd.toFixed(2)}`)}
          </dl>
          {receipt.status === 'refunded' && <p className="mt-4 text-sm font-medium text-[#b45309]">Este pago fue reembolsado.</p>}
        </article>
      </AppContent>
    </>
  )
}
