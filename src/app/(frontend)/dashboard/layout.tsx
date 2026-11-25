import React from 'react'
import { getPayloadClient, requireDashboardSession } from '@/lib/auth'
import { getQuotaAlert } from '@/lib/usage'
import { QuotaAlertStrip } from '@/components/QuotaAlertStrip'
import { REQUIREMENT_TEXT, twoFactorRequirement } from '@/lib/twoFactorPolicy'
import { TwoFactorEnrollScreen, TwoFactorGraceStrip } from '@/components/security/TwoFactorGate'
import { Sidebar } from '@/components/Sidebar'
import { ContentFrame } from '@/components/AppHeader'
import { APP_NAME, SUPPORT_EMAIL } from '@/lib/brand'
import { isIndividualPractice, isPractitioner } from '@/lib/practice'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant, twoFactor: gate } = await requireDashboardSession({ twoFactorEnrollment: true })

  // Existing sessions of a suspended clinic see a stop screen (spec §8.5).
  if (tenant?.status === 'suspended') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas px-4 text-center">
        <div className="font-display text-xl font-semibold text-primary">{APP_NAME}</div>
        <h1 className="text-lg font-semibold">La cuenta de este consultorio está suspendida</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Escriba a {SUPPORT_EMAIL} para reactivar su consultorio.
        </p>
      </main>
    )
  }

  // Two-step verification (spec §10): reminder during the grace period, then only
  // the enrollment screen (pages themselves redirect here via requireDashboardSession).
  const requirement = twoFactorRequirement(user, tenant)
  if (gate.kind === 'enroll' && requirement) {
    return <TwoFactorEnrollScreen email={user.email} reason={REQUIREMENT_TEXT[requirement]} />
  }

  // Quota notice for the owner (spec §2); best effort, never blocks the dashboard.
  const quotaAlert =
    user.role === 'owner' && tenant
      ? await getQuotaAlert(await getPayloadClient(), tenant.id).catch(() => null)
      : null

  return (
    <Sidebar
      clinicName={tenant?.name ?? 'Consultorio'}
      clinicLogo={tenant?.logo}
      userName={user.name}
      role={user.role}
      practitioner={isPractitioner(user)}
      individual={isIndividualPractice(tenant)}
    >
      {gate.kind === 'grace' && <TwoFactorGraceStrip until={gate.until.toISOString()} daysLeft={gate.daysLeft} />}
      {quotaAlert && <QuotaAlertStrip alert={quotaAlert} />}
      <ContentFrame>{children}</ContentFrame>
    </Sidebar>
  )
}
