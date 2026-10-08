import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { Card, StatusBadge, Avatar, Th, Td, btnGhost } from '@/components/primitives'
import { IconChevronLeft, IconPrinter } from '@/components/icons'
import { InvoiceActions } from '@/components/InvoiceActions'
import { formatMoney, formatDateTime } from '@/lib/format'
import { PAYMENT_METHODS } from '@/lib/constants'
import type { Invoice, Patient, User } from '@/payload-types'

const relId = (v: unknown): string =>
  v && typeof v === 'object' && 'id' in (v as Record<string, unknown>) ? String((v as { id: unknown }).id) : String(v)

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

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/appointments" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-ink">
        <IconChevronLeft size={14} />
        Inicio
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="tabular font-display text-2xl font-semibold tracking-tight">{invoice.invoiceNumber}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{formatDateTime(invoice.createdAt, moneyCtx)}</p>
        </div>
        <StatusBadge status={invoice.voided ? 'voided' : (invoice.paymentStatus ?? 'unpaid')} />
      </div>

      {invoice.voided && (
        <div className="mb-4 rounded-lg border border-destructive/25 bg-red-soft px-4 py-3 text-sm text-destructive">
          <span className="font-semibold">Anulada.</span> {invoice.voidReason}
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-4">
          {/* Patient */}
          <Card className="flex items-center gap-3 p-4">
            <Avatar name={patient?.name ?? 'Paciente'} />
            <div className="min-w-0">
              <Link href={`/dashboard/patients/${relId(patient)}`} className="truncate text-sm font-semibold hover:text-primary">
                {patient?.name}
              </Link>
              <div className="tabular text-xs text-muted-foreground">{patient?.mrn}</div>
            </div>
          </Card>

          {/* Line items */}
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-canvas/50">
                  <Th>Descripción</Th>
                  <Th className="text-end">Cant.</Th>
                  <Th className="hidden text-end sm:table-cell">Precio unit.</Th>
                  <Th className="text-end">Monto</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((li, i) => (
                  <tr key={i}>
                    <Td className="break-words">{li.description}</Td>
                    <Td className="tabular text-end">{li.quantity}</Td>
                    <Td className="tabular hidden text-end whitespace-nowrap sm:table-cell">{m(li.unitAmount)}</Td>
                    <Td className="tabular text-end font-medium whitespace-nowrap">{m(li.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="divide-y divide-border border-t border-border text-sm">
              <div className="flex items-center justify-between px-3 py-2.5">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="tabular font-semibold">{m(invoice.totalAmount)}</dd>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5">
                <dt className="text-muted-foreground">Pagado</dt>
                <dd className="tabular">{m(invoice.amountPaid)}</dd>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5">
                <dt className="font-medium">Saldo pendiente</dt>
                <dd className="tabular font-semibold text-ink">{m(invoice.balanceDue)}</dd>
              </div>
            </dl>
          </Card>

          {/* Payments */}
          {payments.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-border px-4 py-3 text-sm font-semibold">Pagos</div>
              <ul className="divide-y divide-border text-sm">
                {payments.map((p, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-muted-foreground">
                      {PAYMENT_METHODS.find((pm) => pm.value === p.method)?.label ?? (p.method ?? '').replace('-', ' ')}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="tabular text-xs text-faint">{p.receivedAt ? formatDateTime(p.receivedAt, moneyCtx) : ''}</span>
                      <span className="tabular font-medium">{m(p.amount)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Actions */}
        <Card className="sticky top-6 p-4">
          <div className="mb-3 text-sm font-semibold">Facturación</div>
          <InvoiceActions
            invoiceId={String(invoice.id)}
            balanceDue={invoice.balanceDue ?? 0}
            voided={Boolean(invoice.voided)}
            canVoid={user.role === 'owner'}
          />
          {invoice.voided && <p className="text-sm text-muted-foreground">Esta factura está anulada y bloqueada.</p>}
          <Link href={`/print/receipt/${invoice.id}`} target="_blank" className={`${btnGhost} mt-3 w-full`}>
            <IconPrinter size={15} />
            Imprimir / Descargar PDF
          </Link>
        </Card>
      </div>
    </div>
  )
}
