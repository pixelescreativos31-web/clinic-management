// Public marketing homepage — design_handoff_medira/medira Inicio.dc.html
// ("Clinical Calm"). The interactive page lives in HomeLanding (client); this
// server shell feeds it real plan prices and quotas so marketing never drifts
// from what the app enforces.

import { connection } from 'next/server'
import { HomeLanding, type HomePlan } from '@/components/HomeLanding'
import { PLAN_LIMITS, PLAN_QUOTAS } from '@/lib/plans'
import { SUPPORT_EMAIL } from '@/lib/brand'

export default async function HomePage() {
  await connection()
  // The real site links its demo cards to the demo instance (DEMO_URL); the demo
  // instance itself (SHOW_DEMO=1) links to its own login.
  const showDemo = process.env.SHOW_DEMO === '1'
  const demoBase = showDemo ? '' : (process.env.DEMO_URL?.replace(/\/+$/, '') ?? null)

  const plans: HomePlan[] = [
    {
      key: 'free',
      name: PLAN_LIMITS.free.label,
      price: PLAN_LIMITS.free.priceUsd,
      items: ['1 médico (el Titular)', `${PLAN_LIMITS.free.patients} pacientes en total`, 'WhatsApp con enlace manual'],
    },
    {
      key: 'pro',
      name: PLAN_LIMITS.pro.label,
      price: PLAN_LIMITS.pro.priceUsd,
      hot: true,
      items: ['1 médico y su asistente', 'Pacientes ilimitados', `${PLAN_QUOTAS.pro.whatsappMessages} WhatsApp automáticos/mes`],
    },
    {
      key: 'clinic',
      name: PLAN_LIMITS.clinic.label,
      price: PLAN_LIMITS.clinic.priceUsd,
      items: [`Hasta ${PLAN_LIMITS.clinic.doctors} médicos`, 'Personal ilimitado', 'ARS, gastos y honorarios'],
    },
    {
      key: 'plus',
      name: PLAN_LIMITS.plus.label,
      price: PLAN_LIMITS.plus.priceUsd,
      perDoctor: true,
      items: ['Los médicos que pague', 'Varias sucursales y cajas', 'Soporte prioritario'],
    },
  ]

  return (
    <HomeLanding
      plans={plans}
      hospitalItems={['Cuotas por contrato', 'Exportación a su sistema', 'Gerente de cuenta']}
      supportEmail={SUPPORT_EMAIL}
      demoBase={demoBase}
    />
  )
}
