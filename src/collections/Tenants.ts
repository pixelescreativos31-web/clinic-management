import type { CollectionConfig } from 'payload'
import { superAdminOnly, tenantSelfRead, getTenantID, isSuperAdmin, superAdminField } from '@/access'
import {
  CURRENCIES,
  TIMEZONES,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  DEFAULT_APPOINTMENT_DURATION,
  DEFAULT_OPEN_TIME,
  DEFAULT_CLOSE_TIME,
  DEFAULT_COUNTRY,
  PRACTICE_TYPES,
} from '@/lib/constants'
import { PLANS, planLabel } from '@/lib/plans'
import { auditTenants } from '@/hooks/audit'

// The slug is the clinic's public booking URL (/agendar/<slug>), so accents are
// folded ("Jiménez" → "jimenez") instead of turning into dashes.
const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  labels: { singular: 'Consultorio', plural: 'Consultorios' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'city', 'status'] },
  access: {
    read: tenantSelfRead,
    create: superAdminOnly,
    // Owners may edit their own clinic's profile & settings. Sensitive fields
    // (status, slug) stay superAdmin-only via field-level access below.
    update: ({ req: { user } }) => {
      if (!user) return false
      if (isSuperAdmin(user)) return true
      if (user.role !== 'owner') return false
      const tenantID = getTenantID(user)
      if (!tenantID) return false
      return { id: { equals: tenantID } }
    },
    delete: superAdminOnly,
  },
  timestamps: true,
  hooks: {
    afterChange: [auditTenants],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Nombre del consultorio',
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      access: { update: superAdminField },
      admin: { description: 'Se genera a partir del nombre; para URLs públicas en el futuro.' },
      hooks: {
        beforeValidate: [
          ({ value, data }) => value || (data?.name ? slugify(data.name) : value),
        ],
      },
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
      label: 'Teléfono',
      validate: (value: string | null | undefined) => {
        if (!value) return 'El teléfono es obligatorio.'
        // Generic, market-agnostic validation: digits and +, 7–15 chars.
        return /^\+?[0-9]{7,15}$/.test(value.replace(/[\s-]/g, ''))
          ? true
          : 'Ingrese un teléfono válido (7 a 15 dígitos).'
      },
    },
    { name: 'address', type: 'textarea', label: 'Dirección' },
    { name: 'city', type: 'text', label: 'Ciudad' },
    { name: 'country', type: 'text', defaultValue: DEFAULT_COUNTRY, label: 'País' },
    {
      // Tax id printed on receipts (DR: RNC). Optional.
      name: 'taxId',
      type: 'text',
      label: 'RNC / identificación fiscal',
    },
    {
      // MVP: `individual` (one doctor, optional assistant) hides multi-doctor tooling
      // in the UI. Data model is identical either way, so growing into `clinic` is a
      // settings change, not a migration.
      name: 'practiceType',
      type: 'select',
      required: true,
      defaultValue: 'individual',
      label: 'Tipo de práctica',
      options: PRACTICE_TYPES.map((t) => ({ label: t.label, value: t.value })),
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      access: { update: superAdminField }, // owners can never suspend/unsuspend themselves
      options: [
        // `pending` = a self-serve signup awaiting super-admin approval (v3 §3.2).
        // Manually-created clinics start `active`; self-serve start `pending`.
        { label: 'Pendiente de aprobación', value: 'pending' },
        { label: 'Activo', value: 'active' },
        { label: 'Suspendido', value: 'suspended' },
      ],
    },
    {
      name: 'plan',
      type: 'select',
      required: true,
      defaultValue: 'free',
      access: { update: superAdminField }, // only superAdmin moves a tenant between plans
      options: PLANS.map((p) => ({ label: planLabel(p), value: p })),
      label: 'Plan',
      admin: { description: 'Nivel de suscripción; límites definidos en código (src/lib/plans.ts).' },
    },
    {
      // Owner's pending "Request upgrade" (v3 spec §5). Cleared by superAdmin on
      // approve/reject. No real billing — the enforcement & workflow are the product.
      name: 'upgradeRequest',
      type: 'group',
      label: 'Solicitud de mejora de plan',
      fields: [
        {
          name: 'requestedPlan',
          type: 'select',
          options: PLANS.map((p) => ({ label: planLabel(p), value: p })),
        },
        { name: 'requestedAt', type: 'date' },
        { name: 'note', type: 'textarea', label: 'Nota del titular' },
      ],
    },
    {
      name: 'onboardingSource',
      type: 'select',
      required: true,
      defaultValue: 'manual',
      access: { update: superAdminField },
      options: [
        { label: 'Autoregistro', value: 'self-serve' },
        { label: 'Manual', value: 'manual' },
      ],
      admin: { description: 'Cómo se creó este consultorio (analítica).' },
    },
    {
      name: 'settings',
      type: 'group',
      label: 'Configuración',
      fields: [
        {
          name: 'appointmentDurationMins',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_APPOINTMENT_DURATION,
          label: 'Duración por defecto de la cita (minutos)',
          min: 5,
          max: 120,
        },
        {
          name: 'openTime',
          type: 'text',
          required: true,
          defaultValue: DEFAULT_OPEN_TIME,
          label: 'Hora de apertura (HH:mm)',
        },
        {
          name: 'closeTime',
          type: 'text',
          required: true,
          defaultValue: DEFAULT_CLOSE_TIME,
          label: 'Hora de cierre (HH:mm)',
        },
        {
          name: 'currency',
          type: 'select',
          required: true,
          defaultValue: DEFAULT_CURRENCY,
          options: CURRENCIES.map((c) => ({ label: c.label, value: c.value })),
          label: 'Moneda',
          admin: { description: 'Todos los montos se muestran en esta moneda.' },
        },
        {
          name: 'timezone',
          type: 'select',
          required: true,
          defaultValue: DEFAULT_TIMEZONE,
          options: TIMEZONES.map((t) => ({ label: t.label, value: t.value })),
          label: 'Zona horaria',
          admin: { description: 'Todas las horas se muestran en esta zona horaria.' },
        },
        {
          name: 'consultTemplate',
          type: 'select',
          defaultValue: 'general',
          options: [
            { label: 'General', value: 'general' },
            { label: 'Nutrición', value: 'nutrition' },
          ],
          label: 'Formato de consulta',
          admin: { description: 'Nutrición agrega antropometría, laboratorio y la hoja de seguimiento.' },
        },
        {
          name: 'onlineBookingEnabled',
          type: 'checkbox',
          defaultValue: true,
          label: 'Reservas en línea',
          admin: { description: 'Los pacientes agendan desde el enlace público, dentro del horario de cada médico.' },
        },
        {
          name: 'onlineRequestsEnabled',
          type: 'checkbox',
          defaultValue: false,
          label: 'Solicitudes adicionales o de emergencia',
          admin: { description: 'Permite pedir una cita fuera de los horarios publicados; el consultorio la revisa.' },
        },
      ],
    },
  ],
}
