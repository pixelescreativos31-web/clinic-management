'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { toActionError, type ActionResult } from '@/lib/errors'

export type ClinicSettingsInput = {
  name: string
  phone: string
  address?: string
  city?: string
  country?: string
  taxId?: string
  practiceType?: 'individual' | 'clinic'
  consultTemplate?: 'general' | 'nutrition'
  onlineBookingEnabled?: boolean
  onlineRequestsEnabled?: boolean
  appointmentDurationMins: number
  openTime: string
  closeTime: string
  currency: string
  timezone: string
}

const HHMM = /^\d{2}:\d{2}$/

/** Owner edits their own clinic profile & settings (access enforced by Payload). */
export async function updateClinicSettings(
  input: ClinicSettingsInput,
): Promise<ActionResult<null>> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'owner') {
    return { ok: false, code: 'FORBIDDEN', message: 'No tiene permiso para realizar esta acción.' }
  }
  const tenantID = getTenantID(user)
  if (!tenantID) {
    return { ok: false, code: 'FORBIDDEN', message: 'Su usuario no está vinculado a un consultorio.' }
  }
  if (!input.name || !input.phone) {
    return { ok: false, code: 'VALIDATION', message: 'El nombre y el teléfono del consultorio son obligatorios.' }
  }
  if (!HHMM.test(input.openTime) || !HHMM.test(input.closeTime)) {
    return { ok: false, code: 'VALIDATION', message: 'Las horas deben tener el formato HH:mm.' }
  }

  try {
    const payload = await getPayloadClient()
    await payload.update({
      collection: 'tenants',
      id: tenantID,
      user,
      overrideAccess: false,
      data: {
        name: input.name,
        phone: input.phone,
        address: input.address || null,
        city: input.city || null,
        country: input.country || null,
        taxId: input.taxId || null,
        ...(input.practiceType ? { practiceType: input.practiceType } : {}),
        settings: {
          appointmentDurationMins: input.appointmentDurationMins,
          openTime: input.openTime,
          closeTime: input.closeTime,
          currency: input.currency,
          timezone: input.timezone,
          consultTemplate: input.consultTemplate === 'nutrition' ? 'nutrition' : 'general',
          onlineBookingEnabled: input.onlineBookingEnabled !== false,
          onlineRequestsEnabled: input.onlineRequestsEnabled === true,
        },
      } as never,
    })
    revalidatePath('/dashboard', 'layout')
    return { ok: true, data: null }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}

export type PractitionerProfileInput = {
  practitioner: boolean
  specialty?: string
  licenseNumber?: string
  consultationFee?: number
  availableDays?: string[]
  availableFrom?: string
  availableTo?: string
}

/**
 * The owner's own medical profile ("Mi perfil médico"): whether they see patients
 * and the details printed on prescriptions. Updates only the caller's own record.
 */
export async function updateMyPractitionerProfile(
  input: PractitionerProfileInput,
): Promise<ActionResult<null>> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'owner') {
    return { ok: false, code: 'FORBIDDEN', message: 'No tiene permiso para realizar esta acción.' }
  }
  if (input.practitioner) {
    if ((input.availableFrom && !HHMM.test(input.availableFrom)) || (input.availableTo && !HHMM.test(input.availableTo))) {
      return { ok: false, code: 'VALIDATION', message: 'Las horas deben tener el formato HH:mm.' }
    }
    if (input.availableDays && input.availableDays.length === 0) {
      return { ok: false, code: 'VALIDATION', message: 'Elija al menos un día de consulta.' }
    }
  }
  try {
    const payload = await getPayloadClient()
    await payload.update({
      collection: 'users',
      id: user.id,
      user,
      overrideAccess: false,
      data: {
        practitioner: input.practitioner,
        ...(input.practitioner
          ? {
              specialty: input.specialty || null,
              licenseNumber: input.licenseNumber || null,
              consultationFee: input.consultationFee ?? null,
              availabilityType: 'regular',
              availableDays: input.availableDays,
              availableFrom: input.availableFrom,
              availableTo: input.availableTo,
            }
          : {}),
      } as never,
    })
    revalidatePath('/dashboard', 'layout')
    return { ok: true, data: null }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}
