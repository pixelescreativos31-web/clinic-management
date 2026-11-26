'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { inputClass, textareaClass, Spinner } from './primitives'
import { AppSelect } from './AppSelect'
import {
  createPatient,
  updatePatient,
  findByPhone,
  type PatientHit,
  type PatientInput,
} from '@/app/(frontend)/dashboard/patients/actions'
import { BLOOD_GROUPS, DOCUMENT_TYPES, GENDERS, GENDER_LABELS, MARITAL_STATUSES } from '@/lib/constants'
import { ageFromDOB } from '@/lib/format'
import { EMPTY_PATIENT, type PatientInitial } from '@/lib/patientForm'

/** Form section as its own card (design «Formulario»): 16/600 title, hint, fields. */
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[12px] border border-[#e7e5e4] bg-white px-4 pt-4 pb-5 md:px-[18px] md:pt-[18px]">
      <div className="mb-3.5">
        <h2 className="text-base font-semibold tracking-[-.01em]">{title}</h2>
        {hint && <p className="text-[13px] text-[#57534e]">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/** Label 13/500 above the control, help text 12 below. */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <span className="text-[13px] font-medium text-[#44403c]">{label}</span>
      {children}
      {hint && <span className="tabular text-xs text-[#57534e]">{hint}</span>}
    </div>
  )
}

const SELECT = 'h-11 rounded-[10px] border-[#d6d3d1] bg-white'
const INPUT = `${inputClass} border-[#d6d3d1] bg-white`
const TEXTAREA = `${textareaClass} border-[#d6d3d1] bg-white`

/** "001-1234567-8" as the user types (cédula only). */
function formatCedula(raw: string): string {
  const d = raw.replace(/[^0-9]/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}`
}

/** '' → null; otherwise a whole number 0–30 (out-of-range input is dropped). */
const countOrNull = (v: string): number | null => {
  const n = Number(v.trim())
  return v.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 30 ? n : null
}

export function PatientForm({
  patientId,
  initial,
  clinical = true,
  cancelHref,
}: {
  /** When set, the form edits this patient instead of creating one. */
  patientId?: string
  initial?: PatientInitial
  /** Clinical roles see and edit the medical background ("antecedentes"). */
  clinical?: boolean
  /** «Cancelar» goes back here (list or the patient's record). */
  cancelHref?: string
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
  const canSave = Boolean(form.name.trim() && form.phone.trim() && form.gender && (form.dateOfBirth || form.ageYears))

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
        nationality: form.nationality || undefined,
        maritalStatus: form.maritalStatus || undefined,
        religion: form.religion || undefined,
        referredBy: form.referredBy || undefined,
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
                childhood: form.hxChildhood,
                familyMother: form.hxFamilyMother,
                familyFather: form.hxFamilyFather,
                familySiblings: form.hxFamilySiblings,
                otherFindings: form.hxOther,
                obstetric: {
                  pregnancies: countOrNull(form.obE),
                  abortions: countOrNull(form.obA),
                  births: countOrNull(form.obP),
                  cesareans: countOrNull(form.obC),
                },
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
    <div className="flex flex-col gap-3">
      <Section title="Datos personales">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nombre completo">
              <input className={INPUT} {...text('name')} autoFocus={!isEdit} placeholder="Nombre y apellidos" />
            </Field>
          </div>
          <Field label="Documento">
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <AppSelect
                className={SELECT}
                value={form.documentType}
                onChange={(v) => set('documentType', v)}
                options={DOCUMENT_TYPES.map((d) => ({ value: d.value, label: d.label }))}
              />
              <input
                className={INPUT}
                value={form.documentType === 'cedula' ? formatCedula(form.documentNumber) : form.documentNumber}
                onChange={(e) => set('documentNumber', e.target.value)}
                placeholder={form.documentType === 'cedula' ? '001-1234567-8' : ''}
                inputMode={form.documentType === 'cedula' ? 'numeric' : 'text'}
              />
            </div>
          </Field>
          <Field label="Sexo">
            <AppSelect
                className={SELECT}
              value={form.gender}
              onChange={(v) => set('gender', v)}
              placeholder="Elija…"
              options={GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))}
            />
          </Field>
          <Field
            label="Fecha de nacimiento"
            hint={derivedAge != null ? `${derivedAge} ${derivedAge === 1 ? 'año' : 'años'}` : 'Si no la sabe, indique la edad.'}
          >
            <input type="date" className={INPUT} {...text('dateOfBirth')} max={new Date().toISOString().slice(0, 10)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Edad (años)">
              <input
                className={INPUT}
                inputMode="numeric"
                {...text('ageYears')}
                disabled={Boolean(form.dateOfBirth)}
                placeholder={derivedAge != null ? String(derivedAge) : ''}
              />
            </Field>
            <Field label="Grupo sanguíneo">
              <AppSelect
                className={SELECT}
                value={form.bloodGroup}
                onChange={(v) => set('bloodGroup', v)}
                placeholder="—"
                options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ocupación">
              <input className={INPUT} {...text('occupation')} />
            </Field>
            <Field label="Nacionalidad">
              <input className={INPUT} {...text('nationality')} placeholder="Dominicana" />
            </Field>
            <Field label="Estado civil">
              <AppSelect
                className={SELECT}
                value={form.maritalStatus}
                onChange={(v) => set('maritalStatus', v)}
                placeholder="—"
                options={MARITAL_STATUSES.map((m) => ({ value: m.value, label: m.label }))}
              />
            </Field>
            <Field label="Religión">
              <input className={INPUT} {...text('religion')} />
            </Field>
          </div>
          <Field label="Referido por">
            <input className={INPUT} {...text('referredBy')} placeholder="p. ej. Dr. Pérez, Instagram, una paciente" />
          </Field>
        </div>
      </Section>

      <Section title="Contacto">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono (WhatsApp)">
            <input className={INPUT} value={form.phone} onChange={(e) => checkPhone(e.target.value)} inputMode="tel" placeholder="809-555-1234" />
          </Field>
          <Field label="Correo electrónico (opcional)">
            <input type="email" className={INPUT} {...text('email')} />
          </Field>
          {dupes.length > 0 && (
            <div className="rounded-[10px] border border-[#b45309] bg-white px-3 py-2.5 text-[13px] text-[#b45309] sm:col-span-2">
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
              <textarea className={TEXTAREA} rows={2} {...text('address')} />
            </Field>
          </div>
          <Field label="Contacto de emergencia">
            <input className={INPUT} {...text('emergencyName')} placeholder="Nombre" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Parentesco">
              <input className={INPUT} {...text('emergencyRelationship')} />
            </Field>
            <Field label="Teléfono">
              <input className={INPUT} {...text('emergencyPhone')} inputMode="tel" />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Seguro médico" hint="Opcional. Útil para facturar a la ARS.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Aseguradora (ARS)">
            <input className={INPUT} {...text('insuranceProvider')} placeholder="ARS Humano, SeNaSa…" />
          </Field>
          <Field label="N.º de afiliado">
            <input className={INPUT} {...text('insuranceAffiliate')} />
          </Field>
          <Field label="Plan">
            <input className={INPUT} {...text('insurancePlan')} />
          </Field>
        </div>
      </Section>

      <Section title="Alergias" hint="Se muestran en rojo en el expediente y al recetar.">
        <textarea
          className={`${textareaClass} border-[#b91c1c] bg-white`}
          rows={2}
          {...text('allergies')}
          placeholder="p. ej. Penicilina"
          aria-label="Alergias"
        />
      </Section>

      {clinical && (
        <Section title="Antecedentes" hint="Solo visibles para el personal clínico.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Patologías de la niñez">
              <textarea className={TEXTAREA} rows={2} {...text('hxChildhood')} />
            </Field>
            <Field label="Patologías de la adultez">
              <textarea className={TEXTAREA} rows={2} {...text('hxPersonal')} />
            </Field>
            <Field label="Enfermedades crónicas">
              <textarea className={TEXTAREA} rows={2} {...text('hxChronic')} placeholder="HTA, diabetes, asma…" />
            </Field>
            <Field label="Quirúrgicos">
              <textarea className={TEXTAREA} rows={2} {...text('hxSurgical')} />
            </Field>
            <Field label="Familiares — Madre">
              <textarea className={TEXTAREA} rows={2} {...text('hxFamilyMother')} />
            </Field>
            <Field label="Familiares — Padre">
              <textarea className={TEXTAREA} rows={2} {...text('hxFamilyFather')} />
            </Field>
            <Field label="Familiares — Hermanos">
              <textarea className={TEXTAREA} rows={2} {...text('hxFamilySiblings')} />
            </Field>
            <Field label="Familiares — Otros">
              <textarea className={TEXTAREA} rows={2} {...text('hxFamily')} />
            </Field>
            <Field label="Medicamentos actuales">
              <textarea className={TEXTAREA} rows={2} {...text('hxMedications')} />
            </Field>
            <Field label="Hábitos">
              <textarea className={TEXTAREA} rows={2} {...text('hxHabits')} placeholder="Tabaco, alcohol, actividad física" />
            </Field>
            {form.gender === 'female' && (
              <>
                <Field label="E · A · P · C" hint="Embarazos, abortos, partos y cesáreas.">
                  <div className="grid grid-cols-4 gap-2">
                    {(['obE', 'obA', 'obP', 'obC'] as const).map((k, i) => (
                      <label key={k} className="flex flex-col items-center gap-1">
                        <span className="text-[13px] font-medium text-[#44403c]">{'EAPC'[i]}</span>
                        <input className={`${INPUT} tabular text-center`} inputMode="numeric" maxLength={2} {...text(k)} />
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Gineco-obstétricos (otros)">
                  <textarea className={TEXTAREA} rows={2} {...text('hxGyneco')} placeholder="FUM, método anticonceptivo…" />
                </Field>
              </>
            )}
            <Field label="Vacunas">
              <textarea className={TEXTAREA} rows={2} {...text('hxVaccines')} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Otros antecedentes y hallazgos actuales">
                <textarea className={TEXTAREA} rows={4} {...text('hxOther')} />
              </Field>
            </div>
          </div>
        </Section>
      )}

      <Section title="Notas (opcional)">
        <textarea className={TEXTAREA} rows={2} {...text('notes')} aria-label="Notas" />
      </Section>

      {/* Action bar: fixed above the phone tab bar (the dashboard <main> clips
          overflow, so position: sticky would not stick), inline on desktop. */}
      <div className="h-14 lg:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 border-t border-[#e7e5e4] bg-[rgba(250,250,247,.96)] px-4 py-3 backdrop-blur-md md:px-5 lg:static lg:border-0 lg:bg-transparent lg:px-0 lg:py-1 lg:backdrop-blur-none">
        {error ? (
          <p className="mb-2 text-[13px] text-[#b45309]" role="alert">
            {error}
          </p>
        ) : (
          <p className="mb-2 hidden text-[13px] text-[#57534e] lg:block">
            {isEdit ? 'El número de expediente no cambia.' : 'El número de expediente se asigna automáticamente.'}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#0f766e] px-[18px] text-[15px] font-medium text-white transition-colors hover:bg-[#115e59] disabled:bg-[#a8a29e] lg:flex-none"
            disabled={pending || !canSave}
            onClick={submit}
          >
            {pending && <Spinner />}
            {pending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Registrar paciente'}
          </button>
          {cancelHref && (
            <Link
              href={cancelHref}
              className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[#d6d3d1] bg-white px-[18px] text-[15px] font-medium text-[#1c1917] transition-colors hover:bg-[#fafaf7] hover:text-[#1c1917]"
            >
              Cancelar
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
