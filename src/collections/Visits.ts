import type { CollectionConfig, Field } from 'payload'
import { GOOD_BAD, NUTRITION_FIELDS, YES_NO } from '@/lib/nutrition'
import { APIError } from 'payload'
import { tenantScoped, denyAll, visitsWriteAccess, getTenantID, clinicalReadField } from '@/access'
import { auditVisits } from '@/hooks/audit'
import { forceTenant } from '@/hooks/tenant'
import {
  ERROR_CODES,
  PRESCRIPTION_FREQUENCIES,
  VISIT_ALLOWED_APPOINTMENT_STATUSES,
  type AppointmentStatus,
} from '@/lib/constants'

/** Normalise a relationship value (id | populated doc) to its id string. */
const relID = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return String((value as { id: string | number }).id)
  }
  return String(value)
}

/**
 * Visits — a completed consultation (v2 spec §2.1). One appointment = max one visit.
 * The clinical record: symptoms, diagnosis, vitals, prescription rows and follow-up.
 * `patient`/`doctor` are denormalised from the appointment (it never moves/deletes,
 * so there's no drift risk and patient-timeline queries stay simple).
 */
export const Visits: CollectionConfig = {
  slug: 'visits',
  labels: { singular: 'Consulta', plural: 'Consultas' },
  admin: { useAsTitle: 'diagnosis', defaultColumns: ['visitDate', 'patient', 'doctor', 'diagnosis'] },
  access: {
    read: tenantScoped,
    create: visitsWriteAccess,
    update: visitsWriteAccess,
    delete: denyAll, // clinical history is the product — never hard-delete
  },
  timestamps: true,
  hooks: {
    beforeValidate: [
      async ({ data, req, operation }) => {
        if (!data) return data
        if (operation !== 'create') return data

        const appointmentID = relID(data.appointment)
        if (!appointmentID) {
          throw new APIError('La consulta debe estar vinculada a una cita.', 400, {
            code: ERROR_CODES.VALIDATION,
          })
        }

        const appt = await req.payload
          .findByID({ collection: 'appointments', id: appointmentID, depth: 0, req, overrideAccess: true })
          .catch(() => null)
        if (!appt) {
          throw new APIError('No se encontró la cita.', 400, {
            code: ERROR_CODES.VALIDATION,
          })
        }

        // Same-tenant guard — a visit can never attach to another clinic's appointment.
        const intendedTenant = relID(data.tenant) ?? getTenantID(req.user)
        if (intendedTenant && String(relID(appt.tenant)) !== String(intendedTenant)) {
          throw new APIError('Esa cita pertenece a otro consultorio.', 403, {
            code: ERROR_CODES.FORBIDDEN,
          })
        }

        // The patient must be checked in (or already completed) before a visit.
        if (!VISIT_ALLOWED_APPOINTMENT_STATUSES.includes(appt.status as AppointmentStatus)) {
          throw new APIError('Registre la llegada del paciente antes de iniciar la consulta.', 400, {
            code: ERROR_CODES.INVALID_APPOINTMENT_STATE,
          })
        }

        // One visit per appointment (friendly guard; a unique index backstops it).
        const existing = await req.payload.count({
          collection: 'visits',
          where: { appointment: { equals: appointmentID } },
          req,
          overrideAccess: true,
        })
        if (existing.totalDocs > 0) {
          throw new APIError('Ya se registró una consulta para esta cita.', 409, {
            code: ERROR_CODES.VISIT_EXISTS,
          })
        }

        // Denormalise from the appointment; default the visit date to now.
        data.patient = relID(appt.patient)
        data.doctor = relID(appt.doctor)
        if (!data.visitDate) data.visitDate = new Date().toISOString()

        return data
      },
    ],
    beforeChange: [
      forceTenant,
      ({ data, req, operation }) => {
        if (operation === 'create' && req.user) data.createdBy = req.user.id
        return data
      },
    ],
    afterChange: [
      // Closing the consult in one action: a checked-in appointment becomes completed
      // the moment its visit is recorded (saves the front desk a manual step).
      async ({ doc, req, operation }) => {
        if (operation !== 'create') return
        const appointmentID = relID(doc.appointment)
        if (!appointmentID) return
        const appt = await req.payload
          .findByID({ collection: 'appointments', id: appointmentID, depth: 0, req, overrideAccess: true })
          .catch(() => null)
        if (appt?.status === 'checked-in') {
          await req.payload
            .update({
              collection: 'appointments',
              id: appointmentID,
              data: { status: 'completed' },
              req,
              overrideAccess: true,
            })
            .catch(() => {})
        }
      },
      auditVisits,
    ],
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      access: { update: () => false },
    },
    {
      name: 'appointment',
      type: 'relationship',
      relationTo: 'appointments',
      required: true,
      access: { update: () => false }, // immutable link
      filterOptions: ({ user }) => {
        const tenantID = getTenantID(user as never)
        const base: Record<string, unknown> = { status: { in: VISIT_ALLOWED_APPOINTMENT_STATUSES } }
        if (tenantID) base.tenant = { equals: tenantID }
        return base as never
      },
    },
    // Auto-copied from the appointment in beforeValidate; immutable afterwards.
    { name: 'patient', type: 'relationship', relationTo: 'patients', required: true, access: { update: () => false } },
    { name: 'doctor', type: 'relationship', relationTo: 'users', required: true, access: { update: () => false } },
    {
      name: 'visitDate',
      type: 'date',
      required: true,
      label: 'Fecha de la consulta',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'chiefComplaint', type: 'textarea', label: 'Motivo de consulta' },
    // Clinical narrative. Field-level read is limited to clinical roles (doctor /
    // owner): an assistant can print the prescription but never reads the history,
    // exam or private notes.
    {
      name: 'symptoms',
      type: 'textarea',
      label: 'Historia de la enfermedad actual',
      access: { read: clinicalReadField },
    },
    {
      name: 'physicalExam',
      type: 'textarea',
      label: 'Examen físico',
      access: { read: clinicalReadField },
    },
    { name: 'diagnosis', type: 'text', label: 'Diagnóstico' },
    {
      name: 'treatmentPlan',
      type: 'textarea',
      label: 'Plan e indicaciones',
      admin: { description: 'Se imprime en la receta como indicaciones generales.' },
    },
    {
      name: 'labOrders',
      type: 'textarea',
      label: 'Estudios indicados',
      admin: { description: 'Laboratorios, imágenes u otros estudios. Se imprime en la receta.' },
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notas privadas',
      access: { read: clinicalReadField },
      admin: { description: 'Solo visibles para el personal clínico.' },
    },
    {
      name: 'vitals',
      type: 'group',
      label: 'Signos vitales',
      fields: [
        { name: 'bpSystolic', type: 'number', min: 40, max: 300, label: 'Presión sistólica (mmHg)' },
        { name: 'bpDiastolic', type: 'number', min: 20, max: 200, label: 'Presión diastólica (mmHg)' },
        { name: 'pulse', type: 'number', min: 20, max: 250, label: 'Frecuencia cardíaca (lpm)' },
        { name: 'respiratoryRate', type: 'number', min: 4, max: 80, label: 'Frecuencia respiratoria (rpm)' },
        { name: 'temperatureC', type: 'number', min: 30, max: 45, label: 'Temperatura (°C)' },
        { name: 'oxygenSaturation', type: 'number', min: 50, max: 100, label: 'Saturación O₂ (%)' },
        { name: 'weightKg', type: 'number', min: 0.5, max: 500, label: 'Peso (kg)' },
        { name: 'heightCm', type: 'number', min: 20, max: 250, label: 'Talla (cm)' },
        { name: 'glucoseMgDl', type: 'number', min: 10, max: 1000, label: 'Glucemia (mg/dL)' },
      ],
    },
    // Consultation format chosen in the form; the clinic's consultTemplate is only
    // the default. Nutrition adds the fields below.
    {
      name: 'format',
      type: 'select',
      label: 'Formato',
      options: [
        { label: 'General', value: 'general' },
        { label: 'Nutrición', value: 'nutrition' },
      ],
    },
    // Nutrition template (clinics with settings.consultTemplate = 'nutrition').
    // Field list lives in src/lib/nutrition.ts; clinical roles only, like the exam.
    {
      name: 'nutrition',
      type: 'group',
      label: 'Nutrición',
      access: { read: clinicalReadField },
      fields: NUTRITION_FIELDS.map((f): Field => {
        const label = f.unit ? `${f.label} (${f.unit})` : f.label
        if (f.kind === 'number') return { name: f.key, type: 'number', label, min: f.min, max: f.max }
        if (f.kind === 'yesno' || f.kind === 'goodbad') {
          return { name: f.key, type: 'select', label, options: f.kind === 'yesno' ? YES_NO : GOOD_BAD }
        }
        return f.long ? { name: f.key, type: 'textarea', label } : { name: f.key, type: 'text', label }
      }),
    },
    {
      name: 'prescription',
      type: 'array',
      label: 'Receta',
      labels: { singular: 'Medicamento', plural: 'Medicamentos' },
      fields: [
        { name: 'medicine', type: 'text', required: true, label: 'Medicamento' },
        { name: 'dosage', type: 'text', label: 'Dosis', admin: { placeholder: 'p. ej. 500 mg', width: '33%' } },
        {
          name: 'frequency',
          type: 'select',
          label: 'Frecuencia',
          options: PRESCRIPTION_FREQUENCIES.map((f) => ({ label: f.label, value: f.value })),
        },
        {
          name: 'frequencyNote',
          type: 'text',
          label: 'Frecuencia (detalle)',
          admin: { condition: (_data, sibling) => sibling?.frequency === 'other' },
        },
        { name: 'durationDays', type: 'number', min: 0, label: 'Duración (días)' },
        { name: 'quantity', type: 'text', label: 'Cantidad a dispensar', admin: { placeholder: 'p. ej. 1 caja' } },
        { name: 'instructions', type: 'text', label: 'Indicaciones', admin: { placeholder: 'p. ej. después de las comidas' } },
      ],
    },
    { name: 'followUpDate', type: 'date', label: 'Próxima cita / seguimiento', admin: { date: { pickerAppearance: 'dayOnly' } } },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      access: { update: () => false },
      admin: { readOnly: true },
    },
  ],
  indexes: [
    { fields: ['tenant', 'patient', 'visitDate'] },
    { fields: ['tenant', 'appointment'], unique: true },
  ],
}
