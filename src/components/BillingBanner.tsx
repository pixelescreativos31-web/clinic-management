import Link from 'next/link'
import type { BillingView } from '@/lib/billing/service'

// Subscription notices on every dashboard page (spec §3). Day 0 of a failed charge
// is the soft amber strip; from day 3 the strip turns solid amber. Red stays
// reserved for clinical alerts (design rule in globals.css), so the escalation is
// in weight, not hue.

const DAY = 86_400_000
const SOFT = 'border-b border-[#f3e3c3] bg-[#faf3e6] text-[#78350f]'
const STRONG = 'border-b border-[#92400e] bg-[#b45309] text-white'
const QUIET = 'border-b border-[#d7ebe7] bg-[#f0f7f6] text-[#134e4a]'

const longDate = (iso: string, withTime = false) =>
  new Date(iso).toLocaleString('es-DO', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Santo_Domingo',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}),
  })

type Banner = { tone: string; text: string; cta?: { href: string; label: string; external?: boolean }; level: string }

export function billingBanner(view: BillingView, role: string, manageUrl: string | null, now = new Date()): Banner | null {
  const owner = role === 'owner'
  const pay = manageUrl ? { href: manageUrl, label: 'Actualizar en PayPal', external: true } : { href: '/dashboard/plan', label: 'Ver mi plan' }
  if (view.kind === 'past_due') {
    if (!owner) {
      return view.days >= 7
        ? { tone: SOFT, level: 'staff', text: 'Hay un problema con el pago de la cuenta. Avise al Titular de la clínica.' }
        : null
    }
    const left = Math.max(0, Math.ceil((new Date(view.downgradeAt).getTime() - now.getTime()) / DAY))
    if (view.days >= 9) return { tone: STRONG, level: 'day9', text: 'Mañana su cuenta pasa a Gratis. Actualice su método de pago para conservar su plan.', cta: pay }
    if (view.days >= 7)
      return { tone: STRONG, level: 'day7', text: `Quedan ${left} días para que su cuenta pase a Gratis. Actualice su método de pago.`, cta: pay }
    return {
      tone: view.days >= 3 ? STRONG : SOFT,
      level: view.days >= 3 ? 'day3' : 'day0',
      text: 'No pudimos cobrar su plan. Actualice su método de pago en PayPal; sus datos están seguros.',
      cta: pay,
    }
  }
  if (!owner) return null
  if (view.kind === 'pending') return { tone: QUIET, level: 'pending', text: 'Terminando su suscripción… Le avisaremos por correo al activarse.' }
  if (view.kind === 'trialing')
    return {
      tone: QUIET,
      level: 'trial',
      text: `Prueba: quedan ${view.daysLeft} ${view.daysLeft === 1 ? 'día' : 'días'}. El primer cobro es el ${longDate(view.endsAt, true)}.`,
      cta: { href: '/dashboard/plan', label: 'Ver mi plan' },
    }
  if (view.kind === 'cancelled' && view.endsAt)
    return {
      tone: SOFT,
      level: 'cancelled',
      text: view.inTrial
        ? `Su prueba sigue activa hasta el ${longDate(view.endsAt, true)}. No se le cobrará nada.`
        : `Su plan termina el ${longDate(view.endsAt)}. Después su cuenta pasará a Gratis.`,
      cta: { href: '/dashboard/plan#planes', label: 'Seguir con mi plan' },
    }
  if (view.kind === 'free' && view.downgradedAt && now.getTime() - new Date(view.downgradedAt).getTime() < 40 * DAY)
    return {
      tone: SOFT,
      level: 'downgraded',
      text: 'Su cuenta pasó a Gratis. Sus datos se conservan; solo usted puede entrar hasta volver a un plan pagado.',
      cta: { href: '/dashboard/plan#planes', label: 'Recuperar mi plan' },
    }
  return null
}

export function BillingBanner({ banner }: { banner: Banner }) {
  return (
    <div className={`${banner.tone} px-4 py-2 text-[13px] md:px-5`} data-billing-banner={banner.level} role="status">
      {banner.text}{' '}
      {banner.cta &&
        (banner.cta.external ? (
          <a href={banner.cta.href} target="_blank" rel="noreferrer" className="font-semibold text-inherit underline underline-offset-2">
            {banner.cta.label}
          </a>
        ) : (
          <Link href={banner.cta.href} className="font-semibold text-inherit underline underline-offset-2">
            {banner.cta.label}
          </Link>
        ))}
    </div>
  )
}
