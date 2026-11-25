'use client'

const PAGER_BTN =
  'inline-flex h-9 items-center rounded-[8px] border border-[#d6d3d1] bg-white px-3 text-[13px] font-medium text-[#1c1917] transition-colors hover:bg-[#fafaf7] disabled:cursor-not-allowed disabled:text-[#a8a29e] disabled:hover:bg-white'

/** Compact pager for client-side tables (staff, tenants). */
export function TablePager({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#f0eeec] px-4 py-2.5">
      <span className="tabular text-[13px] text-[#57534e]">
        Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className={PAGER_BTN} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Anterior
        </button>
        <button type="button" className={PAGER_BTN} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Siguiente
        </button>
      </div>
    </div>
  )
}
