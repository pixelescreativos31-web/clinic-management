'use client'

// «Mi plan» (design handoff «Plan y facturación»): deep card with the plan and its
// state, monthly usage bars (6px track, teal fill, amber from 80%), the pending
// upgrade request and the plan cards. Prices come from src/lib/plans.ts only.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary, btnGhost, textareaClass, Spinner } from './primitives'
import {
  METERED_LABELS,
  METERED_RESOURCES,
  PLANS,
  PLAN_LIMITS,
  formatMetered,
  isMonthlyResource,
  periodLabel,
  planLabel,
  planPriceLabel,
  quotaLine,
  quotaStatus,
  usage,
  type LimitedResource,
  type MeteredResource,
  type Plan,
} from '@/lib/plans'
import { requestUpgrade } from '@/app/(frontend)/dashboard/plan/actions'

const CARD = 'rounded-[12px] border border-[#e7e5e4] bg-white'

const RESOURCE_LABELS: Record<LimitedResource, string> = {
  doctors: 'Médicos activos',
  patients: 'Pacientes',
}

const STATE_LABELS: Record<string, string> = {
  active: 'Activa',
  pending: 'Pendiente de aprobación',
  suspended: 'Suspendida',
}

/** Quota bar: 6px sunken track, teal fill, amber from 80% (never red). */
function Bar({ ratio, warn, label }: { ratio: number; warn: boolean; label: string }) {
  const pct = Math.round(ratio * 100)
  return (
    <div
      className="mt-1.5 h-1.5 overflow-hidden rounded-[3px] bg-[#f0eeec]"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div
        className={`h-full transition-[width] duration-200 ${warn ? 'bg-[#b45309]' : 'bg-[#0f766e]'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function UsageRow({
  resource,
  plan,
  count,
}: {
  resource: LimitedResource
  plan: Plan
  count: number
}) {
  const u = usage(plan, resource, count)
  const warn = u.limit !== null && (u.near || u.atLimit)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{RESOURCE_LABELS[resource]}</span>
        <span className={`tabular shrink-0 font-medium ${warn ? 'text-[#b45309]' : ''}`}>
          {u.limit === null ? `${u.count} · ilimitado` : `${u.count} de ${u.limit}`}
        </span>
      </div>
      {u.limit !== null && (
        <>
          <Bar ratio={u.ratio} warn={warn} label={RESOURCE_LABELS[resource]} />
          {u.atLimit ? (
            <p className="mt-1.5 text-xs text-[#b45309]">
              Límite alcanzado: solicite una mejora de plan para agregar más.
            </p>
          ) : u.near ? (
            <p className="mt-1.5 text-xs text-[#b45309]">
              Aviso al 80%: se está acercando al límite de su plan.
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}

/**
 * One metered quota (roadmap B1). Soft cap: the warnings say what stops (the
 * metered action) and what never does (records and care).
 */
function QuotaRow({
  resource,
  plan,
  used,
}: {
  resource: MeteredResource
  plan: Plan
  used: number
}) {
  const q = quotaStatus(plan, resource, used)
  const monthly = isMonthlyResource(resource)
  const fmt = (n: number) => formatMetered(resource, n)
  const warn = q.included && q.limit !== null && (q.near || q.atLimit)
  return (
    <div data-quota={resource}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{METERED_LABELS[resource]}</span>
        <span
          className={`tabular shrink-0 font-medium ${warn ? 'text-[#b45309]' : !q.included ? 'text-[#57534e]' : ''}`}
        >
          {!q.included
            ? 'No incluido'
            : q.limit === null
              ? `${fmt(q.used)} · ilimitado`
              : `${fmt(q.used)} de ${fmt(q.limit)}`}
        </span>
      </div>
      {q.included && q.limit !== null && (
        <>
          <Bar ratio={q.ratio} warn={warn} label={METERED_LABELS[resource]} />
          {q.atLimit ? (
            <p className="mt-1.5 text-xs text-[#b45309]">
              {q.over > 0 ? `Excedido por ${fmt(q.over)}. ` : 'Límite alcanzado. '}
              {monthly ? 'Se pausa hasta el próximo mes' : 'Se pausa'} o hasta mejorar su plan; sus
              expedientes siguen disponibles.
            </p>
          ) : q.near ? (
            <p className="mt-1.5 text-xs text-[#b45309]">
              Aviso al 80%: ha usado el {Math.floor(q.ratio * 100)}% de su plan
              {monthly ? ' este mes' : ''}.
            </p>
          ) : null}
        </>
      )}
      {!q.included && <p className="mt-1 text-xs text-[#57534e]">Disponible en planes de pago.</p>}
    </div>
  )
}

const limitLine = (limit: number | null, singular: string, plural: string) =>
  limit === null
    ? `${plural.charAt(0).toUpperCase()}${plural.slice(1)} ilimitados`
    : `${limit} ${limit === 1 ? singular : plural}`

export function PlanPanel({
  plan,
  status,
  doctorCount,
  patientCount,
  metered,
  pendingRequest,
}: {
  plan: Plan
  /** Tenant account state (active | pending | suspended), shown on the plan card. */
  status?: string | null
  doctorCount: number
  patientCount: number
  /** Current-period usage of each metered resource ("YYYY-MM" period in the clinic's timezone). */
  metered: { period: string; used: Record<MeteredResource, number> }
  pendingRequest: { plan: Plan; requestedAt: string | null } | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [requesting, setRequesting] = useState<Plan | null>(null)
  const [note, setNote] = useState('')

  const rank = PLANS.indexOf(plan)
  const canUpgrade = PLANS.some((p) => PLANS.indexOf(p) > rank)

  const submit = (target: Plan) => {
    setError(null)
    start(async () => {
      const res = await requestUpgrade(target, note)
      if (res.ok) {
        setRequesting(null)
        setNote('')
        router.refresh()
      } else setError(res.message)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        {/* Left: plan + usage */}
        <div className="flex min-w-0 flex-[1.3_1_360px] flex-col gap-3">
          <section className="rounded-[12px] bg-[#042f2e] p-5 text-white">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <div className="text-xs text-[#b6d4cf]">Su plan</div>
                <div className="text-2xl font-semibold tracking-[-.03em]">{planLabel(plan)}</div>
                <div className="tabular text-sm text-[#b6d4cf]">
                  {planPriceLabel(plan)} · {PLAN_LIMITS[plan].description}
                </div>
              </div>
              {status && (
                <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-[#042f2e]">
                  {STATE_LABELS[status] ?? status}
                </span>
              )}
            </div>
            {canUpgrade && !pendingRequest && (
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href="#planes"
                  className="flex h-11 items-center rounded-[10px] bg-white px-[18px] text-[15px] font-semibold text-[#042f2e] hover:text-[#042f2e]"
                >
                  Cambiar de plan
                </a>
              </div>
            )}
          </section>

          <section className={`${CARD} px-[18px] py-4`}>
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
              <h2 className="font-semibold">Uso del mes</h2>
              <span className="text-[13px] text-[#57534e]">
                {periodLabel(metered.period).replace(/^./, (c) => c.toUpperCase())} · se reinicia el
                día 1
              </span>
            </div>
            <div className="mt-3.5 flex flex-col gap-3.5">
              <UsageRow resource="doctors" plan={plan} count={doctorCount} />
              <UsageRow resource="patients" plan={plan} count={patientCount} />
              {METERED_RESOURCES.map((r) => (
                <QuotaRow key={r} resource={r} plan={plan} used={metered.used[r] ?? 0} />
              ))}
            </div>
            <p className="mt-3.5 text-[13px] text-[#57534e]">
              Le avisamos al 80% y al 100%. Al llegar al límite solo se pausa ese servicio; la
              atención y los expedientes nunca se bloquean. El almacenamiento es el total acumulado.
            </p>
          </section>
        </div>

        {/* Right: pending request + request form */}
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
          {pendingRequest ? (
            <section className="rounded-[12px] border border-[#b45309]/40 bg-white px-[18px] py-4">
              <div className="font-semibold">
                Mejora al plan {planLabel(pendingRequest.plan)} solicitada
                {pendingRequest.requestedAt &&
                  ` el ${new Date(pendingRequest.requestedAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}`}
              </div>
              <p className="mt-1 text-[13px] text-[#57534e]">
                Nuestro equipo revisa las solicitudes en un día hábil. Sus límites cambiarán una vez
                aprobada.
              </p>
            </section>
          ) : (
            <section className={`${CARD} px-[18px] py-4`}>
              <div className="font-semibold">Cambios de plan</div>
              <p className="mt-1 text-[13px] text-[#57534e]">
                {canUpgrade
                  ? 'Elija un plan abajo y envíe la solicitud. No se realiza ningún cobro ahora: un superadministrador revisa y aplica el cambio.'
                  : 'Ya está en el plan más completo.'}
              </p>
            </section>
          )}
        </div>
      </div>

      {/* Plan cards */}
      <h2 id="planes" className="mt-3 scroll-mt-20 text-[17px] font-semibold tracking-[-.02em]">
        Planes
      </h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {PLANS.map((p) => {
          const limits = PLAN_LIMITS[p]
          const isCurrent = p === plan
          const isUpgrade = PLANS.indexOf(p) > rank
          return (
            <section
              key={p}
              className={`flex flex-col rounded-[12px] border bg-white px-[18px] py-4 ${isCurrent ? 'border-[#0f766e]' : 'border-[#e7e5e4]'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[15px] font-semibold">{limits.label}</h3>
                {isCurrent && (
                  <span className="rounded-md border border-[#0f766e] px-2 py-0.5 text-xs font-semibold text-[#0f766e]">
                    Actual
                  </span>
                )}
              </div>
              <div className="tabular mt-1 text-[22px] font-medium tracking-[-.03em]">
                {planPriceLabel(p)}
              </div>
              <p className="mt-0.5 text-[13px] text-[#57534e]">{limits.description}</p>
              <ul className="mt-3 flex-1 space-y-1.5 border-t border-[#f0eeec] pt-3 text-[13px] text-[#44403c]">
                <li>{limitLine(limits.doctors, 'médico', 'médicos')}</li>
                <li>{limitLine(limits.patients, 'paciente', 'pacientes')}</li>
                {METERED_RESOURCES.map((r) => (
                  <li key={r}>{quotaLine(p, r)}</li>
                ))}
              </ul>
              {isUpgrade && !pendingRequest && (
                <button
                  className={`${requesting === p ? btnPrimary : btnGhost} mt-4 w-full`}
                  disabled={pending}
                  onClick={() => {
                    setError(null)
                    setRequesting((r) => (r === p ? null : p))
                  }}
                >
                  Solicitar mejora
                </button>
              )}
            </section>
          )
        })}
      </div>

      {error && (
        <p
          className="rounded-[10px] border border-[#b45309]/30 bg-[#faf3e6] px-3 py-2 text-sm text-[#b45309]"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Inline request form — billing is intentionally stubbed (spec §5) */}
      {requesting && (
        <section className="rounded-[12px] border border-[#0f766e] bg-white px-[18px] py-4">
          <h3 className="font-semibold">Solicitar mejora al plan {planLabel(requesting)}</h3>
          <p className="mt-1 text-[13px] text-[#57534e]">
            No se realiza ningún cobro ahora: un superadministrador revisa y aplica el cambio.
          </p>
          <label
            htmlFor="upgrade-note"
            className="mt-4 mb-1.5 block text-[13px] font-medium text-[#44403c]"
          >
            Nota (opcional)
          </label>
          <textarea
            id="upgrade-note"
            className={textareaClass}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="p. ej., El próximo mes se suman dos médicos más"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={btnPrimary} disabled={pending} onClick={() => submit(requesting)}>
              {pending && <Spinner />}
              {pending ? 'Enviando…' : 'Enviar solicitud'}
            </button>
            <button className={btnGhost} disabled={pending} onClick={() => setRequesting(null)}>
              Cancelar
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
