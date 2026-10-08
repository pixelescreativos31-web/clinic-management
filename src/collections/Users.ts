import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import {
  getTenantID,
  isSuperAdmin,
  superAdminField,
  superAdminOnly,
  superAdminOrOwnerField,
  usersCreateAccess,
  usersReadAccess,
  usersUpdateAccess,
} from '@/access'
import { ROLES, ROLE_LABELS, ERROR_CODES, AVAILABILITY_TYPES, WEEKDAYS, ALL_DAYS } from '@/lib/constants'
import { isPractitioner } from '@/lib/practice'
import { enforcePlanLimit } from '@/hooks/planLimit'
import { auditUsers } from '@/hooks/audit'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Usuario', plural: 'Equipo' },
  // Login hardening: lock an account for 10 min after 5 failed attempts; sessions
  // expire after 12 h of inactivity (a shared clinic PC must not stay logged in).
  auth: {
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
    tokenExpiration: 12 * 60 * 60,
  },
  admin: { useAsTitle: 'email', defaultColumns: ['name', 'email', 'role', 'tenant'] },
  access: {
    // Only superAdmins reach the Payload admin panel; tenant staff live entirely
    // in the custom /dashboard (spec §6.4 — belt and suspenders with usersReadAccess).
    admin: ({ req: { user } }) => isSuperAdmin(user),
    read: usersReadAccess,
    create: usersCreateAccess,
    update: usersUpdateAccess,
    delete: superAdminOnly, // owners deactivate; they never hard-delete
  },
  timestamps: true,
  hooks: {
    // Login guard: deactivated staff and suspended clinics cannot log in.
    beforeLogin: [
      async ({ user, req }) => {
        if (user.active === false) {
          throw new APIError(
            'Su cuenta fue desactivada. Contacte al titular del consultorio.',
            403,
            { code: ERROR_CODES.USER_INACTIVE },
          )
        }
        // Self-serve owners confirm their email before anything else (BACKLOG §1.1).
        if (user.emailVerified === false) {
          throw new APIError(
            'Primero verifique su correo: revise su bandeja de entrada.',
            403,
            { code: ERROR_CODES.EMAIL_NOT_VERIFIED },
          )
        }
        const tenantID = getTenantID(user)
        if (tenantID) {
          const tenant = await req.payload.findByID({
            collection: 'tenants',
            id: tenantID,
            depth: 0,
            req,
          })
          if (tenant?.status === 'suspended') {
            throw new APIError(
              'La cuenta de este consultorio está suspendida. Contacte a soporte.',
              403,
              { code: ERROR_CODES.TENANT_SUSPENDED },
            )
          }
          if (tenant?.status === 'pending') {
            throw new APIError(
              'Su consultorio está pendiente de aprobación. Podrá iniciar sesión cuando sea aprobado.',
              403,
              { code: ERROR_CODES.TENANT_PENDING },
            )
          }
        }
      },
    ],
    beforeValidate: [
      ({ data, req, operation, originalDoc }) => {
        if (!data) return data
        const actor = req.user

        // Role/tenant consistency: superAdmin ⇔ no tenant; everyone else ⇔ tenant set.
        const role = data.role ?? originalDoc?.role
        if (role === 'superAdmin') {
          data.tenant = null
        }

        // A non-superAdmin may never create or promote a superAdmin.
        if (actor && !isSuperAdmin(actor) && data.role === 'superAdmin') {
          throw new APIError('No puede asignar el rol de superadministrador.', 403, {
            code: ERROR_CODES.FORBIDDEN,
          })
        }

        // An owner can only operate inside their own tenant.
        if (actor && !isSuperAdmin(actor)) {
          const actorTenant = getTenantID(actor)
          if (operation === 'create') {
            data.tenant = actorTenant // force-set, ignore client value
          }
          if (operation === 'update' && data.tenant && String(data.tenant) !== String(actorTenant)) {
            throw new APIError('No puede mover miembros del equipo a otro consultorio.', 403, {
              code: ERROR_CODES.FORBIDDEN,
            })
          }
        }
        return data
      },
    ],
    beforeChange: [
      ({ data }) => {
        if (data.role && data.role !== 'superAdmin' && !data.tenant) {
          throw new APIError('Todo miembro del equipo debe pertenecer a un consultorio.', 400, {
            code: ERROR_CODES.VALIDATION,
          })
        }
        return data
      },
      // Plan cap: a new active doctor beyond the tenant's plan limit is rejected.
      enforcePlanLimit('doctors'),
    ],
    afterChange: [auditUsers],
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Nombre' },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'receptionist',
      label: 'Rol',
      options: ROLES.map((r) => ({ label: ROLE_LABELS[r], value: r })),
      access: { update: superAdminOrOwnerField },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      index: true,
      access: { update: superAdminOrOwnerField },
      admin: {
        description: 'Obligatorio para todos los roles excepto superadministrador.',
        condition: (data) => data?.role !== 'superAdmin',
      },
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Teléfono',
      validate: (value: string | null | undefined) => {
        if (!value) return true
        return /^\+?[0-9]{7,15}$/.test(value.replace(/[\s-]/g, ''))
          ? true
          : 'Ingrese un teléfono válido (7 a 15 dígitos).'
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      label: 'Activo',
      access: { update: superAdminOrOwnerField },
    },
    // Email verification (BACKLOG §1.1). Everyone defaults to verified — only a
    // self-serve signup starts false (set by signupClinic with overrideAccess).
    // Only the token's sha256 hash is stored, never the token itself.
    {
      name: 'emailVerified',
      type: 'checkbox',
      defaultValue: true,
      label: 'Correo verificado',
      access: { create: superAdminField, update: superAdminField },
    },
    {
      name: 'verifyTokenHash',
      type: 'text',
      index: true,
      hidden: true,
      access: { create: superAdminField, read: superAdminField, update: superAdminField },
    },
    {
      name: 'verifyTokenExp',
      type: 'date',
      hidden: true,
      access: { create: superAdminField, read: superAdminField, update: superAdminField },
    },
    // An owner who also sees patients (independent doctor). Practitioner-only
    // fields below show for doctors and for practising owners.
    {
      name: 'practitioner',
      type: 'checkbox',
      defaultValue: false,
      label: 'Atiende pacientes (médico titular)',
      access: { update: superAdminOrOwnerField },
      admin: { condition: (data) => data?.role === 'owner' },
    },
    {
      name: 'specialty',
      type: 'text',
      label: 'Especialidad',
      admin: { condition: (data) => isPractitioner(data) },
    },
    {
      // DR: exequátur; elsewhere: medical licence / registration number. Printed on
      // prescriptions.
      name: 'licenseNumber',
      type: 'text',
      label: 'Exequátur / N.º de registro médico',
      admin: { condition: (data) => isPractitioner(data) },
    },
    {
      name: 'consultationFee',
      type: 'number',
      min: 0,
      label: 'Tarifa de consulta',
      admin: {
        condition: (data) => isPractitioner(data),
        description: 'En la moneda del consultorio. Se usa al facturar.',
      },
    },
    // Appointment types offered on the public booking page (/agendar/<slug>):
    // each with its own duration and display price. Empty ⇒ one "Consulta" at the
    // clinic's default duration and the consultation fee.
    {
      name: 'bookingServices',
      type: 'array',
      label: 'Tipos de cita en línea',
      maxRows: 8,
      admin: { condition: (data) => isPractitioner(data) },
      fields: [
        { name: 'name', type: 'text', required: true, label: 'Nombre' },
        { name: 'durationMins', type: 'number', required: true, min: 5, max: 240, label: 'Duración (min)' },
        { name: 'price', type: 'number', min: 0, label: 'Precio' },
      ],
    },
    // Availability pattern. `regular` doctors keep set weekdays + a daily window;
    // `onCall` and `byAppointment` doctors are bookable any time (different tags).
    {
      name: 'availabilityType',
      type: 'select',
      defaultValue: 'regular',
      label: 'Disponibilidad',
      options: AVAILABILITY_TYPES.map((t) => ({ label: t.label, value: t.value })),
      admin: { condition: (data) => isPractitioner(data) },
    },
    {
      name: 'availableDays',
      type: 'select',
      hasMany: true,
      defaultValue: ALL_DAYS,
      label: 'Días de consulta',
      options: WEEKDAYS.map((d) => ({ label: d.label, value: d.value })),
      admin: {
        condition: (data) => isPractitioner(data) && (data?.availabilityType ?? 'regular') === 'regular',
      },
    },
    {
      name: 'availableFrom',
      type: 'text',
      defaultValue: '09:00',
      label: 'Desde (HH:mm)',
      admin: { condition: (data) => isPractitioner(data) && (data?.availabilityType ?? 'regular') === 'regular' },
    },
    {
      name: 'availableTo',
      type: 'text',
      defaultValue: '17:00',
      label: 'Hasta (HH:mm)',
      admin: { condition: (data) => isPractitioner(data) && (data?.availabilityType ?? 'regular') === 'regular' },
    },
  ],
}
