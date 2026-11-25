import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { StatusBadge } from '@/components/ui-kit'
import { btnGhost } from '@/components/primitives'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { InvoiceActions } from '@/components/InvoiceActions'
import { formatMoney, formatDateTime } from '@/lib/format'
import { avatarTint, initialsOf } from '@/lib/apptStatus'
import { PAYMENT_METHODS } from '@/lib/constants'
import type { Invoice, Patient } from '@/payload-types'

const relId = (v: unknown): string =>
  v && typeof v === 'object' && 'id' in (v as Record<string, unknown>) ? String((v as { id: unknown }).id) : String(v)

const CARD = 'rounded-[12px] border border-[#e7e5e4] bg-white'
const TH = 'px-4 py-2.5 text-left text-xs font-medium whitespace-nowrap text-[#57534e]'

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireDashboardSession()
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const { id } = await params

  let invoice: Invoice
  try {
    invoice = (await payload.findByID({ collection: 'invoices', id, depth: 1, overrideAccess: false, user })) as Invoice
  } catch {
    notFound()
  }
  if (relId(invoice.tenant) !== String(tenantID)) notFound()

  // Display amounts in the invoice's snapshotted currency, not the clinic's current one.
  const moneyCtx = { settings: { currency: invoice.currency } }
  const m = (n?: number | null) => formatMoney(n ?? 0, moneyCtx)
  const patient = invoice.patient as Patient
  const lines = invoice.lineItems ?? []
  const payments = invoice.payments ?? []
  const name = patient?.name ?? 'Paciente'
  const tint = avatarTint(name)

  return (
    <>
      <AppHeader
        title={`Factura ${invoice.invoiceNumber}`}
        subtitle={formatDateTime(invoice.createdAt, moneyCtx)}
        backHref="/dashboard/invoices"
        actions={
          <Link href={`/print/receipt/${invoice.id}`} target="_blank" className={btnGhost}>
            Imprimir recibo
          </Link>
        }
      />
      <AppContent>
        {invoice.voided && (
          <div className="mb-3 rounded-[12px] border border-[#1c1917] bg-white px-4 py-3 text-sm">
            <span className="font-semibold">Anulada.</span> <span className="text-[#57534e]">{invoice.voidReason}</span>
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-3">
            {/* Patient */}
            <div className={`${CARD} flex items-center gap-3 px-4 py-3.5`}>
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{ background: tint.bg, color: tint.fg }}
                aria-hidden
              >
                {initialsOf(name)}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/dashboard/patients/${relId(patient)}`} className="block truncate text-[15px] font-semibold text-[#1c1917] hover:text-[#0f766e]">
                  {patient?.name}
                </Link>
                <div className="font-mono text-xs text-[#57534e]">{patient?.mrn}</div>
              </div>
              <StatusBadge status={invoice.voided ? 'voided' : (invoice.paymentStatus ?? 'unpaid')} />
            </div>

            {/* Line items */}
            <section className={`${CARD} overflow-hidden`}>
              <div className="px-4 py-3.5 text-[15px] font-semibold">Detalle</div>
              <div className="overflow-x-auto border-t border-[#f0eeec]">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="bg-[#fafaf7]">
                      <th className={TH}>Descripción</th>
                      <th className={`${TH} text-right`}>Cant.</th>
                      <th className={`${TH} text-right`}>Precio unit.</th>
                      <th className={`${TH} text-right`}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((li, i) => (
                      <tr key={i} className="border-t border-[#f0eeec]">
                        <td className="px-4 py-[11px] break-words">{li.description}</td>
                        <td className="tabular px-4 py-[11px] text-right">{li.quantity}</td>
                        <td className="tabular px-4 py-[11px] text-right whitespace-nowrap">{m(li.unitAmount)}</td>
                        <td className="tabular px-4 py-[11px] text-right font-medium whitespace-nowrap">{m(li.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="border-t border-[#f0eeec] text-sm">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <dt className="text-[#57534e]">Total</dt>
                  <dd className="tabular font-semibold">{m(invoice.totalAmount)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-[#f0eeec] px-4 py-2.5">
                  <dt className="text-[#57534e]">Pagado</dt>
                  <dd className="tabular">{m(invoice.amountPaid)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-[#1c1917] px-4 py-3">
                  <dt className="font-semibold">Saldo pendiente</dt>
                  <dd className="tabular text-[17px] font-semibold">{m(invoice.balanceDue)}</dd>
                </div>
              </dl>
            </section>

            {/* Payments */}
            {payments.length > 0 && (
              <section className={`${CARD} overflow-hidden`}>
                <div className="px-4 py-3.5 text-[15px] font-semibold">Pagos</div>
                <ul className="text-sm">
                  {payments.map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 border-t border-[#f0eeec] px-4 py-[11px]">
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {PAYMENT_METHODS.find((pm) => pm.value === p.method)?.label ?? (p.method ?? '').replace('-', ' ')}
                        </span>
                        {p.receivedAt && <span className="tabular block text-[13px] text-[#57534e]">{formatDateTime(p.receivedAt, moneyCtx)}</span>}
                      </span>
                      <span className="tabular shrink-0 font-medium">{m(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Actions */}
          <section className={`${CARD} p-4 lg:sticky lg:top-[72px]`}>
            <div className="mb-3 text-[15px] font-semibold">Cobro</div>
            <InvoiceActions
              invoiceId={String(invoice.id)}
              balanceDue={invoice.balanceDue ?? 0}
              voided={Boolean(invoice.voided)}
              canVoid={user.role === 'owner'}
            />
            {invoice.voided && <p className="text-sm text-[#57534e]">Esta factura está anulada y bloqueada.</p>}
            <Link href={`/print/receipt/${invoice.id}`} target="_blank" className={`${btnGhost} mt-3 w-full`}>
              Imprimir o descargar PDF
            </Link>
          </section>
        </div>
      </AppContent>
    </>
  )
}
