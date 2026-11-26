import type { CollectionConfig } from 'payload'
import { denyAll, isSuperAdmin, superAdminOnly, tenantScoped } from '@/access'

// Fase 3 — PayPal billing records (spec §3). Every write comes from
// src/lib/billing/service.ts with overrideAccess; nobody writes through the API.

const hiddenUnlessSuper = ({ user }: { user: unknown }) => !isSuperAdmin(user as never)

/**
 * Every PayPal webhook we received, keyed by PayPal's event id (unique), so a
 * repeated delivery is applied once. Unverified deliveries are stored too
 * (status `rejected`) and never touch a clinic.
 */
export const BillingEvents: CollectionConfig = {
  slug: 'billingEvents',
  labels: { singular: 'Aviso de PayPal', plural: 'Avisos de PayPal' },
  admin: {
    useAsTitle: 'eventId',
    defaultColumns: ['eventId', 'type', 'tenant', 'status', 'createdAt'],
    hidden: hiddenUnlessSuper,
  },
  access: { read: superAdminOnly, create: denyAll, update: denyAll, delete: denyAll },
  timestamps: true,
  fields: [
    { name: 'eventId', type: 'text', label: 'Id del evento', required: true, unique: true, index: true },
    { name: 'type', type: 'text', label: 'Tipo', required: true },
    { name: 'eventTime', type: 'date', label: 'Fecha del evento' },
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', label: 'Consultorio', index: true },
    { name: 'resourceId', type: 'text', label: 'Suscripción u orden' },
    {
      name: 'status',
      type: 'select',
      label: 'Resultado',
      required: true,
      defaultValue: 'processed',
      options: [
        { label: 'Aplicado', value: 'processed' },
        { label: 'Ignorado (más viejo que el último aplicado)', value: 'stale' },
        { label: 'Ignorado (no corresponde)', value: 'ignored' },
        { label: 'Rechazado (no verificado)', value: 'rejected' },
        { label: 'Error', value: 'error' },
      ],
    },
    { name: 'error', type: 'text', label: 'Error' },
  ],
}

/** medira's receipts to the clinic: MED-2026-000123. No taxes (clinics are not charged ITBIS). */
export const BillingReceipts: CollectionConfig = {
  slug: 'billingReceipts',
  labels: { singular: 'Recibo de medira', plural: 'Recibos de medira' },
  admin: {
    useAsTitle: 'number',
    defaultColumns: ['number', 'tenant', 'concept', 'totalUsd', 'status', 'paidAt'],
    hidden: hiddenUnlessSuper,
  },
  access: {
    read: tenantScoped,
    create: denyAll,
    update: denyAll,
    delete: denyAll,
  },
  timestamps: true,
  fields: [
    { name: 'number', type: 'text', label: 'Número', required: true, unique: true },
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', label: 'Consultorio', required: true, index: true },
    { name: 'paidAt', type: 'date', label: 'Fecha', required: true },
    {
      name: 'kind',
      type: 'select',
      label: 'Concepto',
      required: true,
      options: [
        { label: 'Plan', value: 'plan' },
        { label: 'Paquete', value: 'pack' },
      ],
    },
    { name: 'concept', type: 'text', label: 'Detalle', required: true },
    { name: 'periodStart', type: 'date', label: 'Periodo desde' },
    { name: 'periodEnd', type: 'date', label: 'Periodo hasta' },
    { name: 'totalUsd', type: 'number', label: 'Total (US$)', required: true },
    {
      name: 'status',
      type: 'select',
      label: 'Estado',
      required: true,
      defaultValue: 'paid',
      options: [
        { label: 'Pagado', value: 'paid' },
        { label: 'Reembolsado', value: 'refunded' },
      ],
    },
    { name: 'method', type: 'text', label: 'Método', defaultValue: 'PayPal' },
    { name: 'payerEmailMasked', type: 'text', label: 'Cuenta de PayPal' },
    { name: 'transactionId', type: 'text', label: 'Transacción de PayPal', required: true, unique: true, index: true },
  ],
}

/**
 * One free trial per clinic, owner email, owner phone, RNC and PayPal account
 * (spec §3). Only sha256 hashes are stored.
 */
export const TrialClaims: CollectionConfig = {
  slug: 'trialClaims',
  labels: { singular: 'Prueba usada', plural: 'Pruebas usadas' },
  admin: { useAsTitle: 'kind', hidden: hiddenUnlessSuper },
  access: { read: superAdminOnly, create: denyAll, update: denyAll, delete: denyAll },
  timestamps: true,
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Correo del Titular', value: 'email' },
        { label: 'Teléfono del Titular', value: 'phone' },
        { label: 'RNC', value: 'taxId' },
        { label: 'Cuenta de PayPal', value: 'payer' },
      ],
    },
    { name: 'valueHash', type: 'text', required: true, index: true },
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true },
  ],
  indexes: [{ fields: ['kind', 'valueHash'], unique: true }],
}
