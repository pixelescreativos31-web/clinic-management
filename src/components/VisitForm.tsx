'use client'

// Consultation form — redesigned (design handoff "Consulta"). Only «Motivo» and
// «Diagnóstico» are required; everything else lives in collapsible sections that
// change with the format (General / Nutrición). A sticky bar saves (and can print
// the prescription). Saving a new consultation completes the appointment and
// returns to the agenda.

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from './primitives'
import { IconAlert } from './icons'
import { EMPTY_NUTRITION, GOOD_BAD, NUTRITION_FIELDS, YES_NO, waistHipRatio, type NutritionFormState } from '@/lib/nutrition'
import { recordVisit, updateVisit, type PrescriptionRowInput, type VisitInput } from '@/app/(frontend)/dashboard/visits/actions'

export type VisitFormat = 'general' | 'nutrition'

export type VisitInitial = {
  chiefComplaint: string
  symptoms: string
  physicalExam: string
  diagnosis: string
  treatmentPlan: string
  labOrders: string
  notes: string
  followUpDate: string
  vitals: Record<VitalKey, string>
  prescription: PrescriptionRowInput[]
  nutrition?: NutritionFormState
  format?: VisitFormat
}

type VitalKey = 'bpSystolic' | 'bpDiastolic' | 'pulse' | 'respiratoryRate' | 'temperatureC' | 'oxygenSaturation' | 'weightKg' | 'heightCm' | 'glucoseMgDl'

const VITALS: { key: VitalKey; label: string; ph: string }[] = [
  { key: 'bpSystolic', label: 'PA sistólica', ph: '120' },
  { key: 'bpDiastolic', label: 'PA diastólica', ph: '80' },
  { key: 'temperatureC', label: 'Temp (°C)', ph: '37' },
  { key: 'weightKg', label: 'Peso (kg)', ph: '70' },
  { key: 'heightCm', label: 'Talla (cm)', ph: '165' },
  { key: 'pulse', label: 'Pulso', ph: '72' },
  { key: 'oxygenSaturation', label: 'SpO₂ %', ph: '98' },
  { key: 'respiratoryRate', label: 'FR (rpm)', ph: '16' },
  { key: 'glucoseMgDl', label: 'Glucemia', ph: '95' },
]
const EMPTY_VITALS = Object.fromEntries(VITALS.map((v) => [v.key, ''])) as Record<VitalKey, string>

const FREQ_CHIPS: { label: string; value: string; note?: string }[] = [
  { label: 'Cada 8 h', value: 'tds' },
  { label: 'Cada 12 h', value: 'bd' },
  { label: 'Cada 24 h', value: 'od' },
  { label: 'Cada 6 h', value: 'qid' },
  { label: 'Al dormir', value: 'other', note: 'Al dormir' },
  { label: 'Si hay dolor', value: 'sos' },
]

const LAB_CHIPS = ['Hemograma', 'Glicemia', 'HbA1c', 'Perfil lipídico', 'Orina', 'Coprológico', 'Sonografía abdominal', 'Tiroides']

const FOLLOW_CHIPS = [
  { label: '1 semana', days: 7 },
  { label: '15 días', days: 15 },
  { label: '1 mes', days: 30 },
  { label: '3 meses', days: 90 },
]

/** labOrders is stored as "Chip, Chip\nfree text"; split it back for editing. */
function parseLabs(text: string): { chips: string[]; note: string } {
  const [first = '', ...rest] = text.split('\n')
  const items = first.split(/,\s*/).filter(Boolean)
  if (items.length && items.every((i) => LAB_CHIPS.includes(i))) return { chips: items, note: rest.join('\n') }
  return { chips: [], note: text }
}

const addDays = (base: string, days: number) => {
  const [y, m, d] = base.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

const blankRow = (): PrescriptionRowInput => ({ medicine: '', dosage: '', frequency: '', frequencyNote: '', durationDays: undefined, quantity: '', instructions: '' })

const INPUT = 'w-full rounded-[10px] border border-[#e3e7e7] bg-[#fafbfb] px-3 text-base outline-none focus:border-[#0d6e60]'
const AREA = `${INPUT} resize-none py-[11px]`
const chip = (on: boolean, dark = false) =>
  `rounded-full border px-3 py-2 text-[13px] font-semibold ${
    on ? (dark ? 'border-[#15201e] bg-[#15201e] text-white' : 'border-[#0d6e60] bg-[#0d6e60] text-white') : 'border-[#e3e7e7] bg-white text-[#15201e]'
  }`

function Section({ title, hint, open, onToggle, children }: { title: string; hint: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-[#e3e7e7] bg-white">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-[52px] w-full items-center gap-2.5 p-3.5 text-start">
        <span className="flex-1 text-sm font-semibold">{title}</span>
        <span className="truncate text-xs text-[#6b7577]">{hint}</span>
        <span aria-hidden className={`flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f1f3f3] text-xs transition-transform ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {open && <div className="flex flex-col gap-2.5 border-t border-[#eef1f1] px-3.5 pt-3 pb-3.5">{children}</div>}
    </div>
  )
}

function Num({ label, value, onChange, ph }: { label: string; value: string; onChange: (v: string) => void; ph?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-[#6b7577]">{label}</span>
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} className={`${INPUT} tabular h-[46px]`} />
    </label>
  )
}

export function VisitForm({
  appointmentId,
  visitId,
  allergies,
  background,
  initial,
  defaultFormat = 'general',
  frequentDiagnoses = [],
  baseDate,
  returnHref = '/dashboard/appointments',
}: {
  /** New consultation for this appointment… */
  appointmentId?: string
  /** …or edit this recorded consultation. */
  visitId?: string
  allergies?: string | null
  /** Short clinical background shown while consulting (chronic conditions, meds). */
  background?: string | null
  initial?: VisitInitial
  defaultFormat?: VisitFormat
  /** The doctor's most frequent diagnoses, offered as one-tap chips. */
  frequentDiagnoses?: string[]
  /** YYYY-MM-DD the consultation happens (follow-up chips count from here). */
  baseDate: string
  /** Where saving a NEW consultation returns to. */
  returnHref?: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [format, setFormat] = useState<VisitFormat>(initial?.format ?? defaultFormat)
  const nutri = format === 'nutrition'

  const [chiefComplaint, setChiefComplaint] = useState(initial?.chiefComplaint ?? '')
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis ?? '')
  const [symptoms, setSymptoms] = useState(initial?.symptoms ?? '')
  const [physicalExam, setPhysicalExam] = useState(initial?.physicalExam ?? '')
  const [treatmentPlan, setTreatmentPlan] = useState(initial?.treatmentPlan ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [followUp, setFollowUp] = useState(initial?.followUpDate ?? '')
  const [vitals, setVitals] = useState<Record<VitalKey, string>>(initial?.vitals ?? EMPTY_VITALS)
  const [nutrition, setNutrition] = useState<NutritionFormState>(initial?.nutrition ?? EMPTY_NUTRITION)
  const initialLabs = useMemo(() => parseLabs(initial?.labOrders ?? ''), [initial?.labOrders])
  const [labChips, setLabChips] = useState<string[]>(initialLabs.chips)
  const [labNote, setLabNote] = useState(initialLabs.note)
  const [rows, setRows] = useState<PrescriptionRowInput[]>(initial?.prescription.length ? initial.prescription : [blankRow()])

  const has = (...v: (string | undefined)[]) => v.some((x) => x && x.trim())
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({
    vitals: Object.values(initial?.vitals ?? {}).some(Boolean) || (initial?.format ?? defaultFormat) === 'nutrition',
    ask: has(initial?.symptoms, initial?.physicalExam),
    rx: true,
    lab: has(initial?.labOrders),
    follow: has(initial?.treatmentPlan, initial?.followUpDate, initial?.notes),
  }))
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }))

  const setN = (key: string, value: string) => setNutrition((n) => ({ ...n, [key]: value }))
  const setV = (key: VitalKey, value: string) => setVitals((v) => ({ ...v, [key]: value }))
  const setRow = (i: number, patch: Partial<PrescriptionRowInput>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))

  const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')))
  const bmi = (() => {
    const w = num(vitals.weightKg)
    const h = num(vitals.heightCm)
    if (!w || !h) return null
    const v = w / (h / 100) ** 2
    return Number.isFinite(v) && v > 5 && v < 100 ? v.toFixed(1) : null
  })()
  const ratio = waistHipRatio({ waistCm: num(nutrition.waistCm), hipCm: num(nutrition.hipCm) })
  const rxCount = rows.filter((r) => r.medicine.trim()).length
  const followLabel = FOLLOW_CHIPS.find((c) => addDays(baseDate, c.days) === followUp)?.label ?? (followUp ? followUp.split('-').reverse().join('/') : '')
  const nutriFields = (group: string) => NUTRITION_FIELDS.filter((f) => f.group === group)

  const save = (print: boolean) => {
    if (!chiefComplaint.trim() || !diagnosis.trim()) {
      setError('Complete el motivo de consulta y el diagnóstico.')
      return
    }
    setError(null)
    // Open the print tab inside the click so popup blockers allow it.
    const printTab = print ? window.open('', '_blank') : null
    start(async () => {
      const data: Omit<VisitInput, 'appointmentId'> = {
        chiefComplaint,
        symptoms,
        physicalExam,
        diagnosis,
        treatmentPlan,
        labOrders: [labChips.join(', '), labNote.trim()].filter(Boolean).join('\n'),
        notes,
        vitals: Object.fromEntries(VITALS.map((v) => [v.key, num(vitals[v.key])])),
        prescription: rows
          .filter((r) => r.medicine.trim())
          .map((r) => ({ ...r, durationDays: r.durationDays ? Number(r.durationDays) : undefined })),
        followUpDate: followUp || undefined,
        format,
        ...(nutri ? { nutrition } : {}),
      }
      const res = visitId ? await updateVisit(visitId, data) : await recordVisit({ appointmentId: appointmentId!, ...data })
      if (!res.ok) {
        printTab?.close()
        setError(res.message)
        return
      }
      if (printTab) printTab.location.href = `/print/prescription/${res.data.id}`
      const msg = encodeURIComponent(print ? 'Consulta guardada · imprimiendo receta' : 'Consulta guardada')
      if (visitId && 'patientId' in res.data) router.push(`/dashboard/patients/${res.data.patientId}?tab=historia`)
      else router.push(`${returnHref}${returnHref.includes('?') ? '&' : '?'}ok=${msg}`)
      router.refresh()
    })
  }

  return (
    <div className="flex max-w-[720px] flex-col gap-2.5 pb-24">
      {allergies && (
        <div className="flex items-center gap-2.5 rounded-[10px] bg-[#fbeceb] px-3 py-2.5 text-[13px] font-semibold text-[#b3261e]">
          <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[#b3261e] text-white">
            <IconAlert size={11} strokeWidth={3} />
          </span>
          Alergias: {allergies}
        </div>
      )}
      {background && <p className="px-1 text-xs leading-relaxed text-[#6b7577]">{background}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[#6b7577]">Formato:</span>
        {(['general', 'nutrition'] as VisitFormat[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={format === f}
            onClick={() => {
              setFormat(f)
              if (f === 'nutrition') setOpen((o) => ({ ...o, vitals: true }))
            }}
            className={`rounded-full border px-3 py-[7px] text-xs font-semibold ${format === f ? 'border-[#0d6e60] bg-[#0d6e60] text-white' : 'border-[#e3e7e7] bg-white'}`}
          >
            {f === 'general' ? 'General' : 'Nutrición'}
          </button>
        ))}
      </div>

      {/* Required */}
      <div className="flex flex-col gap-2.5 rounded-[14px] border border-[#e3e7e7] bg-white p-3.5">
        <label htmlFor="v-motivo" className="text-[13px] font-semibold">
          Motivo de consulta
        </label>
        <textarea id="v-motivo" rows={2} value={chiefComplaint} onChange={(e) => {
            setChiefComplaint(e.target.value)
            setError(null)
          }} placeholder="Fiebre de 2 días, dolor de garganta…" className={AREA} />
        <label htmlFor="v-dx" className="mt-1 text-[13px] font-semibold">
          Diagnóstico{nutri ? ' nutricional' : ''}
        </label>
        <input id="v-dx" value={diagnosis} onChange={(e) => {
            setDiagnosis(e.target.value)
            setError(null)
          }} placeholder={nutri ? 'ej. Sobrepeso grado I' : 'ej. Faringitis viral'} className={`${INPUT} h-[46px]`} />
        {frequentDiagnoses.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="self-center text-xs text-[#6b7577]">Frecuentes:</span>
            {frequentDiagnoses.map((d) => (
              <button key={d} type="button" onClick={() => setDiagnosis(d)} className="rounded-full bg-[#f1f3f3] px-2.5 py-1.5 text-xs font-semibold hover:bg-[#e6f1ee]">
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Vitals / anthropometry */}
      <Section title={nutri ? 'Antropometría' : 'Signos vitales'} hint={bmi ? `IMC ${bmi}` : 'opcional'} open={open.vitals} onToggle={() => toggle('vitals')}>
        {nutri ? (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
              <Num label="Peso actual (kg)" value={vitals.weightKg} onChange={(v) => setV('weightKg', v)} ph="64" />
              <Num label="Peso habitual" value={nutrition.usualWeightKg ?? ''} onChange={(v) => setN('usualWeightKg', v)} ph="66" />
              <Num label="Talla (cm)" value={vitals.heightCm} onChange={(v) => setV('heightCm', v)} ph="163" />
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-[#6b7577]">IMC</span>
                <span className="tabular flex h-[46px] items-center rounded-[10px] border border-[#eef1f1] bg-[#f4f6f6] px-3 text-base text-[#6b7577]">{bmi ?? '—'}</span>
              </div>
              {nutriFields('antropometria')
                .filter((f) => f.kind === 'number' && f.key !== 'usualWeightKg')
                .map((f) => (
                  <Num key={f.key} label={`${f.label}${f.unit ? ` (${f.unit})` : ''}`} value={nutrition[f.key] ?? ''} onChange={(v) => setN(f.key, v)} />
                ))}
            </div>
            {ratio != null && <p className="tabular text-xs font-medium text-[#6b7577]">Relación cintura/cadera {ratio}</p>}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#6b7577]">Meta</span>
              <input value={nutrition.goal ?? ''} onChange={(e) => setN('goal', e.target.value)} placeholder="ej. Bajar a 60 kg en 4 meses" className={`${INPUT} h-[46px]`} />
            </label>
            <span className="mt-1 text-[11px] font-semibold tracking-[.06em] text-[#6b7577] uppercase">Signos vitales</span>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
              {VITALS.filter((v) => v.key !== 'weightKg' && v.key !== 'heightCm').map((v) => (
                <Num key={v.key} label={v.label} value={vitals[v.key]} onChange={(x) => setV(v.key, x)} ph={v.ph} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
              {VITALS.map((v) => (
                <Num key={v.key} label={v.label} value={vitals[v.key]} onChange={(x) => setV(v.key, x)} ph={v.ph} />
              ))}
            </div>
            {bmi && <p className="tabular text-xs font-medium text-[#6b7577]">IMC {bmi}</p>}
          </>
        )}
      </Section>

      {/* Interrogation */}
      <Section title="Interrogatorio" hint={nutri ? 'hábitos · sueño · agua' : 'historia · examen físico'} open={open.ask} onToggle={() => toggle('ask')}>
        {nutri && (
          <>
            {nutriFields('interrogatorio')
              .filter((f) => f.kind === 'yesno' || f.kind === 'goodbad')
              .map((f) => {
                const opts = f.kind === 'yesno' ? YES_NO : GOOD_BAD
                const label = f.key === 'waterIntake' ? 'Consumo de agua adecuado' : f.label
                return (
                  <div key={f.key} className="flex min-h-11 items-center gap-2">
                    <span className="flex-1 text-sm">{label}</span>
                    {[
                      ['Sí', opts[0].value],
                      ['No', opts[1].value],
                    ].map(([l, v]) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={nutrition[f.key] === v}
                        aria-label={`${label}: ${l}`}
                        onClick={() => setN(f.key, nutrition[f.key] === v ? '' : v)}
                        className={`rounded-full border px-3.5 py-[9px] text-[13px] font-semibold ${
                          nutrition[f.key] === v ? 'border-[#15201e] bg-[#15201e] text-white' : 'border-[#e3e7e7] bg-white'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                )
              })}
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <Num label="Sueño (h/día)" value={nutrition.sleepHours ?? ''} onChange={(v) => setN('sleepHours', v)} ph="7" />
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-[#6b7577]">Calidad del sueño</span>
                <input value={nutrition.sleepQuality ?? ''} onChange={(e) => setN('sleepQuality', e.target.value)} className={`${INPUT} h-[46px]`} />
              </label>
            </div>
          </>
        )}
        <textarea
          rows={2}
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          placeholder={nutri ? 'APP, APF, otros hallazgos…' : 'Historia de la enfermedad actual, APP, APF, hábitos…'}
          aria-label="Historia e interrogatorio"
          className={AREA}
        />
        <textarea rows={2} value={physicalExam} onChange={(e) => setPhysicalExam(e.target.value)} placeholder="Examen físico…" aria-label="Examen físico" className={AREA} />
      </Section>

      {/* Prescription */}
      <Section title="Receta" hint={`${rxCount} medicamento${rxCount === 1 ? '' : 's'}`} open={open.rx} onToggle={() => toggle('rx')}>
        {rows.map((r, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-[10px] bg-[#f4f6f6] p-2.5">
            <div className="flex gap-2">
              <input
                value={r.medicine}
                onChange={(e) => setRow(i, { medicine: e.target.value })}
                placeholder="Medicamento y dosis (Amoxicilina 500 mg)"
                aria-label="Medicamento y dosis"
                className={`${INPUT} h-[46px] bg-white`}
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  aria-label="Quitar medicamento"
                  className="h-[46px] shrink-0 rounded-[10px] border border-[#e3e7e7] bg-white px-3 text-[#6b7577]"
                >
                  ✕
                </button>
              )}
            </div>
            {r.dosage ? <span className="text-xs text-[#6b7577]">Dosis registrada: {r.dosage}</span> : null}
            <div className="flex flex-wrap gap-1.5">
              {FREQ_CHIPS.map((c) => {
                const on = r.frequency === c.value && (c.value !== 'other' || r.frequencyNote === c.note)
                return (
                  <button
                    key={c.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setRow(i, on ? { frequency: '', frequencyNote: '' } : { frequency: c.value, frequencyNote: c.note ?? '' })}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold ${on ? 'border-[#0d6e60] bg-[#0d6e60] text-white' : 'border-[#e3e7e7] bg-white'}`}
                  >
                    {c.label}
                  </button>
                )
              })}
              {r.frequency === 'other' && !FREQ_CHIPS.some((c) => c.note === r.frequencyNote) && (
                <span className="rounded-full border border-[#0d6e60] bg-[#0d6e60] px-3 py-2 text-xs font-semibold text-white">{r.frequencyNote || 'Otra'}</span>
              )}
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-2">
              <input
                inputMode="numeric"
                value={r.durationDays ?? ''}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, '')
                  setRow(i, { durationDays: d === '' ? undefined : Number(d) })
                }}
                placeholder="Días"
                aria-label="Días"
                className={`${INPUT} h-[46px] bg-white`}
              />
              <input
                value={r.instructions ?? ''}
                onChange={(e) => setRow(i, { instructions: e.target.value })}
                placeholder="Indicaciones (después de comer)"
                aria-label="Indicaciones"
                className={`${INPUT} h-[46px] bg-white`}
              />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setRows((r) => [...r, blankRow()])} className="self-start py-2.5 text-[13px] font-semibold text-[#0d6e60]">
          + Agregar medicamento
        </button>
      </Section>

      {/* Labs */}
      <Section
        title="Laboratorio"
        hint={labChips.length ? `${labChips.length} solicitado${labChips.length === 1 ? '' : 's'}` : 'solicitar / anotar'}
        open={open.lab}
        onToggle={() => toggle('lab')}
      >
        <div className="flex flex-wrap gap-1.5">
          {LAB_CHIPS.map((l) => {
            const on = labChips.includes(l)
            return (
              <button key={l} type="button" aria-pressed={on} onClick={() => setLabChips((c) => (on ? c.filter((x) => x !== l) : [...c, l]))} className={chip(on)}>
                {l}
              </button>
            )
          })}
        </div>
        <textarea rows={2} value={labNote} onChange={(e) => setLabNote(e.target.value)} placeholder="Otros estudios u observaciones…" aria-label="Otros estudios" className={AREA} />
        {nutri && (
          <>
            <span className="mt-1 text-[11px] font-semibold tracking-[.06em] text-[#6b7577] uppercase">Resultados</span>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
              {nutriFields('laboratorio')
                .filter((f) => f.kind === 'number')
                .map((f) => (
                  <Num key={f.key} label={`${f.label}${f.unit ? ` (${f.unit})` : ''}`} value={nutrition[f.key] ?? ''} onChange={(v) => setN(f.key, v)} />
                ))}
            </div>
            {nutriFields('laboratorio')
              .filter((f) => f.kind !== 'number')
              .map((f) => (
                <label key={f.key} className="flex flex-col gap-1">
                  <span className="text-[11px] text-[#6b7577]">{f.label}</span>
                  <textarea rows={1} value={nutrition[f.key] ?? ''} onChange={(e) => setN(f.key, e.target.value)} className={AREA} />
                </label>
              ))}
          </>
        )}
      </Section>

      {/* Treatment & follow-up */}
      <Section title="Tratamiento y seguimiento" hint={followLabel ? `control en ${followLabel}` : 'sin cita de control'} open={open.follow} onToggle={() => toggle('follow')}>
        <div className="flex flex-wrap items-center gap-1.5">
          {FOLLOW_CHIPS.map((c) => {
            const date = addDays(baseDate, c.days)
            const on = followUp === date
            return (
              <button key={c.label} type="button" aria-pressed={on} onClick={() => setFollowUp(on ? '' : date)} className={chip(on)}>
                {c.label}
              </button>
            )
          })}
          <input
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            aria-label="Otra fecha de control"
            className="h-[38px] rounded-full border border-[#e3e7e7] bg-white px-3 text-[13px]"
          />
        </div>
        <textarea
          rows={2}
          value={treatmentPlan}
          onChange={(e) => setTreatmentPlan(e.target.value)}
          placeholder="Plan / tratamiento no farmacológico… (se imprime en la receta)"
          aria-label="Plan y tratamiento"
          className={AREA}
        />
        {nutri && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {nutriFields('seguimiento').map((f) => (
              <label key={f.key} className="flex flex-col gap-1">
                <span className="text-[11px] text-[#6b7577]">{f.label}</span>
                <input value={nutrition[f.key] ?? ''} onChange={(e) => setN(f.key, e.target.value)} placeholder={f.placeholder} className={`${INPUT} h-[46px]`} />
              </label>
            ))}
          </div>
        )}
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas privadas (no se imprimen)" aria-label="Notas privadas" className={AREA} />
      </Section>

      {error && (
        <p className="rounded-[10px] bg-[#fbeceb] px-3 py-2 text-sm text-[#b3261e]" role="alert">
          {error}
        </p>
      )}

      {/* Sticky save bar — sits above the phone tab bar */}
      <div className="fixed inset-x-0 bottom-[82px] z-20 bg-[linear-gradient(to_top,#f4f6f6_70%,rgba(244,246,246,0))] px-3.5 py-2.5 md:bottom-0 md:left-[232px] md:px-7 md:pb-4">
        <div className="flex w-full max-w-[720px] gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => save(false)}
            className="flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#0d6e60] p-3.5 text-[15px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(13,110,96,.6)]"
          >
            {pending && <Spinner />}
            {visitId ? 'Guardar cambios' : 'Guardar consulta'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => save(true)}
            className="min-h-[50px] rounded-xl border border-[#0d6e60] bg-white px-4 py-3.5 text-[15px] font-semibold text-[#0d6e60]"
          >
            Guardar e imprimir
          </button>
        </div>
      </div>
    </div>
  )
}
