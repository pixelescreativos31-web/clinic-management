import path from 'path'
import type { CollectionConfig, PayloadRequest } from 'payload'
import { APIError } from 'payload'
import { denyAll, getTenantID, visitsWriteAccess } from '@/access'
import { forceTenant } from '@/hooks/tenant'
import { auditProgramPhotos, auditPrograms } from '@/hooks/audit'
import { ERROR_CODES } from '@/lib/constants'
import { PHOTO_VIEWS } from '@/lib/program'

/** Normalise a relationship value (id | populated doc) to its id string. */
const relID = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) return String((value as { id: string }).id)
  return String(value)
}

/** The patient must belong to the acting user's clinic. */
async function assertSameTenantPatient(req: PayloadRequest, patientID: string | null, tenantID: string | null) {
  if (!patientID) throw new APIError('Indique el paciente.', 400, { code: ERROR_CODES.VALIDATION })
  const patient = await req.payload.findByID({ collection: 'patients', id: patientID, depth: 0, overrideAccess: true }).catch(() => null)
  if (!patient || (tenantID && relID(patient.tenant) !== tenantID)) {
    throw new APIError('Paciente no encontrado.', 404, { code: ERROR_CODES.FORBIDDEN })
  }
}

/**
 * Programmes — a patient's enrolment in a follow-up programme (an "episode of care":
 * FHIR EpisodeOfCare). It only tracks the episode; every control is a regular
 * consultation (Visits, format `program`) pointing here, so controls live in the
 * clinical record, the agenda and the audit trail like any other consultation.
 * Clinical roles only.
 */
export const Programs: CollectionConfig = {
  slug: 'programs',
  labels: { singular: 'Programa', plural: 'Programas' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'patient', 'status', 'startDate'] },
  access: {
    read: visitsWriteAccess,
    create: visitsWriteAccess,
    update: visitsWriteAccess,
    delete: denyAll, // close it instead; its controls are clinical history
  },
  timestamps: true,
  hooks: {
    beforeChange: [
      forceTenant,
      async ({ data, req, operation, originalDoc }) => {
        const tenantID = relID(data.tenant) ?? getTenantID(req.user)
        if (operation === 'create') {
          await assertSameTenantPatient(req, relID(data.patient), tenantID)
          const active = await req.payload.count({
            collection: 'programs',
            where: { tenant: { equals: tenantID }, patient: { equals: relID(data.patient) }, status: { equals: 'active' } },
            overrideAccess: true,
            req,
          })
          if (active.totalDocs > 0) {
            throw new APIError('El paciente ya está inscrito en un programa activo.', 409, { code: ERROR_CODES.VALIDATION })
          }
          if (req.user) data.createdBy = req.user.id
        }
        if (data.status && data.status !== 'active' && !data.endDate && !originalDoc?.endDate) {
          data.endDate = new Date().toISOString()
        }
        if (data.status === 'active') data.endDate = null
        return data
      },
    ],
    afterChange: [auditPrograms],
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true, access: { update: () => false } },
    { name: 'patient', type: 'relationship', relationTo: 'patients', required: true, index: true, access: { update: () => false } },
    { name: 'name', type: 'text', required: true, label: 'Programa' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      label: 'Estado',
      options: [
        { label: 'Activo', value: 'active' },
        { label: 'Completado', value: 'completed' },
        { label: 'Suspendido', value: 'cancelled' },
      ],
    },
    { name: 'startDate', type: 'date', required: true, label: 'Fecha de ingreso', admin: { date: { pickerAppearance: 'dayOnly' } } },
    { name: 'endDate', type: 'date', label: 'Fecha de cierre', admin: { date: { pickerAppearance: 'dayOnly' } } },
    { name: 'goal', type: 'text', label: 'Meta', admin: { placeholder: 'p. ej. Bajar 15 lb en 12 semanas' } },
    { name: 'responsible', type: 'relationship', relationTo: 'users', label: 'Responsable' },
    { name: 'createdBy', type: 'relationship', relationTo: 'users', access: { update: () => false }, admin: { readOnly: true } },
  ],
  indexes: [{ fields: ['tenant', 'patient', 'status'] }],
}

/** Where progress photos live on disk (a persistent volume in production). */
export const PROGRESS_PHOTO_DIR = process.env.MEDIA_DIR
  ? path.join(process.env.MEDIA_DIR, 'progress')
  : path.resolve(process.cwd(), 'media', 'progress')

/**
 * Progress photos for a programme: by view (front, profiles, back) and week, so the
 * first and latest of each view can be compared. Files are served through Payload,
 * which applies this collection's `read` access to every file request — they are
 * never public. Clinical roles only.
 */
export const ProgressPhotos: CollectionConfig = {
  slug: 'progressPhotos',
  labels: { singular: 'Foto de evolución', plural: 'Fotos de evolución' },
  admin: { useAsTitle: 'filename', defaultColumns: ['filename', 'patient', 'week', 'view'] },
  access: {
    read: visitsWriteAccess,
    create: visitsWriteAccess,
    update: visitsWriteAccess,
    delete: visitsWriteAccess, // a wrong photo can be removed (audited)
  },
  timestamps: true,
  upload: {
    staticDir: PROGRESS_PHOTO_DIR,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  hooks: {
    beforeChange: [
      forceTenant,
      async ({ data, req, operation }) => {
        if (operation !== 'create') return data
        const tenantID = relID(data.tenant) ?? getTenantID(req.user)
        const program = await req.payload
          .findByID({ collection: 'programs', id: relID(data.program) ?? '', depth: 0, overrideAccess: true })
          .catch(() => null)
        if (!program || relID(program.tenant) !== tenantID) {
          throw new APIError('Programa no encontrado.', 404, { code: ERROR_CODES.FORBIDDEN })
        }
        data.patient = relID(program.patient)
        if (req.user) data.uploadedBy = req.user.id
        return data
      },
    ],
    afterChange: [auditProgramPhotos],
    afterDelete: [
      async ({ doc, req }) => {
        await auditProgramPhotos({ doc, req, operation: 'delete' } as never)
      },
    ],
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true, access: { update: () => false } },
    { name: 'program', type: 'relationship', relationTo: 'programs', required: true, index: true, access: { update: () => false } },
    { name: 'patient', type: 'relationship', relationTo: 'patients', required: true, access: { update: () => false } },
    { name: 'week', type: 'number', required: true, min: 0, max: 520, label: 'Semana' },
    { name: 'view', type: 'select', required: true, label: 'Vista', options: PHOTO_VIEWS.map((v) => ({ label: v.label, value: v.value })) },
    { name: 'takenAt', type: 'date', required: true, label: 'Fecha', admin: { date: { pickerAppearance: 'dayOnly' } } },
    { name: 'uploadedBy', type: 'relationship', relationTo: 'users', access: { update: () => false }, admin: { readOnly: true } },
  ],
}
