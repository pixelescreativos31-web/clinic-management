import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { tenantScoped, denyAll, getTenantID, isSuperAdmin, superAdminOrOwnerField } from '@/access'
import { forceTenant } from '@/hooks/tenant'
import { auditInvoices } from '@/hooks/audit'
import {
  ERROR_CODES,
  PAYMENT_METHODS,
  INVOICE_STATUSES,
  DEFAULT_CURRENCY,
  type InvoiceStatus,
} from '@/lib/constants'

const relID = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return String((value as { id: string | number }).id)
  }
  return String(value)
}

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: 'Pendiente',
  partial: 'Parcial',
  paid: 'Pagada',
}

/** Round to 2 dp to keep money math free of float dust. */
const money = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

type LineItem = { description?: string; quantity?: number; unitAmount?: number; amount?: number }
type Payment = { amount?: number; method?: string; receivedAt?: string; receivedBy?: unknown }

/** Stable signature of the billable line items, for the post-payment lock check. */
const lineSignature = (items: LineItem[] | undefined): string =>
  JSON.stringify((items ?? []).map((l) => [l.description ?? '', Number(l.quantity ?? 0), Number(l.unitAmount ?? 0)]))

/**
 * Invoices — billing for a visit (v2 spec §2.2). Totals, paid, balance and status
 * are ALWAYS derived in the hook (client values are ignored), mirroring the
 * Distribution Tracker Invoices pattern. Currency is snapshotted at create time so
 * a later clinic-currency change never rewrites historical amounts.
 */
export const Invoices: CollectionConfig = {
  slug: 'invoices',
  labels: { singular: 'Factura', plural: 'Facturas' },
  admin: {
    useAsTitle: 'invoiceNumber',
    defaultColumns: ['invoiceNumber', 'patient', 'totalAmount', 'paymentStatus'],
  },
  access: {
    read: tenantScoped,
    create: tenantScoped, // reception bills — that's their job
    update: tenantScoped, // payments by anyone; voiding is owner-only (field-level)
    delete: denyAll,
  },
  timestamps: true,
  hooks: {
    beforeChange: [
      forceTenant,
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return data

        // --- void guard: a voided invoice is frozen (superAdmin may still correct) ---
        if (operation === 'update' && originalDoc?.voided === true && !isSuperAdmin(req.user)) {
          throw new APIError('Esta factura fue anulada y no se puede modificar.', 403, {
            code: ERROR_CODES.INVOICE_VOIDED,
          })
        }
        if (data.voided === true && !data.voidReason && !originalDoc?.voidReason) {
          throw new APIError('Debe indicar un motivo para anular la factura.', 400, {
            code: ERROR_CODES.VALIDATION,
          })
        }

        // --- create-time stamps: number, currency snapshot, creator, patient ---
        if (operation === 'create') {
          const tenantID = data.tenant ? String(data.tenant) : getTenantID(req.user)
          if (!tenantID) {
            throw new APIError('No se puede crear una factura sin un consultorio.', 400, {
              code: ERROR_CODES.VALIDATION,
            })
          }
          const tenant = await req.payload
            .findByID({ collection: 'tenants', id: tenantID, depth: 0, req, overrideAccess: true })
            .catch(() => null)
          data.currency = tenant?.settings?.currency || DEFAULT_CURRENCY

          const existing = await req.payload.count({
            collection: 'invoices',
            where: { tenant: { equals: tenantID } },
            req,
            overrideAccess: true,
          })
          data.invoiceNumber = `FAC-${String(existing.totalDocs + 1).padStart(4, '0')}`

          if (req.user) data.createdBy = req.user.id

          // Pull the patient from the linked visit when not supplied directly.
          if (!data.patient && data.visit) {
            const visit = await req.payload
              .findByID({ collection: 'visits', id: relID(data.visit)!, depth: 0, req, overrideAccess: true })
              .catch(() => null)
            if (visit) data.patient = relID(visit.patient)
          }

          // Same-clinic guard: the linked visit and patient must belong to this
          // invoice's clinic (ids come from the client; forceTenant only pins the
          // invoice itself).
          const visitRef = relID(data.visit)
          if (visitRef) {
            const v = await req.payload
              .findByID({ collection: 'visits', id: visitRef, depth: 0, req, overrideAccess: true })
              .catch(() => null)
            if (!v || relID(v.tenant) !== tenantID) {
              throw new APIError('Consulta no encontrada.', 400, { code: ERROR_CODES.VALIDATION })
            }
          }
          const patientRef = relID(data.patient)
          if (patientRef) {
            const p = await req.payload
              .findByID({ collection: 'patients', id: patientRef, depth: 0, req, overrideAccess: true })
              .catch(() => null)
            if (!p || relID(p.tenant) !== tenantID) {
              throw new APIError('Paciente no encontrado.', 400, { code: ERROR_CODES.VALIDATION })
            }
          }
        }

        // --- line items: lock after a payment, then (re)compute amounts + total ---
        if (operation === 'update' && data.lineItems !== undefined) {
          const hadPayments = ((originalDoc?.payments as Payment[] | undefined)?.length ?? 0) > 0
          if (hadPayments && lineSignature(data.lineItems as LineItem[]) !== lineSignature(originalDoc?.lineItems as LineItem[])) {
            throw new APIError(
              'Los conceptos no se pueden modificar después de registrar un pago. Anule la factura y cree una nueva.',
              403,
              { code: ERROR_CODES.INVOICE_LOCKED },
            )
          }
        }

        const lines = (data.lineItems ?? originalDoc?.lineItems ?? []) as LineItem[]
        let total = 0
        for (const li of lines) {
          const qty = Number(li.quantity ?? 1)
          const unit = Number(li.unitAmount ?? 0)
          li.amount = money(qty * unit)
          total += li.amount
        }
        data.lineItems = lines
        data.totalAmount = money(total)

        // --- payments: default receivedAt/receivedBy, then sum ---
        const pays = (data.payments ?? originalDoc?.payments ?? []) as Payment[]
        let paid = 0
        for (const p of pays) {
          if (!p.receivedAt) p.receivedAt = new Date().toISOString()
          if (!p.receivedBy && req.user) p.receivedBy = req.user.id
          paid += Number(p.amount ?? 0)
        }
        data.payments = pays
        data.amountPaid = money(paid)
        data.balanceDue = money(data.totalAmount - data.amountPaid)

        // --- overpayment guard ---
        if (data.amountPaid > data.totalAmount + 1e-9) {
          throw new APIError(
            `El pago supera el saldo pendiente (${data.totalAmount}).`,
            400,
            { code: ERROR_CODES.PAYMENT_EXCEEDS_BALANCE },
          )
        }

        // --- derived status (never client-set) ---
        let status: InvoiceStatus = 'unpaid'
        if (data.amountPaid > 0) status = data.balanceDue <= 0 ? 'paid' : 'partial'
        data.paymentStatus = status

        return data
      },
    ],
    afterChange: [auditInvoices],
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      label: 'Consultorio',
      required: true,
      index: true,
      access: { update: () => false },
    },
    {
      name: 'invoiceNumber',
      type: 'text',
      label: 'Número de factura',
      access: { update: () => false },
      admin: { readOnly: true, description: 'Asignado automáticamente por consultorio (FAC-0001).' },
    },
    {
      name: 'visit',
      type: 'relationship',
      relationTo: 'visits',
      label: 'Consulta',
      access: { update: () => false },
      filterOptions: ({ user }) => {
        const tenantID = getTenantID(user as never)
        return tenantID ? ({ tenant: { equals: tenantID } } as never) : true
      },
    },
    { name: 'patient', type: 'relationship', relationTo: 'patients', label: 'Paciente', required: true },
    {
      name: 'currency',
      type: 'text',
      label: 'Moneda',
      access: { update: () => false },
      admin: { readOnly: true, description: 'Tomada de la configuración del consultorio al crear la factura.' },
    },
    {
      name: 'lineItems',
      type: 'array',
      minRows: 1,
      required: true,
      label: 'Conceptos',
      labels: { singular: 'Concepto', plural: 'Conceptos' },
      fields: [
        { name: 'description', type: 'text', label: 'Descripción', required: true },
        { name: 'quantity', type: 'number', label: 'Cantidad', required: true, defaultValue: 1, min: 1 },
        { name: 'unitAmount', type: 'number', required: true, min: 0, label: 'Precio unitario' },
        {
          name: 'amount',
          type: 'number',
          label: 'Monto',
          access: { update: () => false },
          admin: { readOnly: true, description: 'Cantidad × precio unitario.' },
        },
      ],
    },
    {
      name: 'totalAmount',
      type: 'number',
      label: 'Total',
      access: { update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'payments',
      type: 'array',
      label: 'Pagos',
      labels: { singular: 'Pago', plural: 'Pagos' },
      fields: [
        {
          name: 'amount',
          type: 'number',
          label: 'Monto',
          required: true,
          min: 0,
          validate: (value: number | null | undefined) =>
            value != null && value > 0 ? true : 'El pago debe ser mayor que cero.',
        },
        {
          name: 'method',
          type: 'select',
          label: 'Método de pago',
          required: true,
          defaultValue: 'cash',
          options: PAYMENT_METHODS.map((m) => ({ label: m.label, value: m.value })),
        },
        { name: 'receivedAt', type: 'date', label: 'Fecha de recepción', admin: { date: { pickerAppearance: 'dayAndTime' } } },
        {
          name: 'receivedBy',
          type: 'relationship',
          label: 'Recibido por',
          relationTo: 'users',
          access: { update: () => false },
          admin: { readOnly: true },
        },
      ],
    },
    {
      name: 'amountPaid',
      type: 'number',
      label: 'Monto pagado',
      access: { update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'balanceDue',
      type: 'number',
      label: 'Saldo pendiente',
      access: { update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'paymentStatus',
      type: 'select',
      label: 'Estado de pago',
      options: INVOICE_STATUSES.map((s) => ({ label: INVOICE_STATUS_LABELS[s], value: s })),
      access: { update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'voided',
      type: 'checkbox',
      label: 'Anulada',
      defaultValue: false,
      access: { update: superAdminOrOwnerField }, // only owner/superAdmin may void
    },
    {
      name: 'voidReason',
      type: 'text',
      label: 'Motivo de anulación',
      admin: { condition: (data) => data?.voided === true },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      label: 'Creada por',
      relationTo: 'users',
      access: { update: () => false },
      admin: { readOnly: true },
    },
  ],
  indexes: [
    { fields: ['tenant', 'paymentStatus'] },
    { fields: ['tenant', 'createdAt'] },
  ],
}
