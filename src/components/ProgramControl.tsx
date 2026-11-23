'use client'

// The programme-control block of a consultation (format `program`): week, weight
// in kg or lb, height in cm or in, automatic BMI and change versus the previous
// control and the initial evaluation, TA/FC/FR, body composition and measurements.
// Weight/height/TA/FC/FR are the consultation's regular vitals; the rest is `body`.

import { bmi, bmiLabel, cmToIn, fmtDelta, inToCm, isMeasureWeek, kgToLb, lbToKg, METRICS, weekLabel } from '@/lib/program'

export type ProgramContext = {
  programId: string
  name: string
  /** Week this control will get when left as suggested. */
  suggestedWeek: number
  /** Initial-evaluation weight (kg) and the previous weighed control. */
  startWeightKg: number | null
  prev: { week: number; weightKg: number } | null
  /** Latest measurements on record, shown as a reference. */
  lastMeasures: Partial<Record<string, number>>
  /** Latest height on record (cm), to prefill. */
  heightCm: number | null
}

const INPUT = 'w-full rounded-[10px] border border-[#e3e7e7] bg-[#fafbfb] px-3 text-base outline-none focus:border-[#0d6e60]'

function Num({ label, value, onChange, ph, hint }: { label: string; value: string; onChange: (v: string) => void; ph?: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-[#6b7577]">{label}</span>
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} className={`${INPUT} tabular h-[46px]`} />
      {hint && <span className="text-[10px] text-[#6b7577]">{hint}</span>}
    </label>
  )
}

function UnitToggle<T extends string>({ value, options, onChange, label }: { value: T; options: T[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-full border border-[#e3e7e7] bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${value === o ? 'bg-[#0d6e60] text-white' : 'text-[#6b7577]'}`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

const toNum = (s: string) => {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
const round = (n: number, d = 1) => String(Math.round(n * 10 ** d) / 10 ** d)

export type ProgramFormState = {
  week: string
  weight: string
  weightUnit: 'kg' | 'lb'
  height: string
  heightUnit: 'cm' | 'in'
  body: Record<string, string>
}

/** Weight in kg from the form (null when blank or invalid). */
export const formWeightKg = (s: ProgramFormState) => {
  const n = toNum(s.weight)
  return n == null ? null : s.weightUnit === 'lb' ? lbToKg(n) : n
}
export const formHeightCm = (s: ProgramFormState) => {
  const n = toNum(s.height)
  return n == null ? null : s.heightUnit === 'in' ? inToCm(n) : n
}

export function ProgramControl({
  ctx,
  value,
  onChange,
  vitals,
  setVital,
  notes,
  setNotes,
  editing,
}: {
  ctx: ProgramContext
  value: ProgramFormState
  onChange: (v: ProgramFormState) => void
  vitals: Record<string, string>
  setVital: (key: 'bpSystolic' | 'bpDiastolic' | 'pulse' | 'respiratoryRate', v: string) => void
  notes: string
  setNotes: (v: string) => void
  editing: boolean
}) {
  const set = (patch: Partial<ProgramFormState>) => onChange({ ...value, ...patch })
  const setBody = (k: string, v: string) => set({ body: { ...value.body, [k]: v } })
  const week = Number(value.week)
  const weekOk = value.week.trim() !== '' && Number.isInteger(week) && week >= 0
  const kg = formWeightKg(value)
  const cm = formHeightCm(value)
  const imc = bmi(kg, cm)
  const deltaPrev = kg != null && ctx.prev && (!weekOk || ctx.prev.week !== week) ? Math.round((kg - ctx.prev.weightKg) * 100) / 100 : null
  const deltaStart = kg != null && ctx.startWeightKg != null && weekOk && week > 0 ? Math.round((kg - ctx.startWeightKg) * 100) / 100 : null
  const measureWeek = weekOk && (week === 0 || isMeasureWeek(week))

  const switchWeight = (unit: 'kg' | 'lb') => {
    if (unit === value.weightUnit) return
    const n = toNum(value.weight)
    set({ weightUnit: unit, weight: n == null ? value.weight : unit === 'lb' ? round(kgToLb(n)) : round(lbToKg(n), 2) })
  }
  const switchHeight = (unit: 'cm' | 'in') => {
    if (unit === value.heightUnit) return
    const n = toNum(value.height)
    set({ heightUnit: unit, height: n == null ? value.height : unit === 'in' ? round(cmToIn(n)) : round(inToCm(n)) })
  }

  const composition = METRICS.filter((m) => m.group === 'composition')
  const measures = METRICS.filter((m) => m.group === 'measures')

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-[#cfe5df] bg-white p-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <p className="text-[11px] font-semibold tracking-[.06em] text-[#0d6e60] uppercase">{ctx.name}</p>
          <p className="text-base font-semibold">{weekOk ? weekLabel(week) : 'Control'}</p>
        </div>
        <label className="flex w-[110px] flex-col gap-1">
          <span className="text-[11px] text-[#6b7577]">Semana</span>
          <input
            inputMode="numeric"
            value={value.week}
            onChange={(e) => set({ week: e.target.value.replace(/\D/g, '') })}
            disabled={editing}
            aria-label="Número de semana"
            className={`${INPUT} tabular h-[46px] disabled:opacity-60`}
          />
        </label>
      </div>
      {!editing && weekOk && week !== ctx.suggestedWeek && (
        <p className="text-xs text-[#8a5a00]">Sugerida: {weekLabel(ctx.suggestedWeek).toLowerCase()}. Puede registrar otra semana si es un control atrasado.</p>
      )}

      {/* Weight & height */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#6b7577]">Peso</span>
            <UnitToggle label="Unidad de peso" value={value.weightUnit} options={['lb', 'kg']} onChange={switchWeight} />
          </div>
          <input inputMode="decimal" value={value.weight} onChange={(e) => set({ weight: e.target.value })} placeholder={value.weightUnit === 'lb' ? '165' : '75'} aria-label={`Peso en ${value.weightUnit}`} className={`${INPUT} tabular h-[46px]`} />
          <span className="tabular text-[11px] text-[#6b7577]">{kg != null ? (value.weightUnit === 'lb' ? `= ${kg.toFixed(1)} kg` : `= ${kgToLb(kg).toFixed(1)} lb`) : ' '}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#6b7577]">Estatura</span>
            <UnitToggle label="Unidad de estatura" value={value.heightUnit} options={['cm', 'in']} onChange={switchHeight} />
          </div>
          <input inputMode="decimal" value={value.height} onChange={(e) => set({ height: e.target.value })} placeholder={value.heightUnit === 'in' ? '64' : '163'} aria-label={`Estatura en ${value.heightUnit}`} className={`${INPUT} tabular h-[46px]`} />
          <span className="tabular text-[11px] text-[#6b7577]">{cm != null ? (value.heightUnit === 'in' ? `= ${cm.toFixed(1)} cm` : `= ${cmToIn(cm).toFixed(1)} in`) : ' '}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-[10px] bg-[#f4f6f6] p-2.5 text-center">
        <div>
          <p className="text-[10px] text-[#6b7577] uppercase">IMC</p>
          <p className="tabular text-base font-semibold">{imc ?? '—'}</p>
          <p className="text-[10px] text-[#6b7577]">{bmiLabel(imc) ?? ''}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#6b7577] uppercase">vs. anterior{ctx.prev ? ` (S${ctx.prev.week})` : ''}</p>
          <p className="tabular text-sm font-semibold">{fmtDelta(deltaPrev)}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#6b7577] uppercase">vs. inicio</p>
          <p className="tabular text-sm font-semibold">{fmtDelta(deltaStart)}</p>
        </div>
      </div>

      <span className="text-[11px] font-semibold tracking-[.06em] text-[#6b7577] uppercase">Signos vitales</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Num label="TA sistólica" value={vitals.bpSystolic ?? ''} onChange={(v) => setVital('bpSystolic', v)} ph="120" />
        <Num label="TA diastólica" value={vitals.bpDiastolic ?? ''} onChange={(v) => setVital('bpDiastolic', v)} ph="80" />
        <Num label="FC (lpm)" value={vitals.pulse ?? ''} onChange={(v) => setVital('pulse', v)} ph="72" />
        <Num label="FR (rpm)" value={vitals.respiratoryRate ?? ''} onChange={(v) => setVital('respiratoryRate', v)} ph="16" />
      </div>

      <span className="text-[11px] font-semibold tracking-[.06em] text-[#6b7577] uppercase">Composición corporal</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {composition.map((m) =>
          m.key === 'muscleMass' ? (
            <div key={m.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] text-[#6b7577]">Masa muscular</span>
                <UnitToggle label="Unidad de masa muscular" value={(value.body.muscleMassUnit as 'kg' | 'lb' | '%') || 'kg'} options={['kg', 'lb', '%']} onChange={(u) => setBody('muscleMassUnit', u)} />
              </div>
              <input inputMode="decimal" value={value.body.muscleMass ?? ''} onChange={(e) => setBody('muscleMass', e.target.value)} aria-label="Masa muscular" className={`${INPUT} tabular h-[46px]`} />
            </div>
          ) : (
            <Num key={m.key} label={`${m.label} (${m.unit})`} value={value.body[m.key] ?? ''} onChange={(v) => setBody(m.key, v)} />
          ),
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold tracking-[.06em] text-[#6b7577] uppercase">Medidas (cm)</span>
        {measureWeek ? (
          <span className="rounded-full bg-[#e6f1ee] px-2 py-0.5 text-[11px] font-semibold text-[#0d6e60]">Toca medir pecho, cintura y cadera</span>
        ) : (
          <span className="text-[11px] text-[#6b7577]">Pecho, cintura y cadera cada 4 semanas; las demás cuando cambien.</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {measures.map((m) => (
          <Num
            key={m.key}
            label={m.label.replace(' / circunferencia abdominal', '')}
            value={value.body[m.key] ?? ''}
            onChange={(v) => setBody(m.key, v)}
            hint={ctx.lastMeasures[m.key] != null ? `Último: ${ctx.lastMeasures[m.key]}` : undefined}
          />
        ))}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold tracking-[.06em] text-[#6b7577] uppercase">Notas y observaciones del control</span>
        <textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Evolución, adherencia al plan, indicaciones…" className={`${INPUT} resize-y py-[11px]`} />
      </label>
    </div>
  )
}
