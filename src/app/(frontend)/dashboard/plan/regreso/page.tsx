import { redirect } from 'next/navigation'
import { requireDashboardSession, requireRole } from '@/lib/auth'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { ReturnPoller } from './ReturnPoller'

/** PayPal sends the payer back here with ?subscription_id=… after approving (spec §3). */
export default async function PayPalReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireDashboardSession()
  await requireRole(session, ['owner'])
  const params = await searchParams
  const subscriptionId = params.subscription_id
  if (!subscriptionId) redirect('/dashboard/plan')
  return (
    <>
      <AppHeader title="Mi plan" subtitle="Suscripción con PayPal" />
      <AppContent>
        <ReturnPoller subscriptionId={subscriptionId} />
      </AppContent>
    </>
  )
}
