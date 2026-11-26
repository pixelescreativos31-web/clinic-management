// Follow-up sheet pieces shared by the patient's «Programa» tab and its printout:
// weight chart, the controls table and the body-measurement comparison.
// Server-safe (no hooks).

import { bmiLabel, fmtDelta, isMeasureWeek, kgToLb, METRICS, MEASURE_KEYS, weekLabel } from '@/lib/program'
import type { ControlRow } from '@/lib/programData'
import type { ControlRow as Progress } from '@/lib/program'

type Row = Progress<ControlRow>

const n1 = (v?: number | null) => (v == null ? '—' : String(Math.round(v * 10) / 10))
const fmtDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/** Weight by week in the clinic's unit — single series, so no legend; the table is its data view. */
export function WeightChart({ rows, unit = 'lb' }: { rows: Row[]; unit?: 'lb' | 'kg' }) {
  const pts = rows.filter((r) => r.weightKg != null).map((r) => ({ week: r.week, lb: unit === 'lb' ? kgToLb(r.weightKg!) : Math.round(r.weightKg! * 10) / 10, date: r.date }))
  if (pts.length < 2) return null
  const W = 640
  const H = 200
  const pad = { l: 44, r: 16, t: 14, b: 28 }
  const minW = Math.min(...pts.map((p) => p.week))
  const maxW = Math.max(...pts.map((p) => p.week))
  const lo = Math.floor(Math.min(...pts.map((p) => p.lb)) - 2)
  const hi = Math.ceil(Math.max(...pts.map((p) => p.lb)) + 2)
  const x = (w: number) => pad.l + ((w - minW) / Math.max(1, maxW - minW)) * (W - pad.l - pad.r)
  const y = (lb: number) => pad.t + (1 - (lb - lo) / Math.max(1, hi - lo)) * (H - pad.t - pad.b)
  const ticks = Array.from({ length: 4 }, (_, i) => Math.round(lo + ((hi - lo) * i) / 3))
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.week).toFixed(1)},${y(p.lb).toFixed(1)}`).join(' ')
  const first = pts[0]
  const last = pts[pts.length - 1]
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Peso de ${first.lb} ${unit} a ${last.lb} ${unit} entre ${weekLabel(first.week)} y ${weekLabel(last.week)}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e7e5e4" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#57534e">
              {t}
            </text>
          </g>
        ))}
        {pts.map((p) => (
          <text key={`x${p.week}`} x={x(p.week)} y={H - 8} textAnchor="middle" fontSize={11} fill="#57534e">
            {p.week === 0 ? 'Ini' : `S${p.week}`}
          </text>
        ))}
        <path d={path} fill="none" stroke="#0f766e" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p) => (
          <g key={`p${p.week}`}>
            <circle cx={x(p.week)} cy={y(p.lb)} r={4} fill="#0f766e" stroke="#fff" strokeWidth={2} />
            {/* Larger invisible hit target carries the tooltip. */}
            <circle cx={x(p.week)} cy={y(p.lb)} r={12} fill="transparent">
              <title>{`${weekLabel(p.week)} · ${fmtDate(p.date)} · ${p.lb} ${unit}`}</title>
            </circle>
          </g>
        ))}
        <text x={x(last.week)} y={y(last.lb) - 10} textAnchor="end" fontSize={12} fontWeight={600} fill="#1c1917">
          {last.lb} {unit}
        </text>
      </svg>
      <figcaption className="text-xs text-[#57534e]">Peso ({unit}) por semana</figcaption>
    </figure>
  )
}

export function ControlsTable({ rows, editHref, unit = 'lb' }: { rows: Row[]; editHref?: (id: string) => string; unit?: 'lb' | 'kg' }) {
  const comp = METRICS.filter((m) => m.group === 'composition')
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[#e7e5e4] text-left text-xs text-[#57534e]">
            <th className="py-2 pe-2 font-semibold">Semana</th>
            <th className="pe-2 font-semibold">Fecha</th>
            <th className="pe-2 font-semibold">{unit === 'lb' ? 'Peso lb (kg)' : 'Peso kg (lb)'}</th>
            <th className="pe-2 font-semibold">vs. anterior</th>
            <th className="pe-2 font-semibold">vs. inicio</th>
            <th className="pe-2 font-semibold">IMC</th>
            <th className="pe-2 font-semibold">TA</th>
            <th className="pe-2 font-semibold">FC</th>
            <th className="pe-2 font-semibold">FR</th>
            {comp.map((m) => (
              <th key={m.key} className="pe-2 font-semibold">
                {m.short}
              </th>
            ))}
            {editHref && <th className="print:hidden" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[#f0eeec] align-top last:border-0">
              <td className="py-2.5 pe-2 font-semibold whitespace-nowrap">{weekLabel(r.week)}</td>
              <td className="tabular pe-2">{fmtDate(r.date)}</td>
              <td className="tabular pe-2">{r.weightKg != null ? (unit === 'lb' ? `${kgToLb(r.weightKg).toFixed(1)} (${r.weightKg.toFixed(1)})` : `${r.weightKg.toFixed(1)} (${kgToLb(r.weightKg).toFixed(1)})`) : '—'}</td>
              <td className="tabular pe-2">{fmtDelta(r.deltaPrev, unit)}</td>
              <td className="tabular pe-2">{fmtDelta(r.deltaStart, unit)}</td>
              <td className="tabular pe-2" title={bmiLabel(r.bmi) ?? undefined}>
                {r.bmi ?? '—'}
              </td>
              <td className="tabular pe-2">{r.bpSystolic && r.bpDiastolic ? `${r.bpSystolic}/${r.bpDiastolic}` : '—'}</td>
              <td className="tabular pe-2">{n1(r.heartRate)}</td>
              <td className="tabular pe-2">{n1(r.respRate)}</td>
              {comp.map((m) => (
                <td key={m.key} className="tabular pe-2">
                  {r[m.key] != null ? `${n1(r[m.key])}${m.key === 'muscleMass' ? ` ${r.muscleMassUnit ?? 'kg'}` : m.unit}` : '—'}
                </td>
              ))}
              {editHref && (
                <td className="print:hidden">
                  <a href={editHref(r.id)} className="font-medium text-[#0f766e] hover:underline">
                    Editar
                  </a>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Measurements by control that recorded any (initial + every 4 weeks, or ad hoc). */
export function MeasuresTable({ rows }: { rows: Row[] }) {
  const cols = rows.filter((r) => MEASURE_KEYS.some((k) => r[k] != null))
  if (!cols.length) return <p className="text-sm text-[#57534e]">Todavía no hay medidas registradas.</p>
  const measures = METRICS.filter((m) => m.group === 'measures')
  const first = (k: (typeof MEASURE_KEYS)[number]) => cols.find((c) => c[k] != null)?.[k] ?? null
  const latest = (k: (typeof MEASURE_KEYS)[number]) => [...cols].reverse().find((c) => c[k] != null)?.[k] ?? null
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[#e7e5e4] text-left text-xs text-[#57534e]">
            <th className="py-2 pe-3 font-semibold">Medida (cm)</th>
            {cols.map((c) => (
              <th key={c.id} className="pe-3 font-semibold">
                {c.week === 0 ? 'Inicial' : `S${c.week}`}
                {isMeasureWeek(c.week) ? '' : c.week === 0 ? '' : '*'}
                <span className="block font-normal">{fmtDate(c.date)}</span>
              </th>
            ))}
            <th className="pe-3 font-semibold">Cambio</th>
          </tr>
        </thead>
        <tbody>
          {measures.map((m) => {
            const a = first(m.key)
            const b = latest(m.key)
            const d = a != null && b != null ? Math.round((b - a) * 10) / 10 : null
            return (
              <tr key={m.key} className="border-b border-[#f0eeec] last:border-0">
                <td className="py-2 pe-3 font-medium">{m.label.replace(' / circunferencia abdominal', '')}</td>
                {cols.map((c) => (
                  <td key={c.id} className="tabular pe-3">
                    {n1(c[m.key])}
                  </td>
                ))}
                <td className="tabular pe-3 font-semibold">{d == null || cols.length < 2 ? '—' : `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {cols.some((c) => c.week > 0 && !isMeasureWeek(c.week)) && <p className="mt-1 text-xs text-[#57534e]">* Medición fuera del calendario de cada 4 semanas.</p>}
    </div>
  )
}
