'use client'

// Design handoff toast («Aviso flotante»): ink background, radius 10, slides up
// (translateY 12px → 0, .2 s), 2.6 s, above the phone tab bar.

import { useCallback, useRef, useState } from 'react'

export function useToast() {
  const [toast, setToast] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const say = useCallback((message: string) => {
    setToast(message)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(''), 2600)
  }, [])
  return { toast, say }
}

export function Toast({ message }: { message: string }) {
  if (!message) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 z-[60] max-w-[calc(100vw-32px)] -translate-x-1/2 lg:bottom-7"
    >
      <div className="animate-[md-up_.2s_ease-out] truncate rounded-[10px] bg-[#1c1917] px-4 py-3 text-sm font-medium text-white">
        {message}
      </div>
    </div>
  )
}
