'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary, btnGhost, inputClass, Card, Field, Th, Td, Spinner } from './primitives'
import { AppSelect } from './AppSelect'
import { TablePager } from './TablePager'
import { IconPlus, IconBuilding, IconLogout } from './icons'

const TENANTS_PAGE_SIZE = 10
import { createClinic, setClinicStatus, resolveUpgradeRequest } from '@/app/(frontend)/super/actions'
import { logoutAction } from '@/app/(frontend)/login/actions'
import { planLabel, asPlan } from '@/lib/plans'
import { CURRENCIES, TIMEZONES, DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from '@/lib/constants'
import { APP_NAME, APP_LOCALE } from '@/lib/brand'

export type TenantRow = {
  id: string
  name: string
  city?: string | null
  currency: string
  status: string
  plan: string
  upgradeRequest?: { plan: string; requestedAt: string | null; note: string | null } | null
  doctors: number
  patients: number
  appointments: number
  createdAt: string
  onboardingSource?: string | null
  /** Pending signups only: the owner hasn't confirmed their email yet. */
  ownerUnverified?: boolean
}

export type ActivityRow = {
  id: string
  when: string
  clinic: string
  who: string
  summary: string
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  suspended: 'Suspendido',
  pending: 'Pendiente',
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(APP_LOCALE, { day: 'numeric', month: 'short' })

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const EMPTY_FORM = {
  name: '', phone: '', city: '', currency: DEFAULT_CURRENCY as string, timezone: DEFAULT_TIMEZONE as string,
  ownerName: '', ownerEmail: '', ownerPassword: '',
}

export function SuperConsole({ tenants, activity = [] }: { tenants: TenantRow[]; activity?: ActivityRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(tenants.length / TENANTS_PAGE_SIZE))
  const pageRows = tenants.slice((page - 1) * TENANTS_PAGE_SIZE, page * TENANTS_PAGE_SIZE)
  // Self-serve signups land as `pending` and queue here for approval (spec §3.2).
  // Most recent first; createdAt already sorts that way upstream.
  const pendingSignups = tenants.filter((t) => t.status === 'pending')
  // Owner "Request upgrade" submissions queue here for a decision (spec §5).
  const upgradeRequests = tenants.filter((t) => t.upgradeRequest)
  const [form, setForm] = useState(EMPTY_FORM)
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const create = () => {
    setError(null)
    start(async () => {
      const res = await createClinic(form)
      if (res.ok) {
        setShowAdd(false)
        setForm(EMPTY_FORM)
        router.refresh()
      } else setError(res.message)
    })
  }

  const toggle = (id: string, status: string) => {
    start(async () => {
      const res = await setClinicStatus(id, status === 'active' ? 'suspended' : 'active')
      if (res.ok) router.refresh()
      else setError(res.message)
    })
  }

  // Approve (pending -> active) / reject (pending -> suspended) a self-serve signup.
  const setStatus = (id: string, status: 'active' | 'suspended') => {
    setError(null)
    start(async () => {
      const res = await setClinicStatus(id, status)
      if (res.ok) router.refresh()
      else setError(res.message)
    })
  }

  // Approve applies the requested plan; reject just clears the request.
  const resolveUpgrade = (id: string, decision: 'approve' | 'reject') => {
    setError(null)
    start(async () => {
      const res = await resolveUpgradeRequest(id, decision)
      if (res.ok) router.refresh()
      else setError(res.message)
    })
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-up px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-primary">
            {APP_NAME}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Consola de la plataforma · {plural(tenants.length, 'consultorio', 'consultorios')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/admin" className={btnGhost}>
            <span className="sm:hidden">Admin</span>
            <span className="hidden sm:inline">Panel de administración</span>
          </a>
          <button className={btnPrimary} onClick={() => setShowAdd((s) => !s)}>
            <IconPlus size={15} />
            Nuevo consultorio
          </button>
          <form action={logoutAction}>
            <button type="submit" title="Cerrar sesión" aria-label="Cerrar sesión" className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:bg-canvas hover:text-ink">
              <IconLogout size={16} />
            </button>
          </form>
        </div>
      </div>

      {showAdd && (
        <Card className="mb-5 overflow-hidden">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold">Nuevo consultorio</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">El consultorio y su titular se crean juntos: ambos o ninguno.</p>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <Field label="Nombre del consultorio"><input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Teléfono del consultorio"><input className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Ciudad"><input className={inputClass} value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Moneda">
                <AppSelect
                  value={form.currency}
                  onChange={(v) => set('currency', v)}
                  options={CURRENCIES.map((c) => ({ value: c.value, label: c.label }))}
                />
              </Field>
              <Field label="Zona horaria">
                <AppSelect
                  value={form.timezone}
                  onChange={(v) => set('timezone', v)}
                  options={TIMEZONES.map((t) => ({ value: t.value, label: t.label }))}
                />
              </Field>
            </div>
            <Field label="Nombre del titular"><input className={inputClass} value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} /></Field>
            <Field label="Correo del titular"><input className={inputClass} type="email" value={form.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} /></Field>
            <Field label="Contraseña temporal"><input className={inputClass} value={form.ownerPassword} onChange={(e) => set('ownerPassword', e.target.value)} /></Field>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border bg-canvas/60 px-6 py-4">
            {error ? <p className="text-sm text-red">{error}</p> : <span />}
            <div className="flex gap-2">
              <button className={btnGhost} onClick={() => setShowAdd(false)}>Cancelar</button>
              <button className={btnPrimary} disabled={pending} onClick={create}>{pending && <Spinner />}{pending ? 'Creando…' : 'Crear consultorio'}</button>
            </div>
          </div>
        </Card>
      )}

      {pendingSignups.length > 0 && (
        <Card className="mb-5 overflow-hidden border-amber/30 bg-amber-soft/40">
          <div className="flex items-center justify-between border-b border-amber/20 px-6 py-4">
            <h2 className="text-sm font-semibold text-amber">Pendientes de aprobación</h2>
            <span className="text-xs text-muted-foreground">Registro en línea · {pendingSignups.length} en espera de revisión</span>
          </div>
          <ul className="divide-y divide-amber/15">
            {pendingSignups.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-6 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <IconBuilding size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{t.name}</div>
                  <div className="truncate text-xs text-faint">
                    {t.city || '—'} · {shortDate(t.createdAt)}
                  </div>
                </div>
                {t.ownerUnverified && (
                  <span
                    className="shrink-0 rounded-full border border-amber/30 bg-amber-soft px-2 py-0.5 text-[11px] font-medium text-amber"
                    title="La aprobación se habilita cuando el titular confirme su correo."
                  >
                    Correo sin verificar
                  </span>
                )}
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    className="text-xs font-medium text-faint transition-colors hover:text-red disabled:opacity-50"
                    disabled={pending}
                    onClick={() => setStatus(t.id, 'suspended')}
                  >
                    Rechazar
                  </button>
                  <button
                    className={`${btnPrimary} h-8 px-3 text-xs`}
                    disabled={pending || t.ownerUnverified}
                    title={t.ownerUnverified ? 'El titular aún no ha verificado su correo.' : undefined}
                    onClick={() => setStatus(t.id, 'active')}
                  >
                    Aprobar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {upgradeRequests.length > 0 && (
        <Card className="mb-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold">Solicitudes de mejora de plan</h2>
            <span className="text-xs text-muted-foreground">{upgradeRequests.length} en espera de decisión</span>
          </div>
          <ul className="divide-y divide-border">
            {upgradeRequests.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-6 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <IconBuilding size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">
                    {t.name}
                    <span className="ms-2 font-normal text-muted-foreground">
                      {planLabel(asPlan(t.plan))} → {planLabel(asPlan(t.upgradeRequest!.plan))}
                    </span>
                  </div>
                  <div className="truncate text-xs text-faint">
                    {t.upgradeRequest!.requestedAt &&
                      shortDate(t.upgradeRequest!.requestedAt)}
                    {t.upgradeRequest!.note && ` · «${t.upgradeRequest!.note}»`}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    className="text-xs font-medium text-faint transition-colors hover:text-red disabled:opacity-50"
                    disabled={pending}
                    onClick={() => resolveUpgrade(t.id, 'reject')}
                  >
                    Rechazar
                  </button>
                  <button
                    className={`${btnPrimary} h-8 px-3 text-xs`}
                    disabled={pending}
                    onClick={() => resolveUpgrade(t.id, 'approve')}
                  >
                    Aprobar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-canvas/50">
              <Th>Consultorio</Th>
              <Th className="hidden sm:table-cell">Plan</Th>
              <Th className="hidden lg:table-cell">Moneda</Th>
              <Th className="hidden sm:table-cell">Estado</Th>
              <Th className="hidden text-end md:table-cell">Médicos</Th>
              <Th className="hidden text-end md:table-cell">Pacientes</Th>
              <Th className="hidden text-end md:table-cell">Citas</Th>
              <Th className="text-end" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageRows.map((t) => (
              <tr key={t.id} className="transition-colors hover:bg-canvas/60">
                {/* w-full + max-w-0 lets the name truncate instead of widening the table. */}
                <Td className="w-full max-w-0">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <IconBuilding size={15} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{t.name}</div>
                      <div className="truncate text-xs text-faint">
                        {t.city || '—'}
                        <span className="sm:hidden"> · {planLabel(asPlan(t.plan))}</span>
                      </div>
                      <div className="mt-1 sm:hidden"><StatusPill status={t.status} /></div>
                    </div>
                  </div>
                </Td>
                <Td className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">{planLabel(asPlan(t.plan))}</Td>
                <Td className="hidden text-muted-foreground lg:table-cell">{t.currency}</Td>
                <Td className="hidden whitespace-nowrap sm:table-cell">
                  <StatusPill status={t.status} />
                </Td>
                <Td className="tabular hidden text-end md:table-cell">{t.doctors}</Td>
                <Td className="tabular hidden text-end md:table-cell">{t.patients}</Td>
                <Td className="tabular hidden text-end md:table-cell">{t.appointments}</Td>
                <Td className="text-end">
                  <button
                    className={`text-xs font-medium transition-colors ${
                      t.status === 'active' ? 'text-faint hover:text-red' : 'text-primary hover:underline'
                    }`}
                    disabled={pending}
                    onClick={() => (t.status === 'pending' ? setStatus(t.id, 'active') : toggle(t.id, t.status))}
                  >
                    {t.status === 'active' ? 'Suspender' : t.status === 'pending' ? 'Aprobar' : 'Reactivar'}
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <TablePager page={page} totalPages={totalPages} onChange={setPage} />
      </Card>

      {activity.length > 0 && (
        <Card className="mt-5 overflow-hidden">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold">Actividad reciente</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Últimas acciones importantes en todos los consultorios</p>
          </div>
          <ul className="divide-y divide-border">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-6 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{a.summary}</span>
                  <span className="block truncate text-xs text-faint">{a.clinic} · {a.who}</span>
                </span>
                <span className="tabular shrink-0 text-xs text-muted-foreground">
                  {shortDate(a.when)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
      status === 'active' ? 'bg-primary-soft text-primary' : 'bg-amber-soft text-amber'
    }`}>
      <span className={`size-1.5 rounded-full ${status === 'active' ? 'bg-primary' : 'bg-amber'}`} />
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
