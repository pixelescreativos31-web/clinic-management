'use client'

// Design handoff toast: black pill, 2.6 s, above the phone tab bar.

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
      className="fixed bottom-24 left-1/2 z-[60] max-w-[calc(100vw-32px)] -translate-x-1/2 truncate rounded-full bg-[#15201e] px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,.5)] lg:bottom-7"
    >
      {message}
    </div>
  )
}
