import Link from 'next/link'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { AUDIT_ACTIONS, DEFAULT_TIMEZONE } from '@/lib/constants'
import type { AuditLog, User } from '@/payload-types'

const CARD = 'rounded-[12px] border border-[#e7e5e4] bg-white'
const TH = 'px-3.5 py-2.5 text-left text-xs font-medium whitespace-nowrap text-[#57534e]'
const TD = 'px-3.5 py-[11px] align-top'

const actionLabel = (value: string) =>
  AUDIT_ACTIONS.find((a) => a.value === value)?.label ?? value

export default async function ActivityPage({
  searchParams,
}: {
  searchParams?: Promise<{ action?: string; q?: string }>
}) {
  const { user, tenant } = await requireDashboardSession()
  // Owner-only — doctors/receptionists never see the audit trail (spec §2.2).
  if (user.role !== 'owner') {
    return (
      <>
        <AppHeader title="Auditoría" subtitle="Registro de auditoría" />
        <AppContent>
          <div className={`${CARD} px-6 py-12 text-center`}>
            <div className="text-[19px] font-semibold tracking-[-.02em]">Sin permiso</div>
            <p className="mx-auto mt-1.5 max-w-[380px] text-sm text-[#57534e]">
              Solo el titular del consultorio puede ver el registro de actividad.
            </p>
            <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-[#0f766e]">
              Volver al panel
            </Link>
          </div>
        </AppContent>
      </>
    )
  }

  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const params = (await searchParams) ?? {}
  const activeAction = params.action && AUDIT_ACTIONS.some((a) => a.value === params.action) ? params.action : undefined
  const q = (params.q ?? '').trim()
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
  const allLogs = res.docs as AuditLog[]
  // Text filter over the loaded rows: summary, person or action label.
  const needle = q.toLowerCase()
  const logs = needle
    ? allLogs.filter((l) =>
        [l.summary ?? '', (l.user as User)?.name ?? '', actionLabel(l.action)].some((v) => v.toLowerCase().includes(needle)),
      )
    : allLogs

  const fmt = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString('es-DO', {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz,
        })
      : '—'

  const people = new Set(allLogs.map((l) => (l.user as User)?.name).filter(Boolean)).size
  const exports = allLogs.filter((l) => l.action === 'export.generated').length

  const hrefFor = (action?: string) => {
    const sp = new URLSearchParams()
    if (action) sp.set('action', action)
    if (q) sp.set('q', q)
    const str = sp.toString()
    return str ? `/dashboard/activity?${str}` : '/dashboard/activity'
  }

  const chip = (label: string, value?: string) => {
    const active = value === activeAction || (!value && !activeAction)
    return (
      <Link
        key={value ?? 'all'}
        href={hrefFor(value)}
        aria-current={active ? 'true' : undefined}
        className={`flex h-9 items-center rounded-lg border px-3 text-[13px] font-medium whitespace-nowrap transition-colors ${
          active
            ? 'border-[#1c1917] bg-[#1c1917] text-white hover:text-white'
            : 'border-[#d6d3d1] bg-white text-[#57534e] hover:border-[#a8a29e] hover:text-[#1c1917]'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <>
      <AppHeader title="Auditoría" subtitle="Registro de solo lectura de las acciones sensibles en su consultorio" />
      <AppContent className="flex flex-col gap-3">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          {[
            ['Registros', allLogs.length],
            ['Personas', people],
            ['Exportaciones', exports],
            ['Último registro', allLogs[0] ? fmt(allLogs[0].createdAt) : '—'],
          ].map(([l, v]) => (
            <div key={l} className={`${CARD} px-4 py-3.5`}>
              <div className="text-xs text-[#57534e]">{l}</div>
              <div className="tabular mt-0.5 truncate text-[22px] font-medium tracking-[-.03em]">{v}</div>
            </div>
          ))}
        </div>

        <form method="get" className="flex max-w-[420px] items-center gap-2" role="search">
          {activeAction && <input type="hidden" name="action" value={activeAction} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Filtrar por persona o resumen"
            aria-label="Filtrar la auditoría"
            className="h-10 min-w-0 flex-1 rounded-[10px] border border-[#d6d3d1] bg-white px-3 text-base outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] md:text-sm"
          />
          {q && (
            <Link
              href={activeAction ? `/dashboard/activity?action=${activeAction}` : '/dashboard/activity'}
              className="flex h-10 items-center rounded-[10px] border border-[#d6d3d1] bg-white px-3 text-sm font-medium text-[#1c1917]"
            >
              Quitar
            </Link>
          )}
        </form>

        <div className="flex flex-wrap gap-1.5">
          {chip('Todas')}
          {AUDIT_ACTIONS.map((a) => chip(a.label, a.value))}
        </div>

        <section className={`${CARD} overflow-hidden`}>
          {logs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#57534e]">
              {activeAction || q ? 'Aún no hay actividad para este filtro.' : 'Aún no se ha registrado actividad.'}
              {(activeAction || q) && (
                <>
                  {' '}
                  <Link href="/dashboard/activity" className="font-medium text-[#0f766e]">
                    Ver todo
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="bg-[#fafaf7]">
                    <th className={TH}>Fecha</th>
                    <th className={TH}>Usuario</th>
                    <th className={TH}>Acción</th>
                    <th className={TH}>Resumen</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const who = (log.user as User)?.name ?? '—'
                    return (
                      <tr key={log.id} className="border-t border-[#f0eeec] transition-colors hover:bg-[#fafaf7]">
                        <td className={`${TD} tabular whitespace-nowrap text-[#57534e]`}>{fmt(log.createdAt)}</td>
                        <td className={`${TD} font-medium whitespace-nowrap`}>{who}</td>
                        <td className={`${TD} whitespace-nowrap`}>
                          <span className="rounded-md border border-[#d6d3d1] bg-white px-2 py-0.5 text-xs font-semibold text-[#57534e]">
                            {actionLabel(log.action)}
                          </span>
                        </td>
                        <td className={`${TD} break-words`}>{log.summary}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </AppContent>
    </>
  )
}
