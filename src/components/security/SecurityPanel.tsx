'use client'

// Mi seguridad (spec §10 «Pantallas de seguridad»): two-step verification, backup
// codes and password. The Titular also gets «Seguridad de la clínica».

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  changePasswordAction,
  disableTwoFactorAction,
  regenerateBackupCodesAction,
  resetMemberTwoFactorAction,
  setRequireAllAction,
} from '@/app/(frontend)/dashboard/security/actions'
import { Field, Spinner, btnGhost, btnPrimary, inputClass } from '@/components/primitives'
import { BackupCodesSheet, CARD, NOTE_ERR, TwoFactorSetup } from './TwoFactorSetup'
import { ROLE_LABELS, type Role } from '@/lib/constants'

export type SecurityMember = {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  twoFactorEnabled: boolean
  required: boolean
}

export type SecurityProps = {
  email: string
  enabled: boolean
  enabledAt: string | null
  backupLeft: number
  /** Why it is required for this user, or null. */
  requirementText: string | null
  canDisable: boolean
  /** Set when the user just entered with a backup code. */
  backupJustUsed: boolean
  graceUntil: string | null
  clinic: null | {
    requireAll: boolean
    members: SecurityMember[]
  }
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })

const chip = (on: boolean) =>
  `inline-flex h-6 items-center rounded-[6px] px-2 text-xs font-medium ${on ? 'bg-[#e8f4ec] text-[#15803d]' : 'bg-[#f0eeec] text-[#57534e]'}`

/** Inline "type your code to confirm" step used by every sensitive action. */
function CodeConfirm({
  label,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  label: string
  confirmLabel: string
  onConfirm: (code: string) => Promise<string | null>
  onCancel: () => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <div className="mt-3 rounded-[10px] border border-[#e7e5e4] bg-[#fafaf7] p-3">
      <div className="max-w-[260px]">
        <Field label={label}>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123 456"
            className={`${inputClass} font-mono tracking-[.2em]`}
          />
        </Field>
      </div>
      {error && <p className={`mt-2 ${NOTE_ERR}`}>{error}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          className={btnPrimary}
          disabled={pending || !code.trim()}
          onClick={() =>
            start(async () => {
              setError(await onConfirm(code))
            })
          }
        >
          {pending && <Spinner />}
          {confirmLabel}
        </button>
        <button type="button" className={btnGhost} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

function TwoFactorCard(p: SecurityProps) {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'setup' | 'resetup' | 'regen' | 'disable'>('idle')
  const [codes, setCodes] = useState<string[] | null>(null)
  const done = () => {
    setMode('idle')
    setCodes(null)
    router.refresh()
  }

  return (
    <section className={`${CARD} p-4 md:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Verificación en dos pasos</h2>
        <span className={chip(p.enabled)}>{p.enabled ? 'Activa' : 'Sin activar'}</span>
      </div>
      <p className="mt-1 text-sm text-[#57534e]">
        Al entrar, además de su contraseña se le pide un código de su app autenticadora.
        {p.requirementText ? ` ${p.requirementText}` : ''}
      </p>

      {p.backupJustUsed && p.enabled && (
        <p className="mt-3 rounded-[10px] bg-[#faf3e6] px-3 py-2 text-sm text-[#b45309]">
          Entró con un código de respaldo. Le quedan {p.backupLeft}. Si perdió el teléfono, configure la verificación en el nuevo.
        </p>
      )}
      {!p.enabled && p.graceUntil && (
        <p className="mt-3 rounded-[10px] bg-[#faf3e6] px-3 py-2 text-sm text-[#b45309]">
          Será obligatoria desde el {fmtDate(p.graceUntil)}.
        </p>
      )}

      {codes ? (
        <div className="mt-4">
          <BackupCodesSheet codes={codes} email={p.email} onDone={done} />
        </div>
      ) : !p.enabled ? (
        mode === 'setup' ? (
          <div className="mt-4">
            <TwoFactorSetup email={p.email} onFinished={done} onCancel={() => setMode('idle')} />
          </div>
        ) : (
          <button type="button" className={`${btnPrimary} mt-4`} onClick={() => setMode('setup')}>
            Activar verificación en dos pasos
          </button>
        )
      ) : (
        <>
          <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            {p.enabledAt && (
              <div>
                <dt className="text-[13px] text-[#57534e]">Activa desde</dt>
                <dd className="tabular-nums">{fmtDate(p.enabledAt)}</dd>
              </div>
            )}
            <div>
              <dt className="text-[13px] text-[#57534e]">Códigos de respaldo sin usar</dt>
              <dd className={`tabular-nums ${p.backupLeft <= 2 ? 'font-medium text-[#b45309]' : ''}`}>{p.backupLeft} de 10</dd>
            </div>
          </dl>
          {mode === 'resetup' ? (
            <div className="mt-4">
              <TwoFactorSetup email={p.email} needsCurrentCode onFinished={done} onCancel={() => setMode('idle')} />
            </div>
          ) : mode === 'regen' ? (
            <CodeConfirm
              label="Código de su app"
              confirmLabel="Generar códigos nuevos"
              onCancel={() => setMode('idle')}
              onConfirm={async (code) => {
                const res = await regenerateBackupCodesAction(code)
                if (!res.ok) return res.message
                setCodes(res.data)
                return null
              }}
            />
          ) : mode === 'disable' ? (
            <CodeConfirm
              label="Código de su app"
              confirmLabel="Desactivar"
              onCancel={() => setMode('idle')}
              onConfirm={async (code) => {
                const res = await disableTwoFactorAction(code)
                if (!res.ok) return res.message
                done()
                return null
              }}
            />
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={btnGhost} onClick={() => setMode('regen')}>
                Códigos de respaldo nuevos
              </button>
              <button type="button" className={btnGhost} onClick={() => setMode('resetup')}>
                Configurar en otro teléfono
              </button>
              {p.canDisable && (
                <button type="button" className={btnGhost} onClick={() => setMode('disable')}>
                  Desactivar
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function PasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const mismatch = repeat.length > 0 && next !== repeat

  const submit = () =>
    start(async () => {
      setMsg(null)
      const res = await changePasswordAction(current, next)
      if (res.ok) {
        setCurrent('')
        setNext('')
        setRepeat('')
        setMsg({ ok: true, text: 'Contraseña cambiada. Cerramos las demás sesiones abiertas.' })
      } else setMsg({ ok: false, text: res.message })
    })

  return (
    <section className={`${CARD} p-4 md:p-5`}>
      <h2 className="text-[15px] font-semibold">Contraseña</h2>
      <p className="mt-1 text-sm text-[#57534e]">Al cambiarla se cierran las sesiones abiertas en otros equipos.</p>
      <div className="mt-3 grid max-w-[420px] gap-3">
        <Field label="Contraseña actual" htmlFor="pw-current">
          <input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Contraseña nueva" htmlFor="pw-next" hint="Mínimo 10 caracteres.">
          <input id="pw-next" type="password" autoComplete="new-password" minLength={10} value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Repita la contraseña nueva" htmlFor="pw-repeat">
          <input id="pw-repeat" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={inputClass} />
        </Field>
      </div>
      {mismatch && <p className={`mt-2 ${NOTE_ERR}`}>Las contraseñas nuevas no coinciden.</p>}
      {msg && <p className={`mt-2 text-[13px] font-medium ${msg.ok ? 'text-[#15803d]' : 'text-[#b45309]'}`}>{msg.text}</p>}
      <button
        type="button"
        className={`${btnPrimary} mt-3`}
        disabled={pending || !current || next.length < 10 || next !== repeat}
        onClick={submit}
      >
        {pending && <Spinner />}
        Cambiar contraseña
      </button>
    </section>
  )
}

function ClinicCard({ clinic }: { clinic: NonNullable<SecurityProps['clinic']> }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState<null | { kind: 'reset'; member: SecurityMember } | { kind: 'requireOff' }>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const without = clinic.members.filter((m) => m.active && !m.twoFactorEnabled)

  const turnOn = () =>
    start(async () => {
      setError(null)
      const res = await setRequireAllAction(true)
      if (!res.ok) setError(res.message)
      else router.refresh()
    })

  return (
    <section className={`${CARD} p-4 md:p-5`}>
      <h2 className="text-[15px] font-semibold">Seguridad de la clínica</h2>
      <p className="mt-1 text-sm text-[#57534e]">
        {without.length === 0
          ? 'Todo el equipo activo usa la verificación en dos pasos.'
          : `${without.length} ${without.length === 1 ? 'persona del equipo no la usa' : 'personas del equipo no la usan'}.`}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e7e5e4] px-3 py-2.5">
        <div className="min-w-0">
          <div className="text-sm font-medium">Exigir verificación en dos pasos a todo el equipo</div>
          <div className="text-[13px] text-[#57534e]">
            {clinic.requireAll ? 'Activado: cada persona la configura al entrar.' : 'Desactivado: cada persona decide.'}
          </div>
        </div>
        {clinic.requireAll ? (
          <button type="button" className={btnGhost} onClick={() => setConfirming({ kind: 'requireOff' })}>
            Dejar de exigir
          </button>
        ) : (
          <button type="button" className={btnPrimary} onClick={turnOn} disabled={pending}>
            {pending && <Spinner />}
            Exigir a todos
          </button>
        )}
      </div>
      {error && <p className={`mt-2 ${NOTE_ERR}`}>{error}</p>}
      {confirming?.kind === 'requireOff' && (
        <CodeConfirm
          label="Su código, para confirmar"
          confirmLabel="Dejar de exigir"
          onCancel={() => setConfirming(null)}
          onConfirm={async (code) => {
            const res = await setRequireAllAction(false, code)
            if (!res.ok) return res.message
            setConfirming(null)
            router.refresh()
            return null
          }}
        />
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-[#e7e5e4]">
              <th className="px-2 py-2 text-left text-xs font-medium text-[#57534e]">Persona</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-[#57534e]">Rol</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-[#57534e]">Verificación</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {clinic.members.map((m) => (
              <tr key={m.id} className="border-b border-[#f0eeec] last:border-0">
                <td className="px-2 py-2.5">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-[13px] text-[#57534e]">{m.email}</div>
                </td>
                <td className="px-2 py-2.5">{ROLE_LABELS[m.role as Role] ?? m.role}{!m.active ? ' · desactivado' : ''}</td>
                <td className="px-2 py-2.5">
                  <span className={chip(m.twoFactorEnabled)}>{m.twoFactorEnabled ? 'Activa' : m.required ? 'Pendiente' : 'No'}</span>
                </td>
                <td className="px-2 py-2.5 text-right">
                  {m.twoFactorEnabled && m.role !== 'owner' && (
                    <button type="button" className="text-[13px] font-medium text-[#0f766e]" onClick={() => setConfirming({ kind: 'reset', member: m })}>
                      Restablecer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {confirming?.kind === 'reset' && (
        <>
          <p className="mt-3 text-sm">
            Restablecer la verificación de <span className="font-medium">{confirming.member.name}</span>: la configurará de nuevo al entrar. Úselo si perdió el teléfono.
          </p>
          <CodeConfirm
            label="Su código, para confirmar"
            confirmLabel="Restablecer"
            onCancel={() => setConfirming(null)}
            onConfirm={async (code) => {
              const res = await resetMemberTwoFactorAction(confirming.member.id, code)
              if (!res.ok) return res.message
              setConfirming(null)
              router.refresh()
              return null
            }}
          />
        </>
      )}
    </section>
  )
}

export function SecurityPanel(props: SecurityProps) {
  return (
    <div className="flex flex-col gap-4">
      <TwoFactorCard {...props} />
      <PasswordCard />
      {props.clinic && <ClinicCard clinic={props.clinic} />}
    </div>
  )
}
