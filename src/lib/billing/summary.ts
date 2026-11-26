// Plan-card chip and line for a billing-managed clinic. Server-side only: the
// date-with-time format differs between Node's ICU and browsers.

import { planLabel } from '@/lib/plans'
import type { BillingView } from './service'

const longDate = (iso: string, withTime = false) =>
  new Date(iso).toLocaleString('es-DO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Santo_Domingo',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}),
  })

/** Chip + line under the plan name for a billing-managed clinic. */
export function billingSummary(view: BillingView): { chip: string; line: string | null } | null {
  switch (view.kind) {
    case 'pending':
      return { chip: 'Terminando su suscripción…', line: 'Esperando la confirmación de PayPal.' }
    case 'trialing':
      return {
        chip: 'En prueba',
        line: `Prueba: quedan ${view.daysLeft} ${view.daysLeft === 1 ? 'día' : 'días'}. Primer cobro el ${longDate(view.endsAt, true)}.`,
      }
    case 'active':
      return { chip: 'Activa', line: view.renewsAt ? `Se renueva el ${longDate(view.renewsAt)}.` : null }
    case 'past_due':
      return { chip: 'Pago fallido', line: `No pudimos cobrar su plan. Su cuenta pasa a Gratis el ${longDate(view.downgradeAt)}.` }
    case 'cancelled':
      return {
        chip: 'Cancelada',
        line: view.endsAt
          ? view.inTrial
            ? `Su prueba sigue activa hasta el ${longDate(view.endsAt, true)}. No se le cobrará nada.`
            : `Su plan termina el ${longDate(view.endsAt)}.`
          : null,
      }
    case 'free':
      return view.downgradedFrom ? { chip: 'Gratis', line: `Su cuenta pasó a Gratis. Recupere ${planLabel(view.downgradedFrom)} en un clic.` } : null
    default:
      return null
  }
}

