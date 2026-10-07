'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary, btnGhost, btnDanger, inputClass, Spinner } from './primitives'
import { AppSelect } from './AppSelect'
import { PAYMENT_METHODS } from '@/lib/constants'
import { recordPayment, voidInvoice } from '@/app/(frontend)/dashboard/invoices/actions'

const METHOD_OPTIONS = PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))

export function InvoiceActions({
  invoiceId,
  balanceDue,
  voided,
  canVoid,
}: {
  invoiceId: string
  balanceDue: number
  voided: boolean
  canVoid: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [payOpen, setPayOpen] = useState(false)
  const [amount, setAmount] = useState(String(balanceDue))
  const [method, setMethod] = useState('cash')

  const [voidOpen, setVoidOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (voided) return null

  const pay = () => {
    setError(null)
    start(async () => {
      const res = await recordPayment(invoiceId, Number(amount), method)
      if (res.ok) {
        setPayOpen(false)
        router.refresh()
      } else setError(res.message)
    })
  }

  const doVoid = () => {
    setError(null)
    start(async () => {
      const res = await voidInvoice(invoiceId, reason)
      if (res.ok) {
        setVoidOpen(false)
        router.refresh()
      } else setError(res.message)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded-lg border border-red/25 bg-red-soft px-3 py-2 text-sm text-red">{error}</p>}

      {balanceDue > 0 && !payOpen && (
        <button className={btnPrimary} onClick={() => { setAmount(String(balanceDue)); setPayOpen(true) }}>
          Registrar pago
        </button>
      )}

      {payOpen && (
        <div className="rounded-lg border border-border p-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Monto</label>
              <input className={inputClass} inputMode="decimal" value={amount} autoFocus onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Método de pago</label>
              <AppSelect value={method} onChange={setMethod} options={METHOD_OPTIONS} />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button className={`${btnPrimary} flex-1`} disabled={pending || !(Number(amount) > 0)} onClick={pay}>
              {pending && <Spinner />}
              {pending ? 'Guardando…' : 'Guardar pago'}
            </button>
            <button className={btnGhost} onClick={() => setPayOpen(false)} disabled={pending}>Cancelar</button>
          </div>
        </div>
      )}

      {canVoid && !voidOpen && (
        <button className={btnGhost} onClick={() => setVoidOpen(true)}>Anular factura</button>
      )}

      {voidOpen && (
        <div className="rounded-lg border border-red/25 p-3.5">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Motivo de la anulación (obligatorio)</label>
          <input className={inputClass} value={reason} autoFocus onChange={(e) => setReason(e.target.value)} placeholder="p. ej., facturada por error" />
          <div className="mt-3 flex gap-2">
            <button className={`${btnDanger} flex-1`} disabled={pending || !reason.trim()} onClick={doVoid}>
              {pending && <Spinner />}
              {pending ? 'Anulando…' : 'Confirmar anulación'}
            </button>
            <button className={btnGhost} onClick={() => setVoidOpen(false)} disabled={pending}>Conservar</button>
          </div>
        </div>
      )}
    </div>
  )
}
