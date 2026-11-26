import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { denyAll, isSuperAdmin, superAdminOnly, tenantScoped } from '@/access'
import { logAudit } from '@/lib/audit'
import { ERROR_CODES } from '@/lib/constants'
import { METERED_LABELS, PACK_RESOURCES, PACK_VALID_DAYS, isPackResource } from '@/lib/plans'

/**
 * Quota packs (spec §2): extra units of a monthly quota that last 90 days or
 * until used up. The monthly quota is spent first, then the pack that expires
 * soonest (src/lib/usage.ts consumes `used` natively, outside Payload).
 *
 * Phase 2: only the super admin creates them (gift / manual assignment). Phase 3
 * adds PayPal one-off purchases (source `paypal`). A clinic can read its own.
 */
export const QuotaPacks: CollectionConfig = {
  slug: 'quotaPacks',
  labels: { singular: 'Paquete de cuota', plural: 'Paquetes de cuota' },
  admin: {
    useAsTitle: 'resource',
    defaultColumns: ['tenant', 'resource', 'units', 'used', 'expiresAt', 'source'],
    hidden: ({ user }) => !isSuperAdmin(user as never),
    description: 'Unidades extra de una cuota mensual. Duran 90 días o hasta agotarse.',
  },
  access: {
    read: tenantScoped,
    create: superAdminOnly,
    update: superAdminOnly,
    delete: denyAll, // history of what was given or sold stays
  },
  timestamps: true,
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (!data) return data
        if (operation === 'create') {
          if (!data.expiresAt) data.expiresAt = new Date(Date.now() + PACK_VALID_DAYS * 86_400_000).toISOString()
          data.used = 0
        }
        if (data.resource !== undefined && !isPackResource(data.resource)) {
          throw new APIError('Ese recurso no se vende en paquetes.', 400, { code: ERROR_CODES.VALIDATION })
        }
        if (data.units !== undefined && (!Number.isSafeInteger(data.units) || data.units <= 0)) {
          throw new APIError('Las unidades del paquete deben ser un número entero mayor que cero.', 400, {
            code: ERROR_CODES.VALIDATION,
          })
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return doc
        const tenantID = typeof doc.tenant === 'object' && doc.tenant ? String(doc.tenant.id) : String(doc.tenant)
        await logAudit(req, {
          action: 'quota.pack-added',
          targetCollection: 'quotaPacks',
          targetId: String(doc.id),
          summary: `Paquete de ${doc.units} ${METERED_LABELS[doc.resource as keyof typeof METERED_LABELS]?.toLowerCase() ?? doc.resource}`,
          meta: { resource: doc.resource, units: doc.units, source: doc.source, expiresAt: doc.expiresAt },
          tenantID,
        })
        return doc
      },
    ],
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', label: 'Consultorio', required: true, index: true },
    {
      name: 'resource',
      type: 'select',
      label: 'Recurso',
      required: true,
      options: PACK_RESOURCES.map((r) => ({ label: METERED_LABELS[r], value: r })),
    },
    { name: 'units', type: 'number', label: 'Unidades', required: true, min: 1 },
    {
      name: 'used',
      type: 'number',
      label: 'Usadas',
      defaultValue: 0,
      access: { update: () => false }, // only consumption (native $inc) moves it
      admin: { readOnly: true },
    },
    { name: 'expiresAt', type: 'date', label: 'Vence', index: true, admin: { description: 'Por defecto, 90 días desde hoy.' } },
    {
      name: 'source',
      type: 'select',
      label: 'Origen',
      required: true,
      defaultValue: 'gift',
      options: [
        { label: 'Regalo', value: 'gift' },
        { label: 'Asignado por medira', value: 'admin' },
        { label: 'Compra con PayPal', value: 'paypal' },
      ],
    },
    { name: 'note', type: 'text', label: 'Nota' },
  ],
}
