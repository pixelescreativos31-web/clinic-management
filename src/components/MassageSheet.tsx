'use client'

// Massage session sheet (format «Ficha de masajes»). Rendered inside VisitForm in
// place of the medical sections. Health questions are pre-filled from the client's
// previous sheet — the paper form says it must be reviewed before every session,
// so the therapist confirms or corrects rather than re-typing.

import { useState } from 'react'
import { CONSENT_TEXT, MASSAGE_FIELDS, MASSAGE_GROUP_LABELS, YES_NO_OPTIONS, type MassageFieldDef, type MassageFormState, type MassageGroup } from '@/lib/massage'

// Same look as VisitForm (design_handoff_medira «Consulta»).
const INPUT = 'w-full min-w-0 rounded-[10px] border border-[#d6d3d1] bg-white px-3 text-base text-[#1c1917] outline-none focus:border-[#0f766e]'
const AREA = `${INPUT} resize-y py-2.5 leading-normal`
const FIELD_LABEL = 'text-[13px] font-medium text-[#44403c]'
const chip = (on: boolean) =>
  `min-h-10 rounded-[10px] border px-3.5 py-2 text-sm font-medium transition-colors ${
    on ? 'border-[#1c1917] bg-[#1c1917] text-white' : 'border-[#d6d3d1] bg-white text-[#1c1917] hover:border-[#1c1917]'
  }`

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

const GROUPS: MassageGroup[] = ['salud', 'lesiones', 'alergias', 'evaluacion']

export function MassageSheet({
  value,
  onChange,
  prefilled,
}: {
  value: MassageFormState
  onChange: (next: MassageFormState) => void
  /** True when the health answers came from the client's previous sheet. */
  prefilled?: boolean
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({ salud: true, lesiones: false, alergias: false, evaluacion: true })
  const set = (key: string, v: string | string[]) => onChange({ ...value, [key]: v })
  const str = (key: string) => (typeof value[key] === 'string' ? (value[key] as string) : '')
  const list = (key: string) => (Array.isArray(value[key]) ? (value[key] as string[]) : [])
  const fields = (g: MassageGroup) => MASSAGE_FIELDS.filter((f) => f.group === g)
  const yesCount = (g: MassageGroup) => fields(g).filter((f) => f.kind === 'yesno' && str(f.key) === 'yes').length

  const renderField = (f: MassageFieldDef) => {
    if (f.kind === 'multi') {
      return (
        <div key={f.key} className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>{f.label}</span>
          <div className="flex flex-wrap gap-1.5">
            {f.options!.map((o) => {
              const on = list(f.key).includes(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set(f.key, on ? list(f.key).filter((x) => x !== o.value) : [...list(f.key), o.value])}
                  className={chip(on)}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>
      )
    }
    if (f.kind === 'yesno' || f.kind === 'select') {
      const opts = f.kind === 'yesno' ? YES_NO_OPTIONS : f.options!
      const yes = f.kind === 'yesno' && str(f.key) === 'yes'
      return (
        <div key={f.key} className="flex flex-col gap-1.5">
          <div className="flex min-h-11 flex-wrap items-center gap-2">
            <span className="min-w-[180px] flex-1 text-sm">{f.label}</span>
            <div className="flex gap-1.5">
              {opts.map((o) => {
                const on = str(f.key) === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${f.label}: ${o.label}`}
                    onClick={() => set(f.key, on ? '' : o.value)}
                    // Red is reserved for allergies (design rule); other answers use ink.
                    className={on && o.value === 'yes' && f.group === 'alergias' ? 'min-h-10 rounded-[10px] border border-[#b91c1c] bg-[#b91c1c] px-3.5 py-2 text-sm font-medium text-white' : chip(on)}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          </div>
          {f.detail && (yes || str(`${f.key}Detail`)) && (
            <input
              value={str(`${f.key}Detail`)}
              onChange={(e) => set(`${f.key}Detail`, e.target.value)}
              placeholder={f.detail}
              aria-label={`${f.label} — ${f.detail}`}
              className={`${INPUT} h-11`}
            />
          )}
        </div>
      )
    }
    if (f.kind === 'check') {
      return (
        <label key={f.key} className="flex min-h-11 items-center gap-2.5 text-sm font-medium">
          <input type="checkbox" checked={str(f.key) === 'yes'} onChange={(e) => set(f.key, e.target.checked ? 'yes' : '')} className="size-5 accent-[#0f766e]" />
          {f.label}
        </label>
      )
    }
    if (f.kind === 'long') {
      return (
        <label key={f.key} className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>{f.label}</span>
          <textarea rows={2} value={str(f.key)} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} className={AREA} />
        </label>
      )
    }
    return (
      <label key={f.key} className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>{f.label}</span>
        <input
          type={f.kind === 'date' ? 'date' : 'text'}
          inputMode={f.kind === 'number' ? 'numeric' : undefined}
          value={str(f.key)}
          onChange={(e) => set(f.key, e.target.value)}
          placeholder={f.placeholder}
          className={`${INPUT} h-11`}
        />
      </label>
    )
  }

  return (
    <>
      {/* Service — always open, it's the session's headline */}
      <section className="flex flex-col gap-3 rounded-xl border border-[#e7e5e4] bg-white px-[18px] py-4">
        <h3 className="text-[15px] font-semibold">{MASSAGE_GROUP_LABELS.servicio}</h3>
        {fields('servicio').map(renderField)}
      </section>

      {prefilled && (
        <p className="rounded-[10px] border border-[#e7e5e4] bg-[#f0eeec] px-3.5 py-2.5 text-[13px] text-[#44403c]">
          Los antecedentes y alergias vienen de la ficha anterior. Confírmelos con el cliente antes de la sesión.
        </p>
      )}

      {GROUPS.map((g) => {
        const n = yesCount(g)
        return (
          <Section
            key={g}
            title={MASSAGE_GROUP_LABELS[g]}
            hint={g === 'evaluacion' ? 'presión · precauciones · notas' : n ? `${n} con «Sí»` : 'sin hallazgos'}
            open={open[g]}
            onToggle={() => setOpen((o) => ({ ...o, [g]: !o[g] }))}
          >
            {fields(g).map(renderField)}
          </Section>
        )
      })}

      <section className="flex flex-col gap-3 rounded-xl border border-[#e7e5e4] bg-white px-[18px] py-4">
        <h3 className="text-[15px] font-semibold">{MASSAGE_GROUP_LABELS.consentimiento}</h3>
        <p className="max-h-32 overflow-y-auto rounded-[10px] bg-[#fafaf7] p-3 text-[13px] leading-relaxed text-[#44403c]">{CONSENT_TEXT}</p>
        {fields('consentimiento').map(renderField)}
        <p className="text-[13px] text-[#57534e]">Use «Guardar e imprimir» para imprimir la ficha con las líneas de firma.</p>
      </section>
    </>
  )
}
