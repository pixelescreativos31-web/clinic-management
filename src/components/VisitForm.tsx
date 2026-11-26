'use client'

// Consultation form — design_handoff_medira «Consulta» (max width 860). Only
// «Motivo» and «Diagnóstico» are required; everything else lives in collapsible
// section cards that change with the format (General / Nutrición / Ficha de
// masajes — the formats on offer come from the clinic's profile, see
// src/lib/profiles.ts). A sticky bottom bar saves (and can print the
// prescription). Saving a new consultation completes the appointment and returns
// to the agenda.

import { useRegional } from './RegionalProvider'
import { heightIn, heightToCm, weightIn, weightLabel, weightToKg } from '@/lib/regional'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from './primitives'
import { EMPTY_NUTRITION, GOOD_BAD, NUTRITION_FIELDS, YES_NO, waistHipRatio, type NutritionFormState } from '@/lib/nutrition'
import { recordVisit, updateVisit, type PrescriptionRowInput, type VisitInput } from '@/app/(frontend)/dashboard/visits/actions'
import { EMPTY_MASSAGE, type MassageFormState } from '@/lib/massage'
import { FORMAT_SHORT, type ConsultFormat } from '@/lib/profiles'
import { MassageSheet } from './MassageSheet'
import { formHeightCm, formWeightKg, ProgramControl, type ProgramContext, type ProgramFormState } from './ProgramControl'

export type VisitFormat = ConsultFormat

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
  massage?: MassageFormState
  format?: VisitFormat
  program?: ProgramFormState
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

// Look of the consultation sheet (MassageSheet mirrors it).
const INPUT = 'w-full min-w-0 rounded-[10px] border border-[#d6d3d1] bg-white px-3 text-base text-[#1c1917] outline-none focus:border-[#0f766e]'
const AREA = `${INPUT} resize-y py-2.5 leading-normal`
const FIELD_LABEL = 'text-[13px] font-medium text-[#44403c]'
const chip = (on: boolean) =>
  `min-h-10 rounded-[10px] border px-3.5 py-2 text-sm font-medium transition-colors ${
    on ? 'border-[#1c1917] bg-[#1c1917] text-white' : 'border-[#d6d3d1] bg-white text-[#1c1917] hover:border-[#1c1917]'
  }`

/** Collapsible section card: 15/600 title, hint, «Mostrar» / «Ocultar». */
function Section({ title, hint, open, onToggle, children }: { title: string; hint: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#e7e5e4] bg-white">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-[52px] w-full items-center justify-between gap-3 px-[18px] py-2.5 text-start">
        <span className="min-w-0">
          <span className="text-[15px] font-semibold">{title}</span> <span className="text-[13px] text-[#57534e]">{hint}</span>
        </span>
        <span className="flex-none text-[13px] font-medium text-[#0f766e]">{open ? 'Ocultar' : 'Mostrar'}</span>
      </button>
      {open && <div className="flex flex-col gap-3 px-[18px] pb-[18px]">{children}</div>}
    </section>
  )
}

function Num({ label, value, onChange, ph }: { label: string; value: string; onChange: (v: string) => void; ph?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-[#57534e]">{label}</span>
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} className={`${INPUT} tabular h-11 font-medium`} />
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
  formats = ['general', 'nutrition'],
  massagePrefill,
  program,
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
  /** Formats offered by the clinic's profile (one ⇒ no switcher). */
  formats?: VisitFormat[]
  /** Previous massage sheet's answers, to pre-fill a new one. */
  massagePrefill?: MassageFormState
  /** The patient's active programme (enables the «Programa» format). */
  program?: ProgramContext
  /** The doctor's most frequent diagnoses, offered as one-tap chips. */
  frequentDiagnoses?: string[]
  /** YYYY-MM-DD the consultation happens (follow-up chips count from here). */
  baseDate: string
  /** Where saving a NEW consultation returns to. */
  returnHref?: string
}) {
  const router = useRouter()
  const { weightUnit, heightUnit } = useRegional()
  // Weight and height are typed in the clinic's units and stored in kg / cm.
  const shownW = (kg?: string | null) => (kg && Number(kg) > 0 ? String(weightIn(Number(kg), weightUnit)) : kg ?? '')
  const shownH = (cm?: string | null) => (cm && Number(cm) > 0 ? String(heightIn(Number(cm), heightUnit)) : cm ?? '')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [format, setFormat] = useState<VisitFormat>(initial?.format ?? defaultFormat)
  const nutri = format === 'nutrition'
  const isMassage = format === 'massage'
  const isProgram = format === 'program' && Boolean(program)
  const offered = formats.filter((f) => f !== 'program' || program)
  const [prog, setProg] = useState<ProgramFormState>(
    () =>
      initial?.program ?? {
        week: program ? String(program.suggestedWeek) : '',
        weight: shownW(initial?.vitals.weightKg),
        weightUnit,
        height: shownH(initial?.vitals.heightCm || (program?.heightCm ? String(program.heightCm) : '')),
        heightUnit,
        body: {},
      },
  )
  const [massage, setMassage] = useState<MassageFormState>(initial?.massage ?? massagePrefill ?? EMPTY_MASSAGE)

  const [chiefComplaint, setChiefComplaint] = useState(initial?.chiefComplaint ?? '')
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis ?? '')
  const [symptoms, setSymptoms] = useState(initial?.symptoms ?? '')
  const [physicalExam, setPhysicalExam] = useState(initial?.physicalExam ?? '')
  const [treatmentPlan, setTreatmentPlan] = useState(initial?.treatmentPlan ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [followUp, setFollowUp] = useState(initial?.followUpDate ?? '')
  const [vitals, setVitals] = useState<Record<VitalKey, string>>(() => {
    const v = initial?.vitals ?? EMPTY_VITALS
    return { ...v, weightKg: shownW(v.weightKg), heightCm: shownH(v.heightCm) }
  })
  const [nutrition, setNutrition] = useState<NutritionFormState>(() => {
    const n = initial?.nutrition ?? EMPTY_NUTRITION
    return n.usualWeightKg ? { ...n, usualWeightKg: shownW(n.usualWeightKg) } : n
  })
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
  // An untouched field keeps its stored kg / cm exactly (no lb ⇄ kg rounding drift on re-save).
  const kgOf = (s: string, stored?: string | null) => {
    if (stored && s === shownW(stored)) return num(stored)
    const n = num(s)
    return n == null || !Number.isFinite(n) ? undefined : weightToKg(n, weightUnit)
  }
  const cmOf = (s: string, stored?: string | null) => {
    if (stored && s === shownH(stored)) return num(stored)
    const n = num(s)
    return n == null || !Number.isFinite(n) ? undefined : heightToCm(n, heightUnit)
  }
  const bmi = (() => {
    const w = kgOf(vitals.weightKg)
    const h = cmOf(vitals.heightCm)
    if (!w || !h) return null
    const v = w / (h / 100) ** 2
    return Number.isFinite(v) && v > 5 && v < 100 ? v.toFixed(1) : null
  })()
  const ratio = waistHipRatio({ waistCm: num(nutrition.waistCm), hipCm: num(nutrition.hipCm) })
  const rxCount = rows.filter((r) => r.medicine.trim()).length
  const followLabel = FOLLOW_CHIPS.find((c) => addDays(baseDate, c.days) === followUp)?.label ?? (followUp ? followUp.split('-').reverse().join('/') : '')
  const nutriFields = (group: string) => NUTRITION_FIELDS.filter((f) => f.group === group)

  const save = (print: boolean) => {
    if (isMassage) {
      const services = Array.isArray(massage.services) ? massage.services : []
      if (!services.length && !String(massage.servicesOther ?? '').trim()) {
        setError('Elija al menos un servicio.')
        return
      }
    } else if (isProgram) {
      if (formWeightKg(prog) == null) {
        setError('Registre el peso del control.')
        return
      }
      if (!/^\d+$/.test(prog.week)) {
        setError('Indique el número de semana.')
        return
      }
    } else if (!chiefComplaint.trim() || !diagnosis.trim()) {
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
        vitals: {
          ...Object.fromEntries(VITALS.map((v) => [v.key, num(vitals[v.key])])),
          weightKg: kgOf(vitals.weightKg, initial?.vitals.weightKg),
          heightCm: cmOf(vitals.heightCm, initial?.vitals.heightCm),
          ...(isProgram ? { weightKg: formWeightKg(prog) ?? undefined, heightCm: formHeightCm(prog) ?? undefined } : {}),
        },
        prescription: rows
          .filter((r) => r.medicine.trim())
          .map((r) => ({ ...r, durationDays: r.durationDays ? Number(r.durationDays) : undefined })),
        followUpDate: followUp || undefined,
        format,
        ...(nutri
          ? { nutrition: nutrition.usualWeightKg ? { ...nutrition, usualWeightKg: String(kgOf(nutrition.usualWeightKg, initial?.nutrition?.usualWeightKg) ?? '') } : nutrition }
          : {}),
        ...(isMassage ? { massage } : {}),
        ...(isProgram && program ? { programId: program.programId, programWeek: Number(prog.week), body: prog.body } : {}),
      }
      const res = visitId ? await updateVisit(visitId, data) : await recordVisit({ appointmentId: appointmentId!, ...data })
      if (!res.ok) {
        printTab?.close()
        setError(res.message)
        return
      }
      if (printTab)
        printTab.location.href = isMassage
          ? `/print/ficha/${res.data.id}`
          : isProgram && program
            ? `/print/programa/${program.programId}`
            : `/print/prescription/${res.data.id}`
      const saved = isMassage ? 'Ficha guardada' : isProgram ? 'Control guardado' : 'Consulta guardada'
      const msg = encodeURIComponent(print ? `${saved} · imprimiendo ${isMassage ? 'ficha' : isProgram ? 'seguimiento' : 'receta'}` : saved)
      if (visitId && 'patientId' in res.data) router.push(`/dashboard/patients/${res.data.patientId}?tab=historia`)
      else router.push(`${returnHref}${returnHref.includes('?') ? '&' : '?'}ok=${msg}`)
      router.refresh()
    })
  }

  const saveLabel = visitId ? 'Guardar cambios' : isMassage ? 'Guardar ficha' : isProgram ? 'Guardar control' : 'Guardar consulta'

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-3 pb-28">
      {(allergies || background) && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-xl border border-[#e7e5e4] bg-white px-[18px] py-3.5">
          {background ? <p className="min-w-0 flex-[1_1_240px] text-[13px] leading-relaxed text-[#57534e]">{background}</p> : <span />}
          {allergies && (
            <span className="max-w-full rounded-md bg-[#b91c1c] px-2.5 py-1 text-[13px] font-semibold text-white" role="note">
              Alergias: {allergies}
            </span>
          )}
        </div>
      )}

      {offered.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[#57534e]">Ficha según la especialidad</span>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
            {offered.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={format === f}
                onClick={() => {
                  setFormat(f)
                  if (f === 'nutrition') setOpen((o) => ({ ...o, vitals: true }))
                }}
                className={`flex-none whitespace-nowrap ${chip(format === f)}`}
              >
                {FORMAT_SHORT[f]}
              </button>
            ))}
          </div>
        </div>
      )}

      {isMassage && <MassageSheet value={massage} onChange={setMassage} prefilled={!initial?.massage && Boolean(massagePrefill)} />}

      {isProgram && program && (
        <ProgramControl
          ctx={program}
          value={prog}
          onChange={setProg}
          vitals={vitals}
          setVital={(k, v) => setV(k, v)}
          notes={notes}
          setNotes={setNotes}
          editing={Boolean(visitId)}
        />
      )}

      {!isMassage && (
      <>
      {!isProgram && (
      <>
      {/* Required */}
      <section className="flex flex-col gap-3 rounded-xl border border-[#e7e5e4] bg-white px-[18px] py-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="v-motivo" className={FIELD_LABEL}>
            Motivo de consulta
          </label>
          <textarea id="v-motivo" rows={2} value={chiefComplaint} onChange={(e) => {
              setChiefComplaint(e.target.value)
              setError(null)
            }} placeholder="Fiebre de 2 días, dolor de garganta…" className={AREA} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="v-dx" className={FIELD_LABEL}>
            Diagnóstico{nutri ? ' nutricional' : ''}
          </label>
          <input id="v-dx" value={diagnosis} onChange={(e) => {
              setDiagnosis(e.target.value)
              setError(null)
            }} placeholder={nutri ? 'ej. Sobrepeso grado I' : 'ej. Faringitis viral'} className={`${INPUT} h-12`} />
        </div>
        {frequentDiagnoses.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] text-[#57534e]">Frecuentes:</span>
            {frequentDiagnoses.map((d) => (
              <button key={d} type="button" onClick={() => setDiagnosis(d)} className="min-h-9 rounded-lg bg-[#f0eeec] px-3 py-1.5 text-[13px] font-medium text-[#1c1917] hover:bg-[#e7e5e4]">
                {d}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Vitals / anthropometry */}
      <Section title={nutri ? 'Antropometría' : 'Signos vitales'} hint={bmi ? `IMC ${bmi}` : 'opcional'} open={open.vitals} onToggle={() => toggle('vitals')}>
        {nutri ? (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
              <Num label={`Peso actual (${weightUnit})`} value={vitals.weightKg} onChange={(v) => setV('weightKg', v)} ph={weightUnit === 'lb' ? '141' : '64'} />
              <Num label={`Peso habitual (${weightUnit})`} value={nutrition.usualWeightKg ?? ''} onChange={(v) => setN('usualWeightKg', v)} ph={weightUnit === 'lb' ? '145' : '66'} />
              <Num label={`Talla (${heightUnit})`} value={vitals.heightCm} onChange={(v) => setV('heightCm', v)} ph={heightUnit === 'in' ? '64' : '163'} />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#57534e]">IMC</span>
                <span className="tabular flex h-11 items-center rounded-[10px] bg-[#f0eeec] px-3 text-base font-medium text-[#44403c]">{bmi ?? '—'}</span>
              </div>
              {nutriFields('antropometria')
                .filter((f) => f.kind === 'number' && f.key !== 'usualWeightKg')
                .map((f) => (
                  <Num key={f.key} label={`${f.label}${f.unit ? ` (${f.unit})` : ''}`} value={nutrition[f.key] ?? ''} onChange={(v) => setN(f.key, v)} />
                ))}
            </div>
            {ratio != null && <p className="tabular text-[13px] font-medium text-[#57534e]">Relación cintura/cadera {ratio}</p>}
            <label className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL}>Meta</span>
              <input value={nutrition.goal ?? ''} onChange={(e) => setN('goal', e.target.value)} placeholder="ej. Bajar a 60 kg en 4 meses" className={`${INPUT} h-11`} />
            </label>
            <span className="mt-1 text-[13px] font-semibold text-[#44403c]">Signos vitales</span>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
              {VITALS.filter((v) => v.key !== 'weightKg' && v.key !== 'heightCm').map((v) => (
                <Num key={v.key} label={v.label} value={vitals[v.key]} onChange={(x) => setV(v.key, x)} ph={v.ph} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
              {VITALS.map((v) => (
                <Num
                  key={v.key}
                  label={v.key === 'weightKg' ? `Peso (${weightUnit})` : v.key === 'heightCm' ? `Talla (${heightUnit})` : v.label}
                  value={vitals[v.key]}
                  onChange={(x) => setV(v.key, x)}
                  ph={v.key === 'weightKg' && weightUnit === 'lb' ? '154' : v.key === 'heightCm' && heightUnit === 'in' ? '65' : v.ph}
                />
              ))}
            </div>
            {(kgOf(vitals.weightKg) || bmi) && (
              <p className="tabular text-[13px] font-medium text-[#57534e]">
                {kgOf(vitals.weightKg) ? weightLabel(kgOf(vitals.weightKg), weightUnit) : ''}
                {kgOf(vitals.weightKg) && bmi ? ' · ' : ''}
                {bmi ? `IMC ${bmi}` : ''}
              </p>
            )}
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
                  <div key={f.key} className="flex min-h-11 flex-wrap items-center gap-2">
                    <span className="min-w-[160px] flex-1 text-sm">{label}</span>
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
                        className={chip(nutrition[f.key] === v)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                )
              })}
            <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3">
              <Num label="Sueño (h/día)" value={nutrition.sleepHours ?? ''} onChange={(v) => setN('sleepHours', v)} ph="7" />
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-medium text-[#57534e]">Calidad del sueño</span>
                <input value={nutrition.sleepQuality ?? ''} onChange={(e) => setN('sleepQuality', e.target.value)} className={`${INPUT} h-11`} />
              </label>
            </div>
          </>
        )}
        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Historia de la enfermedad actual</span>
          <textarea
            rows={2}
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder={nutri ? 'APP, APF, otros hallazgos…' : 'Historia de la enfermedad actual, APP, APF, hábitos…'}
            className={AREA}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Examen físico</span>
          <textarea rows={2} value={physicalExam} onChange={(e) => setPhysicalExam(e.target.value)} placeholder="Examen físico…" className={AREA} />
        </label>
      </Section>

      </>
      )}

      {/* Prescription */}
      <Section title="Receta" hint={`${rxCount} medicamento${rxCount === 1 ? '' : 's'}`} open={open.rx} onToggle={() => toggle('rx')}>
        {rows.map((r, i) => (
          <div key={i} className="flex flex-col gap-2.5 rounded-[10px] border border-[#f0eeec] bg-[#fafaf7] p-3">
            <div className="flex gap-2">
              <input
                value={r.medicine}
                onChange={(e) => setRow(i, { medicine: e.target.value })}
                placeholder="Medicamento y dosis (Amoxicilina 500 mg)"
                aria-label="Medicamento y dosis"
                className={`${INPUT} h-11 font-medium`}
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  aria-label="Quitar medicamento"
                  className="h-11 shrink-0 rounded-[10px] border border-[#d6d3d1] bg-white px-3 text-sm font-medium text-[#1c1917] hover:border-[#1c1917]"
                >
                  Quitar
                </button>
              )}
            </div>
            {r.dosage ? <span className="text-[13px] text-[#57534e]">Dosis registrada: {r.dosage}</span> : null}
            <div className="flex flex-wrap gap-1.5">
              {FREQ_CHIPS.map((c) => {
                const on = r.frequency === c.value && (c.value !== 'other' || r.frequencyNote === c.note)
                return (
                  <button
                    key={c.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setRow(i, on ? { frequency: '', frequencyNote: '' } : { frequency: c.value, frequencyNote: c.note ?? '' })}
                    className={chip(on)}
                  >
                    {c.label}
                  </button>
                )
              })}
              {r.frequency === 'other' && !FREQ_CHIPS.some((c) => c.note === r.frequencyNote) && (
                <span className={chip(true)}>{r.frequencyNote || 'Otra'}</span>
              )}
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
              <input
                inputMode="numeric"
                value={r.durationDays ?? ''}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, '')
                  setRow(i, { durationDays: d === '' ? undefined : Number(d) })
                }}
                placeholder="Días"
                aria-label="Días"
                className={`${INPUT} tabular h-11`}
              />
              <input
                value={r.instructions ?? ''}
                onChange={(e) => setRow(i, { instructions: e.target.value })}
                placeholder="Indicaciones (después de comer)"
                aria-label="Indicaciones"
                className={`${INPUT} h-11`}
              />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setRows((r) => [...r, blankRow()])} className="self-start py-2 text-sm font-medium text-[#0f766e] hover:text-[#115e59]">
          Agregar medicamento
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
            <span className="mt-1 text-[13px] font-semibold text-[#44403c]">Resultados</span>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
              {nutriFields('laboratorio')
                .filter((f) => f.kind === 'number')
                .map((f) => (
                  <Num key={f.key} label={`${f.label}${f.unit ? ` (${f.unit})` : ''}`} value={nutrition[f.key] ?? ''} onChange={(v) => setN(f.key, v)} />
                ))}
            </div>
            {nutriFields('laboratorio')
              .filter((f) => f.kind !== 'number')
              .map((f) => (
                <label key={f.key} className="flex flex-col gap-1.5">
                  <span className={FIELD_LABEL}>{f.label}</span>
                  <textarea rows={1} value={nutrition[f.key] ?? ''} onChange={(e) => setN(f.key, e.target.value)} className={AREA} />
                </label>
              ))}
          </>
        )}
      </Section>

      {/* Treatment & follow-up */}
      <Section title="Tratamiento y seguimiento" hint={followLabel ? `control en ${followLabel}` : 'sin cita de control'} open={open.follow} onToggle={() => toggle('follow')}>
        <div className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Próximo control</span>
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
              className="tabular h-10 rounded-[10px] border border-[#d6d3d1] bg-white px-3 text-sm text-[#1c1917]"
            />
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Plan y tratamiento</span>
          <textarea
            rows={2}
            value={treatmentPlan}
            onChange={(e) => setTreatmentPlan(e.target.value)}
            placeholder="Plan / tratamiento no farmacológico… (se imprime en la receta)"
            className={AREA}
          />
        </label>
        {nutri && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {nutriFields('seguimiento').map((f) => (
              <label key={f.key} className="flex min-w-0 flex-col gap-1.5">
                <span className={FIELD_LABEL}>{f.label}</span>
                <input value={nutrition[f.key] ?? ''} onChange={(e) => setN(f.key, e.target.value)} placeholder={f.placeholder} className={`${INPUT} h-11`} />
              </label>
            ))}
          </div>
        )}
        {!isProgram && (
          <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>Nota personal</span>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="No se imprime ni la ve el paciente" className={AREA} />
          </label>
        )}
      </Section>
      </>
      )}

      {error && (
        <p className="rounded-[10px] border border-[#b45309] bg-white px-3.5 py-2.5 text-sm text-[#b45309]" role="alert">
          {error}
        </p>
      )}

      {/* Sticky save bar — above the phone tab bar, right of the desktop menu */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 border-t border-[#e7e5e4] bg-[rgba(250,250,247,.94)] px-4 py-2.5 backdrop-blur-md md:px-5 lg:bottom-0 lg:left-[232px]">
        <div className="mx-auto flex w-full max-w-[860px] items-center justify-between gap-2">
          <span className={`hidden min-w-0 truncate text-[13px] sm:block ${error ? 'text-[#b45309]' : 'text-[#57534e]'}`}>
            {error ?? (isMassage || isProgram ? 'Revise los datos antes de guardar.' : 'Solo motivo y diagnóstico son obligatorios.')}
          </span>
          <div className="flex flex-1 gap-2 sm:flex-none">
            <button
              type="button"
              disabled={pending}
              onClick={() => save(true)}
              className="h-11 rounded-[10px] border border-[#d6d3d1] bg-white px-4 text-[15px] font-medium whitespace-nowrap text-[#1c1917] transition-colors hover:border-[#1c1917] disabled:opacity-60"
            >
              Guardar e imprimir
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => save(false)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#0f766e] px-[18px] text-[15px] font-medium whitespace-nowrap text-white transition-colors hover:bg-[#115e59] disabled:opacity-60 sm:flex-none"
            >
              {pending && <Spinner />}
              {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
