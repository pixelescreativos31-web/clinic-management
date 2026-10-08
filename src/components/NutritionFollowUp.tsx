// Hoja de seguimiento (nutrition template): one row per consultation plus a weight
// trend, mirroring the paper "Seguimiento – Registro" sheet. Server component —
// a hand-drawn SVG keeps it dependency-free and printable.

import { Card } from './primitives'
import { formatDate } from '@/lib/format'
import { formatNutritionValue, NUTRITION_FIELDS, type NutritionValues } from '@/lib/nutrition'
import type { Tenant, Visit } from '@/payload-types'

const field = (key: string) => NUTRITION_FIELDS.find((f) => f.key === key)!
const show = (key: string, v: NutritionValues | null | undefined) => formatNutritionValue(field(key), v?.[key]) ?? '—'

function bmi(weight?: number | null, heightCm?: number | null): string {
  if (!weight || !heightCm) return '—'
  const v = weight / (heightCm / 100) ** 2
  return Number.isFinite(v) ? v.toFixed(1) : '—'
}

function WeightChart({ points }: { points: { label: string; kg: number }[] }) {
  const W = 640
  const H = 160
  const pad = { l: 40, r: 16, t: 16, b: 28 }
  const kgs = points.map((p) => p.kg)
  const lo = Math.floor(Math.min(...kgs) - 1)
  const hi = Math.ceil(Math.max(...kgs) + 1)
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1))
  const y = (kg: number) => pad.t + ((hi - kg) * (H - pad.t - pad.b)) / (hi - lo || 1)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img" aria-label="Evolución del peso">
      {[lo, (lo + hi) / 2, hi].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray="3 3" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {Number.isInteger(t) ? t : t.toFixed(1)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.kg)} r={3.5} className="fill-card stroke-primary" strokeWidth={2} />
          <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function NutritionFollowUp({ visits, tenant }: { visits: Visit[]; tenant: Tenant | null }) {
  // Oldest first, like the paper sheet.
  const rows = [...visits].sort((a, b) => a.visitDate.localeCompare(b.visitDate))
  const weighed = rows.filter((v) => v.vitals?.weightKg)
  const first = weighed[0]?.vitals?.weightKg
  const last = weighed[weighed.length - 1]?.vitals?.weightKg
  const goal = [...rows].reverse().find((v) => v.nutrition?.goal)?.nutrition?.goal

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-semibold">Seguimiento</h2>
        <div className="tabular flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {goal && <span>Meta: <span className="font-medium text-ink">{goal}</span></span>}
          {first != null && last != null && weighed.length > 1 && (
            <span>
              Cambio total:{' '}
              <span className="font-medium text-ink">
                {last - first > 0 ? '+' : ''}
                {(last - first).toFixed(1)} kg
              </span>
            </span>
          )}
        </div>
      </div>

      {weighed.length > 0 && (
        <div className="border-b border-border px-3 pt-2">
          <WeightChart points={weighed.map((v) => ({ label: formatDate(v.visitDate, tenant), kg: v.vitals!.weightKg! }))} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              {['#', 'Fecha', 'Peso', 'Cambio', 'IMC', 'Cintura', 'Ejercicio', 'Estreñim.', 'Ansiedad', 'Dieta', 'Tratamiento'].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((v, i) => {
              const w = v.vitals?.weightKg
              const prevW = rows.slice(0, i).reverse().find((p) => p.vitals?.weightKg)?.vitals?.weightKg
              const delta = w != null && prevW != null ? w - prevW : null
              return (
                <tr key={v.id} className="align-top">
                  <td className="tabular px-3 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="tabular whitespace-nowrap px-3 py-2">{formatDate(v.visitDate, tenant)}</td>
                  <td className="tabular whitespace-nowrap px-3 py-2 font-medium">{w != null ? `${w} kg` : '—'}</td>
                  <td className={`tabular whitespace-nowrap px-3 py-2 ${delta != null && delta < 0 ? 'text-primary' : ''}`}>
                    {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg`}
                  </td>
                  <td className="tabular px-3 py-2">{bmi(w, v.vitals?.heightCm)}</td>
                  <td className="tabular whitespace-nowrap px-3 py-2">{show('waistCm', v.nutrition)}</td>
                  <td className="px-3 py-2">{show('exercise', v.nutrition)}</td>
                  <td className="px-3 py-2">{show('constipation', v.nutrition)}</td>
                  <td className="px-3 py-2">{show('anxiety', v.nutrition)}</td>
                  <td className="px-3 py-2">{show('diet', v.nutrition)}</td>
                  <td className="max-w-[220px] px-3 py-2 text-muted-foreground">
                    <span className="line-clamp-2">{v.treatmentPlan || '—'}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
