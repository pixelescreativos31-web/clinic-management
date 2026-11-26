// Plan-card chip and line for a billing-managed clinic. Server-side only: the
// date-with-time format differs between Node's ICU and browsers.

import { planLabel } from '@/lib/plans'
import type { BillingView } from './service'
import { dateTimeLabel, endSentence, type TimeFormat } from '@/lib/regional'

const longDate = (iso: string) =>
  new Date(iso).toLocaleString('es-DO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Santo_Domingo',
  })

/** Chip + line under the plan name for a billing-managed clinic. */
export function billingSummary(view: BillingView, fmt?: TimeFormat): { chip: string; line: string | null } | null {
  const when = (iso: string) => dateTimeLabel(iso, 'America/Santo_Domingo', fmt)
  switch (view.kind) {
    case 'pending':
      return { chip: 'Terminando su suscripción…', line: 'Esperando la confirmación de PayPal.' }
    case 'trialing':
      return {
        chip: 'En prueba',
        line: endSentence(`Prueba: quedan ${view.daysLeft} ${view.daysLeft === 1 ? 'día' : 'días'}. Primer cobro el ${when(view.endsAt)}`),
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
            ? `${endSentence(`Su prueba sigue activa hasta el ${when(view.endsAt)}`)} No se le cobrará nada.`
            : `Su plan termina el ${longDate(view.endsAt)}.`
          : null,
      }
    case 'free':
      return view.downgradedFrom ? { chip: 'Gratis', line: `Su cuenta pasó a Gratis. Recupere ${planLabel(view.downgradedFrom)} en un clic.` } : null
    default:
      return null
  }
}

