import Link from 'next/link'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { PageTitle, Card, Th, Td, EmptyState } from '@/components/primitives'
import { AUDIT_ACTIONS, DEFAULT_TIMEZONE } from '@/lib/constants'
import type { AuditLog, User } from '@/payload-types'

const actionLabel = (value: string) =>
  AUDIT_ACTIONS.find((a) => a.value === value)?.label ?? value

export default async function ActivityPage({
  searchParams,
}: {
  searchParams?: Promise<{ action?: string }>
}) {
  const { user, tenant } = await requireDashboardSession()
  // Owner-only — doctors/receptionists never see the audit trail (spec §2.2).
  if (user.role !== 'owner') {
    return (
      <div>
        <PageTitle subtitle="Registro de auditoría">Actividad</PageTitle>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Solo el titular del consultorio puede ver el registro de actividad.</p>
        </Card>
      </div>
    )
  }

  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const params = (await searchParams) ?? {}
  const activeAction = params.action && AUDIT_ACTIONS.some((a) => a.value === params.action) ? params.action : undefined
  const tz = tenant?.settings?.timezone || DEFAULT_TIMEZONE

  const res = await payload.find({
    collection: 'auditLogs',
    where: {
      tenant: { equals: tenantID },
      ...(activeAction ? { action: { equals: activeAction } } : {}),
    },
    sort: '-createdAt',
    limit: 100,
    depth: 1, // populate `user` for the name
    overrideAccess: true,
  })
  const logs = res.docs as AuditLog[]

  const fmt = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString('es-DO', {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz,
        })
      : '—'

  const chip = (label: string, value?: string) => {
    const active = value === activeAction || (!value && !activeAction)
    return (
      <Link
        key={value ?? 'all'}
        href={value ? `/dashboard/activity?action=${value}` : '/dashboard/activity'}
        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          active
            ? 'border-primary/30 bg-secondary text-primary'
            : 'border-border bg-canvas text-muted-foreground hover:border-primary/30 hover:text-primary'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <div>
      <PageTitle subtitle="Registro de solo lectura de las acciones sensibles en su consultorio.">Actividad</PageTitle>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {chip('Todas')}
        {AUDIT_ACTIONS.map((a) => chip(a.label, a.value))}
      </div>

      <Card className="overflow-hidden">
        {logs.length === 0 ? (
          <EmptyState message={activeAction ? 'Aún no hay actividad para este filtro.' : 'Aún no se ha registrado actividad.'} />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-canvas/50">
                <Th>Fecha</Th>
                <Th className="hidden md:table-cell">Usuario</Th>
                <Th className="hidden sm:table-cell">Acción</Th>
                <Th>Resumen</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => {
                const who = (log.user as User)?.name ?? '—'
                return (
                  <tr key={log.id} className="transition-colors hover:bg-canvas/60">
                    <Td className="tabular align-top whitespace-nowrap text-muted-foreground md:align-middle">
                      {fmt(log.createdAt)}
                      {/* Narrow screens fold the user into this cell instead of a column. */}
                      <div className="mt-0.5 max-w-[9rem] truncate font-medium text-ink md:hidden">{who}</div>
                    </Td>
                    <Td className="hidden whitespace-nowrap font-medium md:table-cell">{who}</Td>
                    <Td className="hidden whitespace-nowrap sm:table-cell">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {actionLabel(log.action)}
                      </span>
                    </Td>
                    <Td className="break-words">
                      <span className="mb-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium whitespace-nowrap text-muted-foreground sm:hidden">
                        {actionLabel(log.action)}
                      </span>
                      <div>{log.summary}</div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </Card>
    </div>
  )
}
