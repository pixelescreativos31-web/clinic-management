'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from './primitives'
import { startConsultation } from '@/app/(frontend)/dashboard/appointments/actions'

/** "Atender ahora" — open a consultation for this patient without booking first. */
export function StartConsultationButton({ patientId, className = '' }: { patientId: string; className?: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const go = () => {
    setError(null)
    start(async () => {
      const res = await startConsultation(patientId)
      if (res.ok) router.push(`/dashboard/visits/new?appointment=${res.data.appointmentId}`)
      else setError(res.message)
    })
  }

  return (
    <div className={className}>
      <button
        type="button"
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#0f766e] px-[18px] text-[15px] font-medium text-white transition-colors hover:bg-[#115e59] disabled:opacity-60"
        onClick={go}
        disabled={pending}
      >
        {pending && <Spinner />}
        Atender ahora
      </button>
      {error && (
        <p className="mt-2 text-[13px] text-[#b45309]" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
