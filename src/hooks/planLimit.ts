// Plan-limit enforcement (v3 spec §4). A beforeChange hook factory shared by the
// resources a plan caps: active doctors (Users) and patients (Patients).
//
// Rules:
//  - Only taking a NEW seat is gated: creating a patient or doctor, or an update
//    that makes a user start counting as a doctor (role change, owner starts
//    practising, reactivation). Existing data is never blocked or deleted — after a
//    downgrade that leaves a tenant over-limit, current records stay editable.
//  - Deactivated doctors don't count, so a clinic may deactivate one and add another.
//  - The count runs inside the request transaction (req threaded through) so it sees
//    a consistent view.

import type { CollectionBeforeChangeHook, Where } from 'payload'
import { APIError } from 'payload'
import { getTenantID } from '@/access'
import { ERROR_CODES } from '@/lib/constants'
import { asPlan, limitFor, planLabel, resourceLabel, type LimitedResource } from '@/lib/plans'
import { doctorWhere } from '@/lib/practice'

type CountedUser = { role?: unknown; practitioner?: unknown; active?: unknown } | null | undefined

/** Does this user occupy one of the plan's doctor seats? */
export function occupiesDoctorSeat(u: CountedUser): boolean {
  if (!u || u.active === false) return false
  return u.role === 'doctor' || (u.role === 'owner' && u.practitioner === true)
}

export function enforcePlanLimit(resource: LimitedResource): CollectionBeforeChangeHook {
  return async ({ data, req, operation, originalDoc }) => {
    if (!data) return data

    if (resource === 'doctors') {
      // Practitioners are the only capped users: doctors, plus an owner who also
      // practises (the independent-doctor setup). Other roles — therapists
      // included — pass through. A user is checked whenever they START taking a
      // seat: on create, and on an update that changes the role to doctor, turns
      // on an owner's «Atiendo pacientes», or reactivates a doctor. Otherwise any
      // of those would add a doctor past the plan's cap.
      const next = { ...(originalDoc ?? {}), ...data }
      if (!occupiesDoctorSeat(next)) return data
      if (operation === 'update' && occupiesDoctorSeat(originalDoc)) return data
      if (operation !== 'create' && operation !== 'update') return data
    } else if (operation !== 'create') {
      return data
    }

    const tenantID = data.tenant ? String(data.tenant) : originalDoc?.tenant ? String(typeof originalDoc.tenant === 'object' ? originalDoc.tenant.id : originalDoc.tenant) : getTenantID(req.user)
    if (!tenantID) return data // tenant-less paths (e.g. superAdmin) aren't plan-scoped

    const tenant = await req.payload.findByID({
      collection: 'tenants',
      id: tenantID,
      depth: 0,
      req,
    })
    const plan = asPlan(tenant?.plan)
    const limit = limitFor(plan, resource)
    if (limit === null) return data // unlimited

    const where: Where =
      resource === 'doctors'
        ? { and: [doctorWhere(tenantID), { active: { not_equals: false } }] }
        : { tenant: { equals: tenantID } }
    const collection = resource === 'doctors' ? 'users' : 'patients'

    const { totalDocs } = await req.payload.count({ collection, where, req })
    if (totalDocs >= limit) {
      throw new APIError(
        `Su plan ${planLabel(plan)} permite ${limit} ${resourceLabel(resource, limit)}. Solicite una mejora de plan para agregar más.`,
        403,
        { code: ERROR_CODES.PLAN_LIMIT },
      )
    }
    return data
  }
}
