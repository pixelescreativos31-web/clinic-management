'use client'

// Massage session sheet (format «Ficha de masajes»). Rendered inside VisitForm in
// place of the medical sections. Health questions are pre-filled from the client's
// previous sheet — the paper form says it must be reviewed before every session,
// so the therapist confirms or corrects rather than re-typing.

import { useState } from 'react'
import { CONSENT_TEXT, MASSAGE_FIELDS, MASSAGE_GROUP_LABELS, YES_NO_OPTIONS, type MassageFieldDef, type MassageFormState, type MassageGroup } from '@/lib/massage'

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
          <span className="text-[12px] font-semibold text-[#6b7577]">{f.label}</span>
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
                    className={`rounded-full border px-3.5 py-[9px] text-[13px] font-semibold ${
                      on ? (o.value === 'yes' && f.group !== 'evaluacion' ? 'border-[#b3261e] bg-[#b3261e] text-white' : 'border-[#15201e] bg-[#15201e] text-white') : 'border-[#e3e7e7] bg-white'
                    }`}
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
              className={`${INPUT} h-[42px]`}
            />
          )}
        </div>
      )
    }
    if (f.kind === 'check') {
      return (
        <label key={f.key} className="flex min-h-11 items-center gap-2.5 text-sm font-semibold">
          <input type="checkbox" checked={str(f.key) === 'yes'} onChange={(e) => set(f.key, e.target.checked ? 'yes' : '')} className="size-5 accent-[#0d6e60]" />
          {f.label}
        </label>
      )
    }
    if (f.kind === 'long') {
      return (
        <label key={f.key} className="flex flex-col gap-1">
          <span className="text-[11px] text-[#6b7577]">{f.label}</span>
          <textarea rows={2} value={str(f.key)} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} className={AREA} />
        </label>
      )
    }
    return (
      <label key={f.key} className="flex flex-col gap-1">
        <span className="text-[11px] text-[#6b7577]">{f.label}</span>
        <input
          type={f.kind === 'date' ? 'date' : 'text'}
          inputMode={f.kind === 'number' ? 'numeric' : undefined}
          value={str(f.key)}
          onChange={(e) => set(f.key, e.target.value)}
          placeholder={f.placeholder}
          className={`${INPUT} h-[46px]`}
        />
      </label>
    )
  }

  return (
    <>
      {/* Service — always open, it's the session's headline */}
      <div className="flex flex-col gap-3 rounded-[14px] border border-[#e3e7e7] bg-white p-3.5">
        <span className="text-[13px] font-semibold">{MASSAGE_GROUP_LABELS.servicio}</span>
        {fields('servicio').map(renderField)}
      </div>

      {prefilled && (
        <p className="rounded-[10px] bg-[#e6f1ee] px-3 py-2 text-[13px] text-[#0d6e60]">
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

      <div className="flex flex-col gap-2.5 rounded-[14px] border border-[#e3e7e7] bg-white p-3.5">
        <span className="text-[13px] font-semibold">{MASSAGE_GROUP_LABELS.consentimiento}</span>
        <p className="max-h-32 overflow-y-auto rounded-[10px] bg-[#f4f6f6] p-3 text-xs leading-relaxed text-[#45504f]">{CONSENT_TEXT}</p>
        {fields('consentimiento').map(renderField)}
        <p className="text-[11px] text-[#6b7577]">Use «Guardar e imprimir» para imprimir la ficha con las líneas de firma.</p>
      </div>
    </>
  )
}
