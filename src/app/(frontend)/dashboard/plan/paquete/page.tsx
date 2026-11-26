import Link from 'next/link'
import { getTenantID } from '@/access'
import { getPayloadClient, requireDashboardSession, requireRole } from '@/lib/auth'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { btnGhost, btnPrimary } from '@/components/primitives'
import { completePackOrder, formatDate } from '@/lib/billing/service'
import { formatMetered, meteredUnit } from '@/lib/plans'

/**
 * Return from PayPal after buying a quota pack (spec §2/§3). Capturing is
 * idempotent (PayPal-Request-Id per order + one pack per capture id), so a reload
 * never grants the pack twice.
 */
export default async function PackReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireDashboardSession()
  await requireRole(session, ['owner'])
  const params = await searchParams
  const tenantID = String(getTenantID(session.user))
  const result =
    params.cancelado || !params.token
      ? ({ ok: false, message: 'No se completó la compra. No se cobró nada.' } as const)
      : await completePackOrder(await getPayloadClient(), tenantID, params.token)

  return (
    <>
      <AppHeader title="Mi plan" subtitle="Compra de paquete" />
      <AppContent>
        <section className="max-w-xl rounded-[12px] border border-[#e7e5e4] bg-white px-5 py-5" data-pack-return={result.ok ? 'ok' : 'failed'}>
          {result.ok ? (
            <>
              <h2 className="font-semibold">Paquete activo</h2>
              <p className="mt-1 text-sm text-[#57534e]">
                {formatMetered(result.resource, result.units)} {meteredUnit(result.resource, result.units)} · vence el{' '}
                {formatDate(result.expiresAt, session.tenant?.settings?.timezone ?? undefined)} o al agotarse.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-semibold">No se completó la compra</h2>
              <p className="mt-1 text-sm text-[#57534e]">{result.message}</p>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard/plan#paquetes" className={result.ok ? btnPrimary : btnGhost}>
              Volver a Mi plan
            </Link>
          </div>
        </section>
      </AppContent>
    </>
  )
}
