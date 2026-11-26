import Link from 'next/link'
import { getPayloadClient, requireDashboardSession, requireRole } from '@/lib/auth'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { btnGhost, btnPrimary } from '@/components/primitives'
import { asPlan, planLabel } from '@/lib/plans'
import { clearPendingCheckout } from '@/lib/billing/service'

/** PayPal's cancel_url: the payer closed PayPal without approving (spec §3). */
export default async function PayPalCancelPage() {
  const session = await requireDashboardSession()
  await requireRole(session, ['owner'])
  const plan = asPlan(session.tenant?.plan)
  if (session.tenant) await clearPendingCheckout(await getPayloadClient(), String(session.tenant.id)).catch(() => null)
  return (
    <>
      <AppHeader title="Mi plan" subtitle="Suscripción con PayPal" />
      <AppContent>
        <section className="max-w-xl rounded-[12px] border border-[#e7e5e4] bg-white px-5 py-5" data-return="cancelled">
          <h2 className="font-semibold">No se completó la suscripción</h2>
          <p className="mt-1 text-sm text-[#57534e]">No se cobró nada.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard/plan#planes" className={btnPrimary}>
              Intentar de nuevo
            </Link>
            <Link href="/dashboard" className={btnGhost}>
              Seguir en {plan === 'free' ? 'Gratis' : planLabel(plan)}
            </Link>
          </div>
        </section>
      </AppContent>
    </>
  )
}
