import type { CollectionConfig } from 'payload'
import { auditReadAccess, denyAll, isSuperAdmin } from '@/access'
import { AUDIT_ACTIONS } from '@/lib/constants'

/**
 * Audit log (v3 spec §2.2) — an append-only record of sensitive actions.
 *
 * Immutability IS the feature: create/update/delete are denied to EVERY role,
 * super admin included. The only writer is the `logAudit` helper, which uses
 * overrideAccess from inside server-side hooks. Read is owner + super admin only.
 */
export const AuditLogs: CollectionConfig = {
  slug: 'auditLogs',
  labels: { singular: 'Registro de auditoría', plural: 'Registros de auditoría' },
  admin: {
    useAsTitle: 'summary',
    defaultColumns: ['createdAt', 'action', 'summary', 'tenant'],
    // Only super admins reach the Payload admin panel at all.
    hidden: ({ user }) => !isSuperAdmin(user as never),
  },
  access: {
    read: auditReadAccess,
    create: denyAll, // written only via logAudit (overrideAccess); never over REST
    update: denyAll, // append-only — entries are never edited
    delete: denyAll, // …or deleted (retention purge is a backlog item)
  },
  timestamps: true,
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', label: 'Consultorio', required: true, index: true },
    { name: 'user', type: 'relationship', relationTo: 'users', label: 'Usuario', required: true },
    {
      name: 'action',
      type: 'select',
      label: 'Acción',
      required: true,
      options: AUDIT_ACTIONS.map((a) => ({ label: a.label, value: a.value })),
    },
    { name: 'targetCollection', type: 'text', label: 'Colección afectada', required: true },
    { name: 'targetId', type: 'text', label: 'ID del registro afectado', required: true },
    {
      name: 'summary',
      type: 'text',
      label: 'Resumen',
      required: true,
      admin: { description: 'Texto legible, p. ej., "Canceló la cita de Ana Pérez de las 5:30 p. m.".' },
    },
    {
      name: 'meta',
      type: 'json',
      label: 'Metadatos',
      admin: { description: 'Contexto estructurado breve (rol anterior/nuevo, monto…). Nunca una copia completa del documento.' },
    },
  ],
  indexes: [{ fields: ['tenant', 'createdAt'] }],
}
