import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { superAdminOnly, tenantScoped, getTenantID, clinicalReadField } from '@/access'
import { forceTenant } from '@/hooks/tenant'
import { enforcePlanLimit } from '@/hooks/planLimit'
import { GENDERS, GENDER_LABELS, BLOOD_GROUPS, DOCUMENT_TYPES, ERROR_CODES, MARITAL_STATUSES } from '@/lib/constants'
import { auditPatients } from '@/hooks/audit'

/** Strip spaces/dashes; keep leading + and digits. Market-agnostic. */
const normalizePhone = (raw: string): string => {
  const trimmed = raw.trim()
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/[^0-9]/g, '')
  return hasPlus ? `+${digits}` : digits
}

export const Patients: CollectionConfig = {
  slug: 'patients',
  labels: { singular: 'Paciente', plural: 'Pacientes' },
  admin: { useAsTitle: 'name', defaultColumns: ['mrn', 'name', 'documentNumber', 'phone'] },
  access: {
    read: tenantScoped,
    create: tenantScoped,
    update: tenantScoped,
    delete: superAdminOnly, // clinics don't hard-delete patients
  },
  timestamps: true,
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        if (data.phone) data.phone = normalizePhone(data.phone)
        if (data.emergencyContact?.phone) {
          data.emergencyContact.phone = normalizePhone(data.emergencyContact.phone)
        }
        // Cédula is stored digits-only (001-1234567-8 → 00112345678) so search and
        // dedupe don't depend on how it was typed.
        if (data.documentNumber && (data.documentType ?? 'cedula') === 'cedula') {
          data.documentNumber = String(data.documentNumber).replace(/[^0-9]/g, '')
        }
        // Clinics often know only the age. Require at least one of DOB / age.
        if (!data.dateOfBirth && (data.ageYears === undefined || data.ageYears === null)) {
          throw new APIError('Indique la fecha de nacimiento o la edad.', 400, {
            code: ERROR_CODES.VALIDATION,
          })
        }
        return data
      },
    ],
    beforeChange: [
      forceTenant,
      // Plan cap: a new patient beyond the tenant's plan limit is rejected (runs after
      // forceTenant so the tenant is resolved, before we assign an MRN we'd waste).
      enforcePlanLimit('patients'),
      // Per-clinic human-friendly MRN: P-0001, P-0002, …
      async ({ data, req, operation }) => {
        if (operation !== 'create') return data
        const tenantID = data.tenant ? String(data.tenant) : getTenantID(req.user)
        if (!tenantID) {
          throw new APIError('No se puede asignar un número de expediente sin consultorio.', 400, {
            code: ERROR_CODES.VALIDATION,
          })
        }
        const existing = await req.payload.count({
          collection: 'patients',
          where: { tenant: { equals: tenantID } },
          req,
        })
        const next = existing.totalDocs + 1
        data.mrn = `P-${String(next).padStart(4, '0')}`
        return data
      },
    ],
    afterChange: [auditPatients],
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      access: { update: () => false }, // immutable after create
    },
    {
      name: 'mrn',
      type: 'text',
      label: 'N.º de expediente',
      admin: { readOnly: true, description: 'Se asigna automáticamente por consultorio.' },
    },
    { name: 'name', type: 'text', required: true, label: 'Nombre completo' },
    {
      name: 'documentType',
      type: 'select',
      defaultValue: 'cedula',
      label: 'Tipo de documento',
      options: DOCUMENT_TYPES.map((d) => ({ label: d.label, value: d.value })),
    },
    { name: 'documentNumber', type: 'text', index: true, label: 'N.º de documento' },
    { name: 'phone', type: 'text', required: true, index: true, label: 'Teléfono' },
    { name: 'email', type: 'email', label: 'Correo electrónico' },
    {
      name: 'gender',
      type: 'select',
      required: true,
      label: 'Sexo',
      options: GENDERS.map((g) => ({ label: GENDER_LABELS[g], value: g })),
    },
    {
      name: 'dateOfBirth',
      type: 'date',
      label: 'Fecha de nacimiento',
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
    { name: 'ageYears', type: 'number', min: 0, max: 130, label: 'Edad (años)' },
    {
      name: 'bloodGroup',
      type: 'select',
      label: 'Grupo sanguíneo',
      options: BLOOD_GROUPS.map((b) => ({ label: b, value: b })),
    },
    { name: 'address', type: 'textarea', label: 'Dirección' },
    { name: 'occupation', type: 'text', label: 'Ocupación' },
    { name: 'nationality', type: 'text', label: 'Nacionalidad' },
    {
      name: 'maritalStatus',
      type: 'select',
      label: 'Estado civil',
      options: MARITAL_STATUSES.map((m) => ({ label: m.label, value: m.value })),
    },
    { name: 'religion', type: 'text', label: 'Religión' },
    { name: 'referredBy', type: 'text', label: 'Referido por' },
    {
      name: 'insurance',
      type: 'group',
      label: 'Seguro médico',
      fields: [
        { name: 'provider', type: 'text', label: 'Aseguradora (ARS)' },
        { name: 'affiliateNumber', type: 'text', label: 'N.º de afiliado' },
        { name: 'plan', type: 'text', label: 'Plan' },
      ],
    },
    {
      name: 'emergencyContact',
      type: 'group',
      label: 'Contacto de emergencia',
      fields: [
        { name: 'name', type: 'text', label: 'Nombre' },
        { name: 'relationship', type: 'text', label: 'Parentesco' },
        { name: 'phone', type: 'text', label: 'Teléfono' },
      ],
    },
    {
      name: 'allergies',
      type: 'textarea',
      label: 'Alergias',
      admin: { description: 'Se muestra de forma destacada en el expediente (seguridad).' },
    },
    {
      // Background ("antecedentes") — the part of the clinical history that changes
      // rarely and is reviewed at every consultation.
      name: 'history',
      type: 'group',
      label: 'Antecedentes',
      // Clinical background is for clinical roles only; an assistant registers the
      // patient's demographics but never reads or edits their medical history.
      access: { read: clinicalReadField, create: clinicalReadField, update: clinicalReadField },
      fields: [
        { name: 'personal', type: 'textarea', label: 'Antecedentes patológicos personales' },
        { name: 'chronicConditions', type: 'textarea', label: 'Enfermedades crónicas' },
        { name: 'surgical', type: 'textarea', label: 'Antecedentes quirúrgicos' },
        { name: 'family', type: 'textarea', label: 'Antecedentes familiares' },
        { name: 'medications', type: 'textarea', label: 'Medicamentos actuales' },
        { name: 'habits', type: 'textarea', label: 'Hábitos (tabaco, alcohol, actividad física)' },
        { name: 'gynecoObstetric', type: 'textarea', label: 'Antecedentes gineco-obstétricos' },
        { name: 'vaccines', type: 'textarea', label: 'Vacunas' },
      ],
    },
    { name: 'notes', type: 'textarea', label: 'Notas' },
  ],
  // Compound indexes (spec §5)
  indexes: [
    { fields: ['tenant', 'phone'] },
    { fields: ['tenant', 'documentNumber'] },
    { fields: ['tenant', 'mrn'], unique: true },
  ],
}
