'use client'

// Pending "extra / emergency" requests from the public booking page. Staff call or
// message the patient, book a slot, and close the request.

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card } from './primitives'
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

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold">Solicitudes en línea</h2>
        <span className="tabular rounded-full bg-amber-soft px-2 py-0.5 text-xs font-semibold text-amber">{rows.length}</span>
      </div>
      {error && <p className="px-5 pt-3 text-sm text-red">{error}</p>}
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {r.urgent && <span className="rounded bg-red-soft px-1.5 py-px text-[10px] font-bold text-red uppercase">Emergencia</span>}
                <Link href={`/dashboard/patients/${r.patientId}`} className="font-semibold hover:text-primary">
                  {r.patientName}
                </Link>
                <span className="tabular text-xs text-muted-foreground">{r.phone}</span>
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed">{r.reason}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Recibida {r.receivedLabel}
                {r.preferredDate ? ` · prefiere ${r.preferredDate}` : ''}
                {r.doctorName ? ` · con ${r.doctorName}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3 text-xs font-medium">
              {r.waHref && (
                <a href={r.waHref} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  WhatsApp
                </a>
              )}
              <Link href={`/dashboard/appointments/new?patient=${r.patientId}`} className="text-primary hover:underline">
                Agendar
              </Link>
              <button type="button" disabled={pending} onClick={() => resolve(r.id, 'handled')} className="text-primary hover:underline">
                Atendida
              </button>
              <button type="button" disabled={pending} onClick={() => resolve(r.id, 'dismissed')} className="text-muted-foreground hover:underline">
                Descartar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
