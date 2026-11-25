'use client'

// Pending "extra / emergency" requests from the public booking page. Staff call or
// message the patient, book a slot, and close the request.

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { resolveBookingRequest } from '@/app/(frontend)/dashboard/appointments/actions'

export type OnlineRequestRow = {
  id: string
  patientId: string
  patientName: string
  phone: string
  waHref: string | null
  doctorName: string | null
  preferredDate: string | null
  reason: string
  urgent: boolean
  receivedLabel: string
}

export function OnlineRequests({ rows }: { rows: OnlineRequestRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const resolve = (id: string, status: 'handled' | 'dismissed') => {
    setError(null)
    start(async () => {
      const res = await resolveBookingRequest(id, status)
      if (res.ok) router.refresh()
      else setError(res.message)
    })
  }

  const link = 'inline-flex h-10 items-center rounded-[10px] border border-[#d6d3d1] bg-white px-3.5 text-sm font-medium text-[#1c1917] hover:border-[#1c1917] hover:text-[#1c1917] disabled:opacity-60'
  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-[#e7e5e4] bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <h2 className="text-[15px] font-semibold">Solicitudes en línea</h2>
        <span className="tabular rounded-md border border-[#b45309] px-2 py-0.5 text-xs font-semibold text-[#b45309]">{rows.length}</span>
      </div>
      {error && (
        <p className="border-t border-[#f0eeec] px-4 py-2.5 text-sm text-[#b45309]" role="alert">
          {error}
        </p>
      )}
      <ul>
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-2.5 border-t border-[#f0eeec] px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {r.urgent && <span className="rounded-md bg-[#1c1917] px-2 py-0.5 text-xs font-semibold text-white">Emergencia</span>}
                <Link href={`/dashboard/patients/${r.patientId}`} className="font-semibold text-[#1c1917] hover:text-[#0f766e]">
                  {r.patientName}
                </Link>
                <span className="tabular text-[13px] text-[#57534e]">{r.phone}</span>
              </div>
              <p className="mt-0.5 text-sm leading-relaxed">{r.reason}</p>
              <p className="mt-0.5 text-[13px] text-[#57534e]">
                Recibida {r.receivedLabel}
                {r.preferredDate ? ` · prefiere ${r.preferredDate}` : ''}
                {r.doctorName ? ` · con ${r.doctorName}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              <Link href={`/dashboard/appointments/new?patient=${r.patientId}`} className="inline-flex h-10 items-center rounded-[10px] bg-[#0f766e] px-3.5 text-sm font-medium text-white hover:bg-[#115e59] hover:text-white">
                Agendar
              </Link>
              {r.waHref && (
                <a href={r.waHref} target="_blank" rel="noreferrer" className={link}>
                  WhatsApp
                </a>
              )}
              <button type="button" disabled={pending} onClick={() => resolve(r.id, 'handled')} className={link}>
                Atendida
              </button>
              <button type="button" disabled={pending} onClick={() => resolve(r.id, 'dismissed')} className="inline-flex h-10 items-center px-2 text-sm font-medium text-[#57534e] underline underline-offset-2 hover:text-[#1c1917] disabled:opacity-60">
                Descartar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
