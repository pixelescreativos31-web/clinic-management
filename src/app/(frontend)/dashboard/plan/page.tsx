import { redirect } from 'next/navigation'
import { requireDashboardSession, requireRole, getPayloadClient } from '@/lib/auth'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { PlanPanel } from '@/components/PlanPanel'
import { asPlan } from '@/lib/plans'
import { doctorWhere } from '@/lib/practice'
import { getUsageSummary } from '@/lib/usage'
import { getGateway } from '@/lib/billing/gateway'
import { billingView, trialEligible } from '@/lib/billing/service'
import { billingSummary } from '@/lib/billing/summary'
import { regionalOf } from '@/lib/regional'

export default async function PlanPage() {
  const session = await requireDashboardSession()
  await requireRole(session, ['owner'])
  const tenant = session.tenant
  if (!tenant) redirect('/dashboard')
  const payload = await getPayloadClient()

  // Same counting rules as the enforcement hook (src/hooks/planLimit.ts):
  // deactivated doctors don't count toward the cap.
  const gateway = getGateway()
  const [doctors, patients, metered, trial, receipts] = await Promise.all([
    payload.count({
      collection: 'users',
      where: { and: [doctorWhere(String(tenant.id)), { active: { not_equals: false } }] },
      overrideAccess: true,
    }),
    payload.count({
      collection: 'patients',
      where: { tenant: { equals: tenant.id } },
      overrideAccess: true,
    }),
    // Metered quotas (B1): current month in the clinic's timezone + storage total.
    getUsageSummary(payload, tenant.id),
    gateway ? trialEligible(payload, String(tenant.id)) : Promise.resolve(false),
    payload.find({
      collection: 'billingReceipts',
      where: { tenant: { equals: tenant.id } },
      sort: '-paidAt',
      limit: 24,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const view = billingView(tenant as never)

  return (
    <>
      <AppHeader
        title="Mi plan"
        subtitle="Su suscripción, el uso frente a sus límites y las mejoras de plan"
      />
      <AppContent>
        <PlanPanel
          plan={asPlan(tenant.plan)}
          status={tenant.status}
          doctorCount={doctors.totalDocs}
          patientCount={patients.totalDocs}
          metered={{ period: metered.period, used: metered.used, packs: metered.packs, packList: metered.packList }}
          billing={{
            online: Boolean(gateway),
            view,
            summary: billingSummary(view, regionalOf(tenant).timeFormat),
            trial,
            manageUrl: gateway?.manageUrl() ?? null,
            receipts: receipts.docs.map((r) => ({
              id: String(r.id),
              number: r.number,
              paidAt: r.paidAt,
              concept: r.concept,
              totalUsd: r.totalUsd,
              status: r.status,
            })),
          }}
          pendingRequest={
            tenant.upgradeRequest?.requestedPlan
              ? {
                  plan: asPlan(tenant.upgradeRequest.requestedPlan),
                  requestedAt: tenant.upgradeRequest.requestedAt ?? null,
                }
              : null
          }
        />
      </AppContent>
    </>
  )
}
