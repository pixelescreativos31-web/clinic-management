'use client'

// Spec §3: after PayPal, ask every 3 s for up to 30 s. PayPal usually confirms in
// seconds; past 30 s the webhook finishes the job and we email the Titular.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { btnPrimary, btnGhost, Spinner } from '@/components/primitives'
import { checkSubscription } from '../actions'

const POLL_MS = 3000
const MAX_MS = 30_000

type State = 'waiting' | 'done' | 'trial' | 'slow' | 'trial_denied' | 'cancelled' | 'error'

export function ReturnPoller({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter()
  const [state, setState] = useState<State>('waiting')
  const [error, setError] = useState<string | null>(null)
  const started = useRef(Date.now())

  useEffect(() => {
    let stop = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      const res = await checkSubscription(subscriptionId).catch(() => null)
      if (stop) return
      if (res && !res.ok) {
        setError(res.message)
        setState('error')
        return
      }
      const outcome = res?.ok ? res.data.outcome : 'pending'
      if (outcome === 'active' || outcome === 'past_due') return setState('done')
      if (outcome === 'trialing') return setState('trial')
      if (outcome === 'trial_denied') return setState('trial_denied')
      if (outcome === 'cancelled') return setState('cancelled')
      if (Date.now() - started.current >= MAX_MS) return setState('slow')
      timer = setTimeout(tick, POLL_MS)
    }
    void tick()
    return () => {
      stop = true
      if (timer) clearTimeout(timer)
    }
  }, [subscriptionId])

  useEffect(() => {
    if (state === 'done' || state === 'trial') router.refresh()
  }, [state, router])

  const box = 'max-w-xl rounded-[12px] border border-[#e7e5e4] bg-white px-5 py-5'
  if (state === 'waiting') {
    return (
      <section className={box} aria-live="polite">
        <div className="flex items-center gap-2 font-semibold">
          <Spinner /> Terminando su suscripción…
        </div>
        <p className="mt-1 text-sm text-[#57534e]">Estamos confirmando con PayPal. No cierre esta página.</p>
      </section>
    )
  }
  if (state === 'done' || state === 'trial') {
    return (
      <section className={box} aria-live="polite" data-return="ok">
        <h2 className="font-semibold">{state === 'trial' ? 'Su prueba empezó' : 'Su plan está activo'}</h2>
        <p className="mt-1 text-sm text-[#57534e]">
          {state === 'trial'
            ? 'No se le cobrará nada durante la prueba. Le avisaremos por correo un día antes del primer cobro.'
            : 'Gracias. Ya puede usar todo lo que incluye su plan.'}
        </p>
        <Link href="/dashboard/plan" className={`${btnPrimary} mt-4`}>
          Ver mi plan
        </Link>
      </section>
    )
  }
  if (state === 'slow') {
    return (
      <section className={box} aria-live="polite" data-return="slow">
        <h2 className="font-semibold">Su pago está en proceso</h2>
        <p className="mt-1 text-sm text-[#57534e]">
          Le avisaremos por correo cuando se active (normalmente menos de 5 minutos).
        </p>
        <Link href="/dashboard" className={`${btnGhost} mt-4`}>
          Volver al inicio
        </Link>
      </section>
    )
  }
  if (state === 'trial_denied') {
    return (
      <section className={box} data-return="trial-denied">
        <h2 className="font-semibold">Esta cuenta de PayPal ya usó su prueba gratis</h2>
        <p className="mt-1 text-sm text-[#57534e]">No se cobró nada. Puede suscribirse sin prueba desde Mi plan.</p>
        <Link href="/dashboard/plan#planes" className={`${btnPrimary} mt-4`}>
          Ver planes
        </Link>
      </section>
    )
  }
  return (
    <section className={box} data-return={state}>
      <h2 className="font-semibold">No se completó la suscripción</h2>
      <p className="mt-1 text-sm text-[#57534e]">{error ?? 'No se cobró nada.'}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/dashboard/plan#planes" className={btnPrimary}>
          Intentar de nuevo
        </Link>
        <Link href="/dashboard" className={btnGhost}>
          Seguir en mi plan actual
        </Link>
      </div>
    </section>
  )
}
