'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { AppSelect } from './AppSelect'

export const PAGE_SIZES = [10, 25, 50] as const

/** "Rows per page" dropdown — updates the `limit` URL param and resets to page 1. */
export function PageSizeSelect({ value, basePath }: { value: number; basePath: string }) {
  const router = useRouter()
  const params = useSearchParams()

  const change = (v: string) => {
    const next = new URLSearchParams(params.toString())
    next.set('limit', v)
    next.set('page', '1')
    router.push(`${basePath}?${next.toString()}`)
  }

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      Filas por página
      <AppSelect
        value={String(value)}
        onChange={change}
        options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
        className="h-8 w-[72px] text-xs"
      />
    </label>
  )
}
