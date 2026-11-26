import type { CollectionConfig } from 'payload'
import { tenantScoped, denyAll } from '@/access'
import { forceTenant } from '@/hooks/tenant'

/**
 * BookingRequests — "extra / emergency" requests from the public booking page,
 * for when no published slot suits the patient. Only clinics that switch on
 * `settings.onlineRequestsEnabled` receive them. Created by the public page with
 * overrideAccess (there is no logged-in user); staff read and resolve them.
 */
export const BookingRequests: CollectionConfig = {
  slug: 'bookingRequests',
  labels: { singular: 'Solicitud en línea', plural: 'Solicitudes en línea' },
  admin: { useAsTitle: 'reason', defaultColumns: ['createdAt', 'patient', 'urgent', 'status'] },
  access: {
    read: tenantScoped,
    create: denyAll, // only the public booking flow (server-side, overrideAccess)
    update: tenantScoped,
    delete: denyAll,
  },
  timestamps: true,
  hooks: { beforeChange: [forceTenant] },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      access: { update: () => false },
    },
    { name: 'patient', type: 'relationship', relationTo: 'patients', required: true, access: { update: () => false } },
    { name: 'doctor', type: 'relationship', relationTo: 'users', label: 'Médico preferido' },
    {
      name: 'preferredDate',
      type: 'date',
      label: 'Fecha preferida',
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
    { name: 'reason', type: 'textarea', required: true, label: 'Motivo' },
    { name: 'urgent', type: 'checkbox', defaultValue: false, label: 'Emergencia' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      label: 'Estado',
      options: [
        { label: 'Pendiente', value: 'pending' },
        { label: 'Atendida', value: 'handled' },
        { label: 'Descartada', value: 'dismissed' },
      ],
    },
  ],
}
