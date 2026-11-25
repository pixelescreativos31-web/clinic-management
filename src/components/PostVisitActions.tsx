'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Spinner } from './primitives'
import { createInvoiceFromVisit } from '@/app/(frontend)/dashboard/invoices/actions'

/** Next-step actions shown after a visit is recorded (server renders this panel). */
export function PostVisitActions({ visitId, patientId }: { visitId: string; patientId: string }) {
  const router = useRouter()
  const [busy, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const createInvoice = () => {
    setError(null)
    start(async () => {
      const res = await createInvoiceFromVisit(visitId)
      if (res.ok) {
        router.push(`/dashboard/invoices/${res.data.id}`)
        router.refresh()
      } else setError(res.message)
    })
  }

  const secondary =
    'inline-flex h-11 items-center justify-center rounded-[10px] border border-[#d6d3d1] bg-white px-4 text-sm font-medium text-[#1c1917] transition-colors hover:border-[#1c1917] hover:text-[#1c1917]'
  return (
    <>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#0f766e] px-[18px] text-sm font-medium text-white transition-colors hover:bg-[#115e59] disabled:opacity-60"
          onClick={createInvoice}
          disabled={busy}
        >
          {busy && <Spinner />}
          Crear factura
        </button>
        <Link href={`/print/prescription/${visitId}`} target="_blank" className={secondary}>
          Imprimir receta
        </Link>
        <Link href={`/dashboard/patients/${patientId}`} className={secondary}>
          Perfil del paciente
        </Link>
        <Link href="/dashboard/appointments" className={secondary}>
          Agenda del día
        </Link>
      </div>
      {error && (
        <p className="mt-3 text-sm text-[#b45309]" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
