'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getPayloadClient } from '@/lib/auth'
import { toActionError, type ActionResult } from '@/lib/errors'
import { rateLimit } from '@/lib/rateLimit'
import {
  bookOnline,
  freeSlots,
  getPublicClinic,
  requestOnline,
  type OnlineBookingInput,
  type OnlineRequestInput,
} from '@/lib/publicBooking'

// Abuse guards for an unauthenticated form (per IP, per hour).
const MAX_BOOKINGS_PER_HOUR = 5
const MAX_REQUESTS_PER_HOUR = 3

const UNAVAILABLE = { ok: false as const, code: 'NOT_FOUND', message: 'Este consultorio no tiene reservas en línea disponibles.' }
const TOO_MANY = { ok: false as const, code: 'RATE_LIMITED', message: 'Demasiados intentos. Intente de nuevo más tarde o llame al consultorio.' }

async function clientIp(): Promise<string> {
  const h = await headers()
  // Behind Cloudflare Tunnel + Caddy the real client is in CF-Connecting-IP.
  return h.get('cf-connecting-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

export async function getSlots(slug: string, doctorId: string, date: string): Promise<string[]> {
  const payload = await getPayloadClient()
  const clinic = await getPublicClinic(payload, slug)
  if (!clinic) return []
  return freeSlots(payload, clinic, doctorId, date)
}

export async function submitBooking(
  slug: string,
  input: OnlineBookingInput,
): Promise<ActionResult<{ start: string; patientName: string }>> {
  const payload = await getPayloadClient()
  const clinic = await getPublicClinic(payload, slug)
  if (!clinic) return UNAVAILABLE
  if (!rateLimit(`book:${await clientIp()}`, MAX_BOOKINGS_PER_HOUR).allowed) return TOO_MANY
  try {
    const res = await bookOnline(payload, clinic, input)
    revalidatePath('/dashboard/appointments')
    revalidatePath('/dashboard')
    return { ok: true, data: { start: res.start, patientName: res.patientName } }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}

export async function submitRequest(slug: string, input: OnlineRequestInput): Promise<ActionResult<null>> {
  const payload = await getPayloadClient()
  const clinic = await getPublicClinic(payload, slug)
  if (!clinic) return UNAVAILABLE
  if (!rateLimit(`request:${await clientIp()}`, MAX_REQUESTS_PER_HOUR).allowed) return TOO_MANY
  try {
    await requestOnline(payload, clinic, input)
    revalidatePath('/dashboard/appointments')
    revalidatePath('/dashboard')
    return { ok: true, data: null }
  } catch (err) {
    return { ok: false, ...toActionError(err) }
  }
}
