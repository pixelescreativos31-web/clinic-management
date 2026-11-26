import type { CollectionConfig } from 'payload'
import { denyAll, isSuperAdmin, tenantScoped } from '@/access'
import { METERED_LABELS, METERED_RESOURCES, STORAGE_PERIOD } from '@/lib/plans'

/**
 * Usage counters (roadmap B1): one document per clinic × period × metered
 * resource, holding a running `count`. Period is "YYYY-MM" (clinic timezone) for
 * monthly resources and "total" for storage bytes.
 *
 * Writes never go through Payload create/update — every role, super admin
 * included, is denied. The only writer is `recordUsage()` (src/lib/usage.ts),
 * which does an atomic Mongo `$inc` upsert so concurrent increments never lose
 * a unit. (tenant, period, resource) is unique — enforced by the index below and
 * re-created natively in payload.config onInit.
 *
 * Read is tenant-scoped like the other collections: a clinic only ever sees its
 * own counters.
 */
export const UsageCounters: CollectionConfig = {
  slug: 'usageCounters',
  labels: { singular: 'Contador de uso', plural: 'Contadores de uso' },
  admin: {
    useAsTitle: 'period',
    defaultColumns: ['tenant', 'period', 'resource', 'count', 'updatedAt'],
    hidden: ({ user }) => !isSuperAdmin(user as never),
  },
  access: {
    read: tenantScoped,
    create: denyAll, // only recordUsage() writes, natively
    update: denyAll,
    delete: denyAll,
  },
  timestamps: true,
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', label: 'Consultorio', required: true, index: true },
    {
      name: 'period',
      type: 'text',
      label: 'Periodo',
      required: true,
      admin: { description: 'AAAA-MM en la zona horaria del consultorio, o "total" para almacenamiento.' },
      validate: (v: unknown) =>
        typeof v === 'string' && (v === STORAGE_PERIOD || /^\d{4}-(0[1-9]|1[0-2])$/.test(v))
          ? true
          : 'Periodo inválido (AAAA-MM o "total").',
    },
    {
      name: 'resource',
      type: 'select',
      label: 'Recurso',
      required: true,
      options: METERED_RESOURCES.map((r) => ({ label: METERED_LABELS[r], value: r })),
    },
    { name: 'count', type: 'number', label: 'Uso', required: true, defaultValue: 0 },
    // Spec §2: the owner is told once per period at 80% and at 100% (set natively by usage.ts).
    { name: 'notified80At', type: 'date', label: 'Aviso del 80 %', admin: { readOnly: true } },
    { name: 'notified100At', type: 'date', label: 'Aviso del 100 %', admin: { readOnly: true } },
  ],
  indexes: [{ fields: ['tenant', 'period', 'resource'], unique: true }],
}
