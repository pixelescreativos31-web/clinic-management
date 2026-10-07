import { redirect } from 'next/navigation'
import { requireDashboardSession, requireRole, getPayloadClient } from '@/lib/auth'
import { PageTitle } from '@/components/primitives'
import { PlanPanel } from '@/components/PlanPanel'
import { asPlan } from '@/lib/plans'
import { practitionerWhere } from '@/lib/practice'

export default async function PlanPage() {
  const session = await requireDashboardSession()
  await requireRole(session, ['owner'])
  const tenant = session.tenant
  if (!tenant) redirect('/dashboard')
  const payload = await getPayloadClient()

  // Same counting rules as the enforcement hook (src/hooks/planLimit.ts):
  // deactivated doctors don't count toward the cap.
  const [doctors, patients] = await Promise.all([
    payload.count({
      collection: 'users',
      where: { and: [practitionerWhere(String(tenant.id)), { active: { not_equals: false } }] },
      overrideAccess: true,
    }),
    payload.count({
      collection: 'patients',
      where: { tenant: { equals: tenant.id } },
      overrideAccess: true,
    }),
  ])

  return (
    <div>
      <PageTitle subtitle="Su suscripción, el uso frente a sus límites y las mejoras de plan.">
        Plan y uso
      </PageTitle>
      <PlanPanel
        plan={asPlan(tenant.plan)}
        doctorCount={doctors.totalDocs}
        patientCount={patients.totalDocs}
        pendingRequest={
          tenant.upgradeRequest?.requestedPlan
            ? {
                plan: asPlan(tenant.upgradeRequest.requestedPlan),
                requestedAt: tenant.upgradeRequest.requestedAt ?? null,
              }
            : null
        }
      />
    </div>
  )
}
