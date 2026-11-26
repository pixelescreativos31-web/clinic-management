'use client'

import { btnPrimary, btnGhost } from './primitives'

/** Print / Save-as-PDF — the browser print dialog does the PDF export (no PDF lib). */
export function PrintButton({ label = 'Imprimir o guardar PDF', variant = 'primary' as 'primary' | 'ghost' }) {
  return (
    <button type="button" className={variant === 'primary' ? btnPrimary : btnGhost} onClick={() => window.print()}>
      {label}
    </button>
  )
}
