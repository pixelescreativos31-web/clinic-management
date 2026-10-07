'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary, Spinner } from './primitives'
import { IconStethoscope } from './icons'
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
      <button type="button" className={`${btnPrimary} w-full`} onClick={go} disabled={pending}>
        {pending ? <Spinner /> : <IconStethoscope size={15} />}
        Atender ahora
      </button>
      {error && <p className="mt-2 text-xs text-red" role="alert">{error}</p>}
    </div>
  )
}
