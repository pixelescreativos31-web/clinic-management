'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary, inputClass, textareaClass, Card, Field, Avatar, Spinner, AllergyBanner } from './primitives'
import { AppSelect } from './AppSelect'
import { DatePicker } from './DatePicker'
import { IconPlus, IconX, IconStethoscope } from './icons'
import { PRESCRIPTION_FREQUENCIES } from '@/lib/constants'
import {
  recordVisit,
  updateVisit,
  type PrescriptionRowInput,
  type VisitInput,
} from '@/app/(frontend)/dashboard/visits/actions'

const FREQ_OPTIONS = PRESCRIPTION_FREQUENCIES.map((f) => ({ value: f.value, label: f.label }))
const blankRow = (): PrescriptionRowInput => ({
  medicine: '',
  dosage: '',
  frequency: '',
  durationDays: undefined,
  quantity: '',
  instructions: '',
})

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
}

type VitalKey =
  | 'bpSystolic'
  | 'bpDiastolic'
  | 'pulse'
  | 'respiratoryRate'
  | 'temperatureC'
  | 'oxygenSaturation'
  | 'weightKg'
  | 'heightCm'
  | 'glucoseMgDl'

const VITALS: { key: VitalKey; label: string; placeholder: string; decimal?: boolean }[] = [
  { key: 'bpSystolic', label: 'PA sistólica', placeholder: '120' },
  { key: 'bpDiastolic', label: 'PA diastólica', placeholder: '80' },
  { key: 'pulse', label: 'FC (lpm)', placeholder: '72' },
  { key: 'respiratoryRate', label: 'FR (rpm)', placeholder: '16' },
  { key: 'temperatureC', label: 'Temp. (°C)', placeholder: '36.8', decimal: true },
  { key: 'oxygenSaturation', label: 'SatO₂ (%)', placeholder: '98' },
  { key: 'weightKg', label: 'Peso (kg)', placeholder: '70', decimal: true },
  { key: 'heightCm', label: 'Talla (cm)', placeholder: '165' },
  { key: 'glucoseMgDl', label: 'Glucemia (mg/dL)', placeholder: '95' },
]

const EMPTY_VITALS = Object.fromEntries(VITALS.map((v) => [v.key, ''])) as Record<VitalKey, string>

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-6 py-5 last:border-0">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="flex size-5 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">{n}</span>
        <h2 className="text-[13px] font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function bmi(weightKg: string, heightCm: string): string | null {
  const w = Number(weightKg)
  const h = Number(heightCm) / 100
  if (!w || !h) return null
  const v = w / (h * h)
  if (!Number.isFinite(v) || v < 5 || v > 100) return null
  const band = v < 18.5 ? 'bajo peso' : v < 25 ? 'normal' : v < 30 ? 'sobrepeso' : 'obesidad'
  return `IMC ${v.toFixed(1)} · ${band}`
}

export function VisitForm({
  appointmentId,
  visitId,
  patientName,
  doctorName,
  allergies,
  background,
  initial,
}: {
  /** New consultation for this appointment… */
  appointmentId?: string
  /** …or edit this recorded consultation. */
  visitId?: string
  patientName: string
  doctorName: string
  allergies?: string | null
  /** Short clinical background shown while consulting (chronic conditions, meds). */
  background?: string | null
  initial?: VisitInitial
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [vitals, setVitals] = useState<Record<VitalKey, string>>(initial?.vitals ?? EMPTY_VITALS)
  const [chiefComplaint, setChiefComplaint] = useState(initial?.chiefComplaint ?? '')
  const [symptoms, setSymptoms] = useState(initial?.symptoms ?? '')
  const [physicalExam, setPhysicalExam] = useState(initial?.physicalExam ?? '')
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis ?? '')
  const [treatmentPlan, setTreatmentPlan] = useState(initial?.treatmentPlan ?? '')
  const [labOrders, setLabOrders] = useState(initial?.labOrders ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [followUp, setFollowUp] = useState(initial?.followUpDate ?? '')
  const [rows, setRows] = useState<PrescriptionRowInput[]>(
    initial?.prescription.length ? initial.prescription : [blankRow()],
  )

  const setRow = (i: number, patch: Partial<PrescriptionRowInput>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  const addRow = () => setRows((r) => [...r, blankRow()])
  const removeRow = (i: number) => setRows((r) => (r.length === 1 ? [blankRow()] : r.filter((_, idx) => idx !== i)))

  const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')))
  const bmiText = bmi(vitals.weightKg, vitals.heightCm)

  const submit = () => {
    setError(null)
    start(async () => {
      const data: Omit<VisitInput, 'appointmentId'> = {
        chiefComplaint,
        symptoms,
        physicalExam,
        diagnosis,
        treatmentPlan,
        labOrders,
        notes,
        vitals: Object.fromEntries(VITALS.map((v) => [v.key, num(vitals[v.key])])),
        prescription: rows
          .filter((r) => r.medicine.trim())
          .map((r) => ({ ...r, durationDays: r.durationDays ? Number(r.durationDays) : undefined })),
        followUpDate: followUp || undefined,
      }
      if (visitId) {
        const res = await updateVisit(visitId, data)
        if (res.ok) {
          router.push(`/dashboard/patients/${res.data.patientId}?tab=historia`)
          router.refresh()
        } else setError(res.message)
        return
      }
      const res = await recordVisit({ appointmentId: appointmentId!, ...data })
      // The server route re-renders into the "Consulta registrada → siguientes pasos" panel.
      if (res.ok) router.refresh()
      else setError(res.message)
    })
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-secondary/30 px-6 py-4">
        <Avatar name={patientName} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{patientName}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconStethoscope size={13} className="text-faint" />
            {doctorName}
          </div>
        </div>
      </div>
      {(allergies || background) && (
        <div className="flex flex-col gap-2 border-b border-border px-6 py-3">
          {allergies && <AllergyBanner allergies={allergies} />}
          {background && <p className="text-xs leading-relaxed text-muted-foreground">{background}</p>}
        </div>
      )}

      <Section n={1} title="Motivo de consulta e historia">
        <div className="flex flex-col gap-4">
          <Field label="Motivo de consulta">
            <input className={inputClass} value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} placeholder="p. ej. Fiebre de 3 días" />
          </Field>
          <Field label="Historia de la enfermedad actual">
            <textarea className={textareaClass} rows={3} value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="Inicio, evolución, síntomas asociados…" />
          </Field>
        </div>
      </Section>

      <Section n={2} title="Signos vitales">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {VITALS.map((v) => (
            <Field key={v.key} label={v.label}>
              <input
                className={inputClass}
                inputMode={v.decimal ? 'decimal' : 'numeric'}
                value={vitals[v.key]}
                onChange={(e) => setVitals((s) => ({ ...s, [v.key]: e.target.value }))}
                placeholder={v.placeholder}
              />
            </Field>
          ))}
        </div>
        {bmiText && <p className="tabular mt-2.5 text-xs font-medium text-muted-foreground">{bmiText}</p>}
      </Section>

      <Section n={3} title="Examen físico y diagnóstico">
        <div className="flex flex-col gap-4">
          <Field label="Examen físico">
            <textarea className={textareaClass} rows={3} value={physicalExam} onChange={(e) => setPhysicalExam(e.target.value)} placeholder="Hallazgos por sistemas…" />
          </Field>
          <Field label="Diagnóstico">
            <input className={inputClass} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="p. ej. Faringitis aguda" />
          </Field>
        </div>
      </Section>

      <Section n={4} title="Receta">
        <div className="flex flex-col gap-2.5">
          {rows.map((row, i) => (
            <div key={i} className="rounded-lg border border-border bg-canvas/40 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_0.8fr_1.2fr]">
                <input className={inputClass} placeholder="Medicamento" value={row.medicine} onChange={(e) => setRow(i, { medicine: e.target.value })} />
                <input className={inputClass} placeholder="Dosis (500 mg)" value={row.dosage} onChange={(e) => setRow(i, { dosage: e.target.value })} />
                <AppSelect value={row.frequency ?? ''} onChange={(v) => setRow(i, { frequency: v })} placeholder="Frecuencia" options={FREQ_OPTIONS} />
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[0.6fr_0.9fr_1.5fr_auto]">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  placeholder="Días"
                  value={row.durationDays ?? ''}
                  onChange={(e) => setRow(i, { durationDays: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
                <input className={inputClass} placeholder="Cantidad (1 caja)" value={row.quantity ?? ''} onChange={(e) => setRow(i, { quantity: e.target.value })} />
                <input className={inputClass} placeholder="Indicaciones (después de comer)" value={row.instructions} onChange={(e) => setRow(i, { instructions: e.target.value })} />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="flex h-10 items-center justify-center rounded-md border border-border px-3 text-muted-foreground transition-colors hover:border-red/40 hover:text-red"
                  title="Quitar"
                  aria-label="Quitar medicamento"
                >
                  <IconX size={15} />
                </button>
              </div>
              {row.frequency === 'other' && (
                <input className={`${inputClass} mt-2`} placeholder="Describa la frecuencia" value={row.frequencyNote ?? ''} onChange={(e) => setRow(i, { frequencyNote: e.target.value })} />
              )}
            </div>
          ))}
          <button type="button" onClick={addRow} className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-primary hover:underline">
            <IconPlus size={14} /> Agregar medicamento
          </button>
        </div>
      </Section>

      <Section n={5} title="Plan, estudios y seguimiento">
        <div className="flex flex-col gap-4">
          <Field label="Plan e indicaciones generales" hint="Se imprime en la receta.">
            <textarea className={textareaClass} rows={2} value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)} placeholder="Reposo, dieta, signos de alarma…" />
          </Field>
          <Field label="Estudios indicados" hint="Laboratorios o imágenes. Se imprime en la receta.">
            <textarea className={textareaClass} rows={2} value={labOrders} onChange={(e) => setLabOrders(e.target.value)} placeholder="Hemograma, glucosa en ayunas…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,240px)_1fr]">
            <Field label="Próxima cita (opcional)">
              <DatePicker value={followUp} onChange={setFollowUp} />
            </Field>
            <Field label="Notas privadas" hint="No se imprimen; solo personal clínico.">
              <textarea className={textareaClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </div>
      </Section>

      <div className="flex items-center justify-between gap-3 bg-canvas/60 px-6 py-4">
        {error ? <p className="text-sm text-red" role="alert">{error}</p> : <span />}
        <button type="button" className={btnPrimary} disabled={pending} onClick={submit}>
          {pending && <Spinner />}
          {pending ? 'Guardando…' : visitId ? 'Guardar cambios' : 'Guardar consulta'}
        </button>
      </div>
    </Card>
  )
}
