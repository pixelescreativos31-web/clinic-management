import { notFound } from 'next/navigation'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { Letterhead, PrintToolbar, numericDate } from '../../_components/Letterhead'
import { formatMoney, formatDateTime } from '@/lib/format'
import { PAYMENT_METHODS, DEFAULT_TIMEZONE } from '@/lib/constants'
import { APP_NAME } from '@/lib/brand'
import type { Invoice, Patient } from '@/payload-types'

const relId = (v: unknown): string =>
  v && typeof v === 'object' && 'id' in (v as Record<string, unknown>) ? String((v as { id: unknown }).id) : String(v)

/**
 * Printable receipt — minimal layout (no app chrome), tuned for @media print so the
 * browser's "Save as PDF" produces a clean A5 document the clinic can share with the
 * patient. No PDF library: print CSS does the job (v2 spec §4.3).
 */
export default async function ReceiptPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, tenant } = await requireDashboardSession()
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

  const ctx = { settings: { currency: invoice.currency } }
  const m = (n?: number | null) => formatMoney(n ?? 0, ctx)
  const patient = invoice.patient as Patient
  const lines = invoice.lineItems ?? []
  const payments = invoice.payments ?? []
  const STATUS_LABELS: Record<string, string> = { paid: 'PAGADA', partial: 'PARCIAL', unpaid: 'PENDIENTE' }
  const statusLabel = invoice.voided ? 'ANULADA' : (STATUS_LABELS[invoice.paymentStatus ?? 'unpaid'] ?? 'PENDIENTE')
  const methodLabel = (v?: string | null) => PAYMENT_METHODS.find((pm) => pm.value === v)?.label ?? (v ?? '').replace('-', ' ')

  return (
    <main className="mx-auto w-full max-w-[150mm] bg-white px-8 py-10 text-[13px] text-[#1c1917] print:max-w-none print:p-[12mm]">
      {/* Print page setup: A5, margins handled by the element padding above so the
          on-screen preview and the printed/PDF output match exactly. */}
      <style>{`@page { size: A5; margin: 0; } @media print { html, body { background: #fff; } }`}</style>

      <PrintToolbar backHref={`/dashboard/invoices/${invoice.id}`} backLabel="Volver a la factura" />

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
        doc={`Recibo ${invoice.invoiceNumber}`}
        date={numericDate(invoice.createdAt, tenant?.settings?.timezone || DEFAULT_TIMEZONE)}
      />

      {/* Bill to */}
      <section className="mt-3 flex items-start justify-between gap-3">
        <div className="text-[13px]">
          <span className="font-medium">{patient?.name}</span>
          {patient?.mrn && <span className="text-[#57534e]"> · Exp. {patient.mrn}</span>}
          <div className="tabular text-xs text-[#57534e]">{formatDateTime(invoice.createdAt, ctx)}</div>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold ${
            invoice.voided
              ? 'border-[#1c1917] bg-[#1c1917] text-white'
              : invoice.paymentStatus === 'paid'
                ? 'border-[#15803d] text-[#15803d]'
                : invoice.paymentStatus === 'partial'
                  ? 'border-[#b45309] text-[#b45309]'
                  : 'border-[#d6d3d1] text-[#57534e]'
          }`}
        >
          {statusLabel}
        </span>
      </section>

      <div className="mt-4 text-lg font-semibold tracking-[-.02em]">Recibo de pago</div>

      {/* Line items */}
      <table className="mt-2 w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[#e7e5e4] text-xs text-[#57534e]">
            <th className="py-2 text-start font-medium">Descripción</th>
            <th className="py-2 text-end font-medium">Cant.</th>
            <th className="py-2 text-end font-medium">Precio unit.</th>
            <th className="py-2 text-end font-medium">Monto</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((li, i) => (
            <tr key={i} className="border-b border-[#f0eeec]">
              <td className="py-2">{li.description}</td>
              <td className="tabular py-2 text-end">{li.quantity}</td>
              <td className="tabular py-2 text-end">{m(li.unitAmount)}</td>
              <td className="tabular py-2 text-end font-medium">{m(li.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-4 ms-auto w-56 text-[13px]">
        <div className="flex justify-between py-1"><span className="text-[#57534e]">Total</span><span className="tabular font-semibold">{m(invoice.totalAmount)}</span></div>
        <div className="flex justify-between py-1"><span className="text-[#57534e]">Pagado</span><span className="tabular">{m(invoice.amountPaid)}</span></div>
        <div className="flex justify-between border-t border-[#1c1917] py-1.5"><span className="font-semibold">Saldo pendiente</span><span className="tabular font-semibold">{m(invoice.balanceDue)}</span></div>
      </div>

      {/* Payments */}
      {payments.length > 0 && (
        <div className="mt-6">
          <div className="text-xs font-semibold text-[#1c1917]">Pagos</div>
          <ul className="mt-1 text-xs">
            {payments.map((p, i) => (
              <li key={i} className="flex justify-between border-b border-[#f0eeec] py-1">
                <span>{methodLabel(p.method)}{p.receivedAt ? ` · ${formatDateTime(p.receivedAt, ctx)}` : ''}</span>
                <span className="tabular">{m(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {invoice.voided && invoice.voidReason && (
        <p className="mt-4 text-xs font-medium text-[#1c1917]">Anulada: {invoice.voidReason}</p>
      )}

      <footer className="mt-10 border-t border-[#e7e5e4] pt-3 text-center text-[10px] text-[#78716c]">
        Generado por {APP_NAME} · Este es un recibo generado electrónicamente.
      </footer>
    </main>
  )
}
