import Link from 'next/link'
import { PrintButton } from '@/components/PrintButton'

// Shared PDF letterhead (design handoff «Membrete de PDF»): name 16/600 with a
// 12px detail line, 2px ink rule below, document label + folio and date in mono
// on the right. Reads the same in black and white. Print CSS stays in each page.

export function Letterhead({
  logo,
  name,
  details,
  doc,
  date,
}: {
  logo?: string | null
  /** Clinic name (the prescriber's name on a prescription). */
  name: React.ReactNode
  /** One or more detail lines under the name (address, phone, specialty…). */
  details?: React.ReactNode
  /** Document label with its folio, e.g. «Recibo 0913». */
  doc: React.ReactNode
  date?: React.ReactNode
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b-2 border-[#1c1917] pb-3">
      <div className="min-w-0">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="mb-1.5 h-12 w-auto" />
        )}
        <div className="text-base leading-tight font-semibold text-[#1c1917]">{name}</div>
        {details && <div className="mt-0.5 text-xs leading-relaxed text-[#57534e]">{details}</div>}
      </div>
      <div className="shrink-0 text-right font-mono text-[11px] leading-relaxed whitespace-nowrap text-[#57534e]">
        {doc}
        {date && (
          <>
            <br />
            {date}
          </>
        )}
      </div>
    </header>
  )
}

/** On-screen toolbar above the sheet; hidden when printing. */
export function PrintToolbar({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
      <Link
        href={backHref}
        className="flex h-9 items-center rounded-lg border border-[#d6d3d1] bg-white px-2.5 text-[13px] font-medium text-[#1c1917] hover:text-[#1c1917]"
      >
        {backLabel}
      </Link>
      <PrintButton />
    </div>
  )
}

/** Short numeric date (dd/mm/aaaa) in the clinic's timezone, for the letterhead. */
export function numericDate(value: Date | string, timeZone?: string | null): string {
  try {
    return new Date(value).toLocaleDateString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: timeZone || undefined,
    })
  } catch {
    return new Date(value).toLocaleDateString('es-DO')
  }
}
