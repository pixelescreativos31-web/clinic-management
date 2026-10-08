'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { toActionError, type ActionResult } from '@/lib/errors'

export type PatientHit = { id: string; name: string; phone: string; mrn: string }

async function ctx() {
  const user = await getCurrentUser()
  if (!user || user.role === 'superAdmin') return null
  const payload = await getPayloadClient()
  return { user, payload, tenantID: getTenantID(user) }
}

/** Search patients by name / phone / MRN within the user's tenant. */
export async function searchPatients(query: string): Promise<PatientHit[]> {
  const c = await ctx()
  if (!c || !query.trim()) return []
  const q = query.trim()
  const res = await c.payload.find({
    collection: 'patients',
    where: {
      or: [
        { name: { like: q } },
        { phone: { like: q } },
        { mrn: { like: q } },
        ...(q.replace(/[^0-9]/g, '').length >= 4 ? [{ documentNumber: { like: q.replace(/[^0-9]/g, '') } }] : []),
      ],
    },
    user: c.user,
    overrideAccess: false,
    limit: 8,
    depth: 0,
  })
  return res.docs.map((p) => ({
    id: String(p.id),
    name: p.name,
    phone: p.phone,
    mrn: p.mrn ?? '',
  }))
}

/** Find patients sharing a phone (dedupe warning). */
export async function findByPhone(phone: string): Promise<PatientHit[]> {
  const c = await ctx()
  if (!c || !phone.trim()) return []
  const res = await c.payload.find({
    collection: 'patients',
    where: { phone: { equals: phone.trim() } },
    user: c.user,
    overrideAccess: false,
    limit: 5,
    depth: 0,
  })
  return res.docs.map((p) => ({ id: String(p.id), name: p.name, phone: p.phone, mrn: p.mrn ?? '' }))
}

export type PatientInput = {
  name: string
  phone: string
  gender: string
  ageYears?: number
  dateOfBirth?: string
  bloodGroup?: string
  allergies?: string
  notes?: string
  documentType?: string
  documentNumber?: string
  email?: string
  address?: string
  occupation?: string
  nationality?: string
  maritalStatus?: string
  religion?: string
  referredBy?: string
  insurance?: { provider?: string; affiliateNumber?: string; plan?: string }
  emergencyContact?: { name?: string; relationship?: string; phone?: string }
  history?: {
    personal?: string
    chronicConditions?: string
    surgical?: string
    family?: string
    medications?: string
    habits?: string
    gynecoObstetric?: string
    vaccines?: string
  }
}

/** Empty strings → null so clearing a field in the form really clears it. */
const clean = <T extends Record<string, unknown>>(obj: T | undefined): Record<string, unknown> | undefined =>
  obj ? Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' && !v.trim() ? null : v])) : undefined

/** Shared create/update payload (field-level access strips `history` for assistants). */
function toData(input: PatientInput) {
  return {
    name: input.name,
    phone: input.phone,
    gender: input.gender,
    ageYears: input.ageYears ?? null,
    dateOfBirth: input.dateOfBirth || null,
    bloodGroup: input.bloodGroup || null,
    allergies: input.allergies || null,
    notes: input.notes || null,
    documentType: input.documentType || 'cedula',
    documentNumber: input.documentNumber || null,
    email: input.email || null,
    address: input.address || null,
    occupation: input.occupation || null,
    nationality: input.nationality || null,
    maritalStatus: input.maritalStatus || null,
    religion: input.religion || null,
    referredBy: input.referredBy || null,
    insurance: clean(input.insurance),
    emergencyContact: clean(input.emergencyContact),
    ...(input.history ? { history: clean(input.history) } : {}),
  }
}

const REQUIRED_MSG = 'Nombre, teléfono y sexo son obligatorios.'
const FORBIDDEN = { ok: false as const, code: 'FORBIDDEN', message: 'No tiene permiso para realizar esta acción.' }

export async function updatePatient(
  id: string,
  input: PatientInput,
): Promise<ActionResult<PatientHit>> {
  const c = await ctx()
  if (!c) return FORBIDDEN
  if (!input.name || !input.phone || !input.gender) {
    return { ok: false, code: 'VALIDATION', message: REQUIRED_MSG }
  }
  try {
    const p = await c.payload.update({
      collection: 'patients',
      id,
      user: c.user,
      overrideAccess: false,
      data: toData(input) as never,
    })
    revalidatePath('/dashboard/patients')
    revalidatePath(`/dashboard/patients/${id}`)
    return { ok: true, data: { id: String(p.id), name: p.name, phone: p.phone, mrn: p.mrn ?? '' } }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}

export async function createPatient(input: PatientInput): Promise<ActionResult<PatientHit>> {
  const c = await ctx()
  if (!c) return FORBIDDEN
  if (!input.name || !input.phone || !input.gender) {
    return { ok: false, code: 'VALIDATION', message: REQUIRED_MSG }
  }
  try {
    const p = await c.payload.create({
      collection: 'patients',
      user: c.user,
      overrideAccess: false,
      data: toData(input) as never,
    })
    revalidatePath('/dashboard/patients')
    return { ok: true, data: { id: String(p.id), name: p.name, phone: p.phone, mrn: p.mrn ?? '' } }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}
