'use client'

// Two-step verification enrollment (spec §10 «Flujo de 2FA»): scan the QR (or type
// the key), confirm with a code, then save the 10 backup codes. The flow does not
// finish until «Ya guardé mis códigos» is ticked.

import { useState, useTransition } from 'react'
import { confirmEnrollmentAction, startEnrollmentAction } from '@/app/(frontend)/dashboard/security/actions'
import { Field, Spinner, btnGhost, btnPrimary, inputClass } from '@/components/primitives'

export const CARD = 'rounded-[12px] border border-[#e7e5e4] bg-white'
export const NOTE_ERR = 'text-[13px] font-medium text-[#b45309]'

type Started = { secret: string; groupedSecret: string; qrSvg: string }

export function BackupCodesSheet({
  codes,
  email,
  onDone,
  doneLabel = 'Terminar',
}: {
  codes: string[]
  email: string
  onDone: () => void
  doneLabel?: string
}) {
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const text = `medira — códigos de respaldo de ${email}\nCada código sirve una sola vez.\n\n${codes.join('\n')}\n`

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'medira-codigos-de-respaldo.txt'
    a.click()
    URL.revokeObjectURL(url)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  const print = () => {
    const w = window.open('', '_blank', 'width=480,height=640')
    if (!w) return
    w.document.write(
      `<pre style="font:16px/1.7 ui-monospace,monospace;padding:24px">${text.replace(/</g, '&lt;')}</pre>`,
    )
    w.document.close()
    w.print()
  }

  return (
    <div>
      <h3 className="text-[15px] font-semibold">Guarde sus códigos de respaldo</h3>
      <p className="mt-1 text-sm text-[#57534e]">
        Si pierde el teléfono, cada código le deja entrar una vez. Guárdelos fuera del teléfono: impresos o en su gestor de contraseñas. No los volveremos a mostrar.
      </p>
      <ol className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-[10px] bg-[#f0eeec] p-4 font-mono text-[15px] tabular-nums sm:grid-cols-2">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btnGhost} onClick={download}>
          Descargar
        </button>
        <button type="button" className={btnGhost} onClick={print}>
          Imprimir
        </button>
        <button type="button" className={btnGhost} onClick={copy}>
          {copied ? 'Copiados' : 'Copiar'}
        </button>
      </div>
      <label className="mt-4 flex min-h-11 items-center gap-2.5 text-sm font-medium">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-4 accent-[#0f766e]" />
        Ya guardé mis códigos de respaldo
      </label>
      <button type="button" className={`${btnPrimary} mt-2`} disabled={!saved} onClick={onDone}>
        {doneLabel}
      </button>
    </div>
  )
}

/**
 * The whole enrollment. `needsCurrentCode` = re-enrolling (new phone): the
 * current app's code is asked first.
 */
export function TwoFactorSetup({
  email,
  needsCurrentCode = false,
  onFinished,
  onCancel,
}: {
  email: string
  needsCurrentCode?: boolean
  onFinished: () => void
  onCancel?: () => void
}) {
  const [pending, start] = useTransition()
  const [current, setCurrent] = useState('')
  const [started, setStarted] = useState<Started | null>(null)
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  const begin = () =>
    start(async () => {
      setError(null)
      const res = await startEnrollmentAction(needsCurrentCode ? current : undefined)
      if (res.ok) setStarted(res.data)
      else setError(res.message)
    })

  const confirm = () =>
    start(async () => {
      setError(null)
      const res = await confirmEnrollmentAction(code)
      if (res.ok) setCodes(res.data)
      else setError(res.message)
    })

  if (codes) return <BackupCodesSheet codes={codes} email={email} onDone={onFinished} />

  if (!started) {
    return (
      <div>
        <p className="text-sm text-[#57534e]">
          Necesita una app autenticadora en su teléfono: Google Authenticator, Microsoft Authenticator o 1Password. Tarda unos 2 minutos.
        </p>
        {needsCurrentCode && (
          <div className="mt-3 max-w-[260px]">
            <Field label="Código de su app actual" htmlFor="tf-current">
              <input
                id="tf-current"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className={`${inputClass} font-mono tracking-[.2em]`}
              />
            </Field>
          </div>
        )}
        {error && <p className={`mt-2 ${NOTE_ERR}`}>{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} onClick={begin} disabled={pending || (needsCurrentCode && !current.trim())}>
            {pending && <Spinner />}
            Empezar
          </button>
          {onCancel && (
            <button type="button" className={btnGhost} onClick={onCancel}>
              Cancelar
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <ol className="flex flex-col gap-4 text-sm">
        <li>
          <div className="font-medium">1. Escanee este código con su app autenticadora</div>
          <div
            className="mt-2 w-[200px] rounded-[10px] border border-[#e7e5e4] bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
            aria-label="Código QR para su app autenticadora"
            role="img"
            dangerouslySetInnerHTML={{ __html: started.qrSvg }}
          />
          <button type="button" className="mt-2 text-[13px] font-medium text-[#0f766e]" onClick={() => setShowKey((v) => !v)}>
            {showKey ? 'Ocultar la clave' : '¿No puede escanear? Escriba la clave'}
          </button>
          {showKey && (
            <div className="mt-1.5 rounded-[10px] bg-[#f0eeec] px-3 py-2 font-mono text-[15px] tracking-[.08em] break-all select-all">
              {started.groupedSecret}
            </div>
          )}
        </li>
        <li>
          <div className="font-medium">2. Escriba el código de 6 dígitos que muestra la app</div>
          <div className="mt-2 max-w-[260px]">
            <input
              aria-label="Código de 6 dígitos"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123 456"
              className={`${inputClass} font-mono tracking-[.2em]`}
            />
          </div>
        </li>
      </ol>
      {error && <p className={`mt-2 ${NOTE_ERR}`}>{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} onClick={confirm} disabled={pending || code.replace(/\D/g, '').length !== 6}>
          {pending && <Spinner />}
          Confirmar código
        </button>
        {onCancel && (
          <button type="button" className={btnGhost} onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
