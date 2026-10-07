'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary, inputClass, textareaClass, Card, Field, Spinner } from './primitives'
import { AppSelect } from './AppSelect'
import {
  createPatient,
  updatePatient,
  findByPhone,
  type PatientHit,
  type PatientInput,
} from '@/app/(frontend)/dashboard/patients/actions'
import { BLOOD_GROUPS, DOCUMENT_TYPES, GENDERS, GENDER_LABELS } from '@/lib/constants'
import { ageFromDOB } from '@/lib/format'
import { EMPTY_PATIENT, type PatientInitial } from '@/lib/patientForm'

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-6 py-5 last:border-0">
      <div className="mb-3.5">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/** "001-1234567-8" as the user types (cédula only). */
function formatCedula(raw: string): string {
  const d = raw.replace(/[^0-9]/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}`
}

export function PatientForm({
  patientId,
  initial,
  clinical = true,
}: {
  /** When set, the form edits this patient instead of creating one. */
  patientId?: string
  initial?: PatientInitial
  /** Clinical roles see and edit the medical background ("antecedentes"). */
  clinical?: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [dupes, setDupes] = useState<PatientHit[]>([])
  const [form, setForm] = useState<PatientInitial>(initial ?? EMPTY_PATIENT)
  const isEdit = Boolean(patientId)

  const set = (k: keyof PatientInitial, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const text = (k: keyof PatientInitial) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value),
  })

  const checkPhone = (phone: string) => {
    set('phone', phone)
    if (phone.trim().length < 5) return setDupes([])
    start(async () => {
      const hits = await findByPhone(phone)
      setDupes(hits.filter((h) => h.id !== patientId))
    })
  }

  const derivedAge = form.dateOfBirth ? ageFromDOB(form.dateOfBirth) : null
  const canSave = Boolean(form.name.trim() && form.phone.trim() && (form.dateOfBirth || form.ageYears))

  const submit = () => {
    setError(null)
    start(async () => {
      const input: PatientInput = {
        name: form.name.trim(),
        phone: form.phone,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth || undefined,
        // DOB wins; age is the fallback when only the age is known.
        ageYears: form.dateOfBirth ? undefined : form.ageYears ? Number(form.ageYears) : undefined,
        bloodGroup: form.bloodGroup || undefined,
        allergies: form.allergies || undefined,
        notes: form.notes || undefined,
        documentType: form.documentType,
        documentNumber: form.documentNumber || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        occupation: form.occupation || undefined,
        insurance: { provider: form.insuranceProvider, affiliateNumber: form.insuranceAffiliate, plan: form.insurancePlan },
        emergencyContact: { name: form.emergencyName, relationship: form.emergencyRelationship, phone: form.emergencyPhone },
        ...(clinical
          ? {
              history: {
                personal: form.hxPersonal,
                chronicConditions: form.hxChronic,
                surgical: form.hxSurgical,
                family: form.hxFamily,
                medications: form.hxMedications,
                habits: form.hxHabits,
                gynecoObstetric: form.hxGyneco,
                vaccines: form.hxVaccines,
              },
            }
          : {}),
      }
      const res = patientId ? await updatePatient(patientId, input) : await createPatient(input)
      if (res.ok) {
        router.push(`/dashboard/patients/${res.data.id}`)
        router.refresh()
      } else setError(res.message)
    })
  }

  return (
    <Card className="overflow-hidden">
      <Section title="Datos personales">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nombre completo">
              <input className={inputClass} {...text('name')} autoFocus={!isEdit} placeholder="Nombre y apellidos" />
            </Field>
          </div>
          <Field label="Documento">
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <AppSelect
                value={form.documentType}
                onChange={(v) => set('documentType', v)}
                options={DOCUMENT_TYPES.map((d) => ({ value: d.value, label: d.label }))}
              />
              <input
                className={inputClass}
                value={form.documentType === 'cedula' ? formatCedula(form.documentNumber) : form.documentNumber}
                onChange={(e) => set('documentNumber', e.target.value)}
                placeholder={form.documentType === 'cedula' ? '001-1234567-8' : ''}
                inputMode={form.documentType === 'cedula' ? 'numeric' : 'text'}
              />
            </div>
          </Field>
          <Field label="Sexo">
            <AppSelect
              value={form.gender}
              onChange={(v) => set('gender', v)}
              options={GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))}
            />
          </Field>
          <Field
            label="Fecha de nacimiento"
            hint={derivedAge != null ? `${derivedAge} ${derivedAge === 1 ? 'año' : 'años'}` : 'Si no la sabe, indique la edad.'}
          >
            <input type="date" className={inputClass} {...text('dateOfBirth')} max={new Date().toISOString().slice(0, 10)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Edad (años)">
              <input
                className={inputClass}
                inputMode="numeric"
                {...text('ageYears')}
                disabled={Boolean(form.dateOfBirth)}
                placeholder={derivedAge != null ? String(derivedAge) : ''}
              />
            </Field>
            <Field label="Grupo sanguíneo">
              <AppSelect
                value={form.bloodGroup}
                onChange={(v) => set('bloodGroup', v)}
                placeholder="—"
                options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))}
              />
            </Field>
          </div>
          <Field label="Ocupación">
            <input className={inputClass} {...text('occupation')} />
          </Field>
        </div>
      </Section>

      <Section title="Contacto">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono (WhatsApp)">
            <input className={inputClass} value={form.phone} onChange={(e) => checkPhone(e.target.value)} inputMode="tel" placeholder="809-555-1234" />
          </Field>
          <Field label="Correo electrónico (opcional)">
            <input type="email" className={inputClass} {...text('email')} />
          </Field>
          {dupes.length > 0 && (
            <div className="rounded-md border border-amber/25 bg-amber-soft px-3 py-2 text-xs text-amber sm:col-span-2">
              {dupes.length === 1 ? 'Ya hay un paciente con este número: ' : `Ya hay ${dupes.length} pacientes con este número: `}
              {dupes.map((d, i) => (
                <span key={d.id}>
                  <a href={`/dashboard/patients/${d.id}`} className="font-medium underline">
                    {d.name}
                  </a>
                  {i < dupes.length - 1 ? ', ' : ''}
                </span>
              ))}
              . Las familias suelen compartir número; verifique que no sea un duplicado.
            </div>
          )}
          <div className="sm:col-span-2">
            <Field label="Dirección">
              <textarea className={textareaClass} rows={2} {...text('address')} />
            </Field>
          </div>
          <Field label="Contacto de emergencia">
            <input className={inputClass} {...text('emergencyName')} placeholder="Nombre" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Parentesco">
              <input className={inputClass} {...text('emergencyRelationship')} />
            </Field>
            <Field label="Teléfono">
              <input className={inputClass} {...text('emergencyPhone')} inputMode="tel" />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Seguro médico" hint="Opcional. Útil para facturar a la ARS.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Aseguradora (ARS)">
            <input className={inputClass} {...text('insuranceProvider')} placeholder="ARS Humano, SeNaSa…" />
          </Field>
          <Field label="N.º de afiliado">
            <input className={inputClass} {...text('insuranceAffiliate')} />
          </Field>
          <Field label="Plan">
            <input className={inputClass} {...text('insurancePlan')} />
          </Field>
        </div>
      </Section>

      <Section title="Alergias" hint="Se muestran en rojo en el expediente y al recetar.">
        <textarea className={textareaClass} rows={2} {...text('allergies')} placeholder="p. ej. Penicilina" />
      </Section>

      {clinical && (
        <Section title="Antecedentes" hint="Solo visibles para el personal clínico.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Patológicos personales">
              <textarea className={textareaClass} rows={2} {...text('hxPersonal')} />
            </Field>
            <Field label="Enfermedades crónicas">
              <textarea className={textareaClass} rows={2} {...text('hxChronic')} placeholder="HTA, diabetes, asma…" />
            </Field>
            <Field label="Quirúrgicos">
              <textarea className={textareaClass} rows={2} {...text('hxSurgical')} />
            </Field>
            <Field label="Familiares">
              <textarea className={textareaClass} rows={2} {...text('hxFamily')} />
            </Field>
            <Field label="Medicamentos actuales">
              <textarea className={textareaClass} rows={2} {...text('hxMedications')} />
            </Field>
            <Field label="Hábitos">
              <textarea className={textareaClass} rows={2} {...text('hxHabits')} placeholder="Tabaco, alcohol, actividad física" />
            </Field>
            {form.gender === 'female' && (
              <Field label="Gineco-obstétricos">
                <textarea className={textareaClass} rows={2} {...text('hxGyneco')} placeholder="G P C A, FUM, método anticonceptivo" />
              </Field>
            )}
            <Field label="Vacunas">
              <textarea className={textareaClass} rows={2} {...text('hxVaccines')} />
            </Field>
          </div>
        </Section>
      )}

      <Section title="Notas (opcional)">
        <textarea className={textareaClass} rows={2} {...text('notes')} />
      </Section>

      <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4">
        {error ? (
          <p className="text-sm text-red" role="alert">{error}</p>
        ) : (
          <span className="text-xs text-faint">
            {isEdit ? 'El número de expediente no cambia.' : 'El número de expediente se asigna automáticamente.'}
          </span>
        )}
        <button className={btnPrimary} disabled={pending || !canSave} onClick={submit}>
          {pending && <Spinner />}
          {pending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Registrar paciente'}
        </button>
      </div>
    </Card>
  )
}
