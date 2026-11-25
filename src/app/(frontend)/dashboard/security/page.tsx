import { getPayloadClient, requireDashboardSession } from '@/lib/auth'
import { getTenantID } from '@/access'
import { AppContent, AppHeader } from '@/components/AppHeader'
import { SecurityPanel, type SecurityMember } from '@/components/security/SecurityPanel'
import { REQUIREMENT_TEXT, canDisableTwoFactor, twoFactorRequirement } from '@/lib/twoFactorPolicy'
import type { TwoFactorData } from '@/lib/twoFactorServer'
import type { User } from '@/payload-types'

export default async function SecurityPage({ searchParams }: { searchParams?: Promise<{ backup?: string }> }) {
  const session = await requireDashboardSession({ twoFactorEnrollment: true })
  const { user, tenant, twoFactor: gate } = session
  const payload = await getPayloadClient()
  const params = (await searchParams) ?? {}
  const requirement = twoFactorRequirement(user, tenant)
  // While the gate is closed the layout shows only the enrollment screen; send nothing else.
  if (gate.kind === 'enroll' && requirement) return null

  const raw = (await payload.db.findOne({ collection: 'users', where: { id: { equals: user.id } } })) as {
    twoFactor?: TwoFactorData | null
  } | null
  const tf = raw?.twoFactor ?? {}
  const backupLeft = (tf.backupCodes ?? []).filter((c) => !c.usedAt).length

  let clinic: { requireAll: boolean; members: SecurityMember[] } | null = null
  if (user.role === 'owner') {
    const res = await payload.find({
      collection: 'users',
      where: { tenant: { equals: getTenantID(user) } },
      limit: 200,
      sort: 'name',
      depth: 0,
      overrideAccess: true,
    })
    clinic = {
      requireAll: tenant?.settings?.security?.require2faAll === true,
      members: (res.docs as User[]).map((m) => ({
        id: String(m.id),
        name: m.name,
        email: m.email,
        role: m.role,
        active: m.active !== false,
        twoFactorEnabled: m.twoFactorEnabled === true,
        required: Boolean(twoFactorRequirement(m, tenant)),
      })),
    }
  }

  return (
    <>
      <AppHeader title="Mi seguridad" subtitle="Contraseña y verificación en dos pasos" />
      <AppContent className="max-w-[860px]">
        <SecurityPanel
          email={user.email}
          enabled={user.twoFactorEnabled === true}
          enabledAt={tf.enabledAt ?? null}
          backupLeft={backupLeft}
          requirementText={requirement ? REQUIREMENT_TEXT[requirement] : null}
          canDisable={canDisableTwoFactor(user, tenant)}
          backupJustUsed={params.backup === 'used'}
          graceUntil={gate.kind === 'grace' ? gate.until.toISOString() : null}
          clinic={clinic}
        />
      </AppContent>
    </>
  )
}
