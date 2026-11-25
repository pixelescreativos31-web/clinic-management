'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, btnPrimary, btnGhost, textareaClass, Spinner } from './primitives'
import { IconCheck, IconClock } from './icons'
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

const RESOURCE_LABELS: Record<LimitedResource, string> = {
  doctors: 'Médicos activos',
  patients: 'Pacientes',
}

function UsageBar({ resource, plan, count }: { resource: LimitedResource; plan: Plan; count: number }) {
  const u = usage(plan, resource, count)
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-ink">{RESOURCE_LABELS[resource]}</span>
        <span className="tabular text-[13px] text-muted-foreground">
          {u.limit === null ? `${u.count} · ilimitado` : `${u.count} de ${u.limit}`}
        </span>
      </div>
      {u.limit !== null && (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${u.atLimit ? 'bg-red' : u.near ? 'bg-amber' : 'bg-primary'}`}
              style={{ width: `${Math.round(u.ratio * 100)}%` }}
            />
          </div>
          {u.atLimit ? (
            <p className="mt-1.5 text-xs text-red">Límite alcanzado: solicite una mejora de plan para agregar más.</p>
          ) : u.near ? (
            <p className="mt-1.5 text-xs text-amber">Se está acercando al límite de su plan.</p>
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
function QuotaBar({ resource, plan, used }: { resource: MeteredResource; plan: Plan; used: number }) {
  const q = quotaStatus(plan, resource, used)
  const monthly = isMonthlyResource(resource)
  const fmt = (n: number) => formatMetered(resource, n)
  return (
    <div data-quota={resource}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-ink">{METERED_LABELS[resource]}</span>
        <span className="tabular shrink-0 text-[13px] text-muted-foreground">
          {!q.included ? 'No incluido' : q.limit === null ? `${fmt(q.used)} · ilimitado` : `${fmt(q.used)} de ${fmt(q.limit)}`}
        </span>
      </div>
      {q.included && q.limit !== null && (
        <>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={METERED_LABELS[resource]}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(q.ratio * 100)}
          >
            <div
              className={`h-full rounded-full transition-all ${q.atLimit ? 'bg-red' : q.near ? 'bg-amber' : 'bg-primary'}`}
              style={{ width: `${Math.round(q.ratio * 100)}%` }}
            />
          </div>
          {q.atLimit ? (
            <p className="mt-1.5 text-xs text-red">
              {q.over > 0 ? `Excedido por ${fmt(q.over)}. ` : 'Límite alcanzado. '}
              {monthly ? 'Se pausa hasta el próximo mes' : 'Se pausa'} o hasta mejorar su plan; sus expedientes siguen
              disponibles.
            </p>
          ) : q.near ? (
            <p className="mt-1.5 text-xs text-amber">Ha usado el {Math.floor(q.ratio * 100)}% de su plan{monthly ? ' este mes' : ''}.</p>
          ) : null}
        </>
      )}
      {!q.included && <p className="mt-1.5 text-xs text-muted-foreground">Disponible en planes de pago.</p>}
    </div>
  )
}

const limitLine = (limit: number | null, singular: string, plural: string) =>
  limit === null ? `${plural.charAt(0).toUpperCase()}${plural.slice(1)} ilimitados` : `${limit} ${limit === 1 ? singular : plural}`

export function PlanPanel({
  plan,
  doctorCount,
  patientCount,
  metered,
  pendingRequest,
}: {
  plan: Plan
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
    <div className="flex max-w-3xl flex-col gap-5">
      {/* Current usage against the plan's caps */}
      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Uso</h2>
          <span className="inline-flex items-center rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
            Plan {planLabel(plan)}
          </span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <UsageBar resource="doctors" plan={plan} count={doctorCount} />
          <UsageBar resource="patients" plan={plan} count={patientCount} />
        </div>
      </Card>

      {/* Metered monthly quotas (soft cap) */}
      <Card className="p-6">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Consumo del mes</h2>
          <span className="text-xs text-muted-foreground">
            {periodLabel(metered.period).replace(/^./, (c) => c.toUpperCase())}
          </span>
        </div>
        <p className="mb-5 text-xs text-muted-foreground">
          Le avisamos al 80% y al 100%. Al llegar al límite solo se pausa ese servicio; la atención y los expedientes
          nunca se bloquean. El almacenamiento es el total acumulado.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          {METERED_RESOURCES.map((r) => (
            <QuotaBar key={r} resource={r} plan={plan} used={metered.used[r] ?? 0} />
          ))}
        </div>
      </Card>

      {pendingRequest && (
        <Card className="flex items-center gap-3 border-amber/30 bg-amber-soft/40 p-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-soft text-amber">
            <IconClock size={15} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium">
              Mejora al plan {planLabel(pendingRequest.plan)} solicitada
              {pendingRequest.requestedAt &&
                ` el ${new Date(pendingRequest.requestedAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Nuestro equipo revisa las solicitudes en un día hábil. Sus límites cambiarán una vez aprobada.
            </p>
          </div>
        </Card>
      )}

      {error && (
        <p className="rounded-lg border border-red/25 bg-red-soft px-3 py-2 text-sm text-red" role="alert">
          {error}
        </p>
      )}

      {/* Plan cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((p) => {
          const limits = PLAN_LIMITS[p]
          const isCurrent = p === plan
          const isUpgrade = PLANS.indexOf(p) > rank
          return (
            <Card key={p} className={`flex flex-col p-5 ${isCurrent ? 'border-primary ring-1 ring-primary/30' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold">{limits.label}</h3>
                {isCurrent && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                    <IconCheck size={11} /> Actual
                  </span>
                )}
              </div>
              <div className="tabular mt-1 text-sm font-semibold text-primary">{planPriceLabel(p)}</div>
              <p className="mt-1 text-xs text-muted-foreground">{limits.description}</p>
              <ul className="mt-3 flex-1 space-y-1.5 text-[13px] text-muted-foreground">
                <li>{limitLine(limits.doctors, 'médico', 'médicos')}</li>
                <li>{limitLine(limits.patients, 'paciente', 'pacientes')}</li>
                {METERED_RESOURCES.map((r) => (
                  <li key={r}>{quotaLine(p, r)}</li>
                ))}
              </ul>
              {isUpgrade && !pendingRequest && (
                <button
                  className={`${btnGhost} mt-4 w-full`}
                  disabled={pending}
                  onClick={() => {
                    setError(null)
                    setRequesting((r) => (r === p ? null : p))
                  }}
                >
                  Solicitar mejora
                </button>
              )}
            </Card>
          )
        })}
      </div>

      {/* Inline request form — billing is intentionally stubbed (spec §5) */}
      {requesting && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold">
            Solicitar mejora al plan {planLabel(requesting)}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            No se realiza ningún cobro ahora: un superadministrador revisa y aplica el cambio.
          </p>
          <label className="mt-4 mb-2 block text-[13px] font-medium text-ink">Nota (opcional)</label>
          <textarea
            className={textareaClass}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="p. ej., El próximo mes se suman dos médicos más"
          />
          <div className="mt-3 flex gap-2">
            <button className={btnPrimary} disabled={pending} onClick={() => submit(requesting)}>
              {pending && <Spinner />}
              {pending ? 'Enviando…' : 'Enviar solicitud'}
            </button>
            <button className={btnGhost} disabled={pending} onClick={() => setRequesting(null)}>
              Cancelar
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
