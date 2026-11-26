'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary, btnGhost, inputClass, Field, Spinner } from './primitives'
import { AppSelect } from './AppSelect'
import { TablePager } from './TablePager'

const TENANTS_PAGE_SIZE = 10
import {
  createClinic,
  setClinicStatus,
  resolveUpgradeRequest,
} from '@/app/(frontend)/super/actions'
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

const CARD = 'rounded-[12px] border border-[#e7e5e4] bg-white'
const TH = 'px-3.5 py-2.5 text-left text-xs font-medium whitespace-nowrap text-[#57534e]'
const TD = 'px-3.5 py-[11px] align-middle'
const SMALL_BTN =
  'flex h-9 items-center rounded-lg border border-[#d6d3d1] bg-white px-3 text-[13px] font-medium text-[#1c1917] transition-colors hover:border-[#a8a29e] disabled:opacity-50'
const SMALL_PRIMARY =
  'flex h-9 items-center rounded-lg bg-[#0f766e] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#115e59] disabled:opacity-50'

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  suspended: 'Suspendido',
  pending: 'Pendiente',
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(APP_LOCALE, { day: 'numeric', month: 'short' })

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const EMPTY_FORM = {
  name: '',
  phone: '',
  city: '',
  currency: DEFAULT_CURRENCY as string,
  timezone: DEFAULT_TIMEZONE as string,
  ownerName: '',
  ownerEmail: '',
  ownerPassword: '',
}

export function SuperConsole({
  tenants,
  activity = [],
}: {
  tenants: TenantRow[]
  activity?: ActivityRow[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const filtered = needle
    ? tenants.filter((t) =>
        [t.name, t.city ?? '', planLabel(asPlan(t.plan)), STATUS_LABELS[t.status] ?? t.status].some(
          (v) => v.toLowerCase().includes(needle),
        ),
      )
    : tenants
  const filteredPages = Math.max(1, Math.ceil(filtered.length / TENANTS_PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * TENANTS_PAGE_SIZE, page * TENANTS_PAGE_SIZE)
  const activeCount = tenants.filter((t) => t.status === 'active').length
  const patientTotal = tenants.reduce((n, t) => n + t.patients, 0)
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
    <>
      {/* Same chrome as the dashboard AppHeader (sticky 56px, 17/600 title), without the
          patient search: the platform console has no clinic of its own. */}
      <header className="sticky top-0 z-20 border-b border-[#e7e5e4] bg-[rgba(250,250,247,.94)] backdrop-blur-md">
        <div className="mx-auto flex min-h-14 max-w-[1080px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 md:px-5">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-semibold tracking-[-.02em]">
              {APP_NAME} · Súper admin
            </h1>
            <div className="truncate text-xs text-[#57534e]">
              Consola de la plataforma · {plural(tenants.length, 'consultorio', 'consultorios')}
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <a href="/admin" className={btnGhost}>
              <span className="sm:hidden">Admin</span>
              <span className="hidden sm:inline">Panel de administración</span>
            </a>
            <button className={btnPrimary} onClick={() => setShowAdd((s) => !s)}>
              Nuevo consultorio
            </button>
            <form action={logoutAction}>
              <button type="submit" className={btnGhost}>
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-3 px-4 pt-4 pb-10 md:px-5 md:pt-5">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          {[
            ['Consultorios', tenants.length],
            ['Activos', activeCount],
            ['Pendientes de aprobación', pendingSignups.length],
            ['Pacientes en total', patientTotal],
          ].map(([l, v]) => (
            <div key={l} className={`${CARD} px-4 py-3.5`}>
              <div className="text-xs text-[#57534e]">{l}</div>
              <div className="tabular mt-0.5 text-[22px] font-medium tracking-[-.03em]">{v}</div>
            </div>
          ))}
        </div>

        {error && !showAdd && (
          <p
            className="rounded-[10px] border border-[#b45309]/30 bg-[#faf3e6] px-3 py-2 text-sm text-[#b45309]"
            role="alert"
          >
            {error}
          </p>
        )}

        {showAdd && (
          <section className={`${CARD} overflow-hidden`}>
            <div className="border-b border-[#f0eeec] px-[18px] py-4">
              <h2 className="text-base font-semibold">Nuevo consultorio</h2>
              <p className="mt-0.5 text-[13px] text-[#57534e]">
                El consultorio y su titular se crean juntos: ambos o ninguno.
              </p>
            </div>
            <div className="grid gap-4 px-[18px] py-4 sm:grid-cols-2">
              <Field label="Nombre del consultorio">
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                />
              </Field>
              <Field label="Teléfono del consultorio">
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                />
              </Field>
              <Field label="Ciudad">
                <input
                  className={inputClass}
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                />
              </Field>
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
              <Field label="Nombre del titular">
                <input
                  className={inputClass}
                  value={form.ownerName}
                  onChange={(e) => set('ownerName', e.target.value)}
                />
              </Field>
              <Field label="Correo del titular">
                <input
                  className={inputClass}
                  type="email"
                  value={form.ownerEmail}
                  onChange={(e) => set('ownerEmail', e.target.value)}
                />
              </Field>
              <Field label="Contraseña temporal">
                <input
                  className={inputClass}
                  value={form.ownerPassword}
                  onChange={(e) => set('ownerPassword', e.target.value)}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0eeec] px-[18px] py-4">
              {error ? (
                <p className="text-sm text-[#b45309]" role="alert">
                  {error}
                </p>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button className={btnGhost} onClick={() => setShowAdd(false)}>
                  Cancelar
                </button>
                <button className={btnPrimary} disabled={pending} onClick={create}>
                  {pending && <Spinner />}
                  {pending ? 'Creando…' : 'Crear consultorio'}
                </button>
              </div>
            </div>
          </section>
        )}

        {pendingSignups.length > 0 && (
          <section className="overflow-hidden rounded-[12px] border border-[#b45309]/40 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] py-3.5">
              <h2 className="font-semibold">Pendientes de aprobación</h2>
              <span className="text-[13px] text-[#57534e]">
                Registro en línea · {pendingSignups.length} en espera de revisión
              </span>
            </div>
            <ul>
              {pendingSignups.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-3 border-t border-[#f0eeec] px-[18px] py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.name}</div>
                    <div className="tabular truncate text-[13px] text-[#57534e]">
                      {t.city || '—'} · {shortDate(t.createdAt)}
                    </div>
                  </div>
                  {t.ownerUnverified && (
                    <span
                      className="shrink-0 rounded-md border border-[#b45309] px-2 py-0.5 text-xs font-semibold text-[#b45309]"
                      title="La aprobación se habilita cuando el titular confirme su correo."
                    >
                      Correo sin verificar
                    </span>
                  )}
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      className={SMALL_BTN}
                      disabled={pending}
                      onClick={() => setStatus(t.id, 'suspended')}
                    >
                      Rechazar
                    </button>
                    <button
                      className={SMALL_PRIMARY}
                      disabled={pending || t.ownerUnverified}
                      title={
                        t.ownerUnverified ? 'El titular aún no ha verificado su correo.' : undefined
                      }
                      onClick={() => setStatus(t.id, 'active')}
                    >
                      Aprobar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {upgradeRequests.length > 0 && (
          <section className={`${CARD} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] py-3.5">
              <h2 className="font-semibold">Solicitudes de mejora de plan</h2>
              <span className="text-[13px] text-[#57534e]">
                {upgradeRequests.length} en espera de decisión
              </span>
            </div>
            <ul>
              {upgradeRequests.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-3 border-t border-[#f0eeec] px-[18px] py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {t.name}
                      <span className="ms-2 font-normal text-[#57534e]">
                        {planLabel(asPlan(t.plan))} → {planLabel(asPlan(t.upgradeRequest!.plan))}
                      </span>
                    </div>
                    <div className="truncate text-[13px] text-[#57534e]">
                      {t.upgradeRequest!.requestedAt && shortDate(t.upgradeRequest!.requestedAt)}
                      {t.upgradeRequest!.note && ` · «${t.upgradeRequest!.note}»`}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      className={SMALL_BTN}
                      disabled={pending}
                      onClick={() => resolveUpgrade(t.id, 'reject')}
                    >
                      Rechazar
                    </button>
                    <button
                      className={SMALL_PRIMARY}
                      disabled={pending}
                      onClick={() => resolveUpgrade(t.id, 'approve')}
                    >
                      Aprobar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          placeholder="Filtrar por nombre, ciudad, plan o estado"
          aria-label="Filtrar consultorios"
          className="h-10 w-full max-w-[320px] rounded-[10px] border border-[#d6d3d1] bg-white px-3 text-base outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] md:text-sm"
        />

        <section className={`${CARD} overflow-hidden`}>
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#57534e]">
              {needle ? (
                <>
                  Ningún consultorio coincide con «{q.trim()}».{' '}
                  <button
                    type="button"
                    className="font-medium text-[#0f766e]"
                    onClick={() => setQ('')}
                  >
                    Quitar el filtro
                  </button>
                </>
              ) : (
                <>
                  Aún no hay consultorios.{' '}
                  <button
                    type="button"
                    className="font-medium text-[#0f766e]"
                    onClick={() => setShowAdd(true)}
                  >
                    Nuevo consultorio
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="bg-[#fafaf7]">
                    <th className={TH}>Consultorio</th>
                    <th className={TH}>Plan</th>
                    <th className={TH}>Moneda</th>
                    <th className={TH}>Estado</th>
                    <th className={`${TH} text-right`}>Médicos</th>
                    <th className={`${TH} text-right`}>Pacientes</th>
                    <th className={`${TH} text-right`}>Citas</th>
                    <th className={TH}>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((t) => (
                    <tr
                      key={t.id}
                      className="border-t border-[#f0eeec] transition-colors hover:bg-[#fafaf7]"
                    >
                      <td className={TD}>
                        <div className="truncate font-medium">{t.name}</div>
                        <div className="truncate text-[13px] text-[#57534e]">{t.city || '—'}</div>
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>{planLabel(asPlan(t.plan))}</td>
                      <td className={`${TD} font-mono text-[13px] text-[#57534e]`}>{t.currency}</td>
                      <td className={`${TD} whitespace-nowrap`}>
                        <StatusPill status={t.status} />
                      </td>
                      <td className={`${TD} tabular text-right`}>{t.doctors}</td>
                      <td className={`${TD} tabular text-right`}>{t.patients}</td>
                      <td className={`${TD} tabular text-right`}>{t.appointments}</td>
                      <td className={TD}>
                        <div className="flex justify-end">
                          <button
                            className={t.status === 'pending' ? SMALL_PRIMARY : SMALL_BTN}
                            disabled={pending}
                            onClick={() =>
                              t.status === 'pending'
                                ? setStatus(t.id, 'active')
                                : toggle(t.id, t.status)
                            }
                          >
                            {t.status === 'active'
                              ? 'Suspender'
                              : t.status === 'pending'
                                ? 'Aprobar'
                                : 'Reactivar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <TablePager page={page} totalPages={filteredPages} onChange={setPage} />
        </section>

        {activity.length > 0 && (
          <section className={`${CARD} overflow-hidden`}>
            <div className="px-[18px] py-3.5">
              <h2 className="font-semibold">Actividad reciente</h2>
              <p className="mt-0.5 text-[13px] text-[#57534e]">
                Últimas acciones importantes en todos los consultorios
              </p>
            </div>
            <ul>
              {activity.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 border-t border-[#f0eeec] px-[18px] py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{a.summary}</span>
                    <span className="block truncate text-[13px] text-[#57534e]">
                      {a.clinic} · {a.who}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-[13px] text-[#57534e]">
                    {shortDate(a.when)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  )
}

/** Account state chip: active neutral outline, pending amber, suspended ink (no green/red). */
function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'active'
      ? 'border-[#0f766e] bg-white text-[#0f766e]'
      : status === 'pending'
        ? 'border-[#b45309] bg-white text-[#b45309]'
        : 'border-[#1c1917] bg-[#1c1917] text-white'
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${tone}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
