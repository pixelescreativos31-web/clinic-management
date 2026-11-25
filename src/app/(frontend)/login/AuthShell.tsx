// Shared frame for the public account flows (entrar, registro, recuperar, verificar)
// — design handoff "Flujos": a centered 440px card on the page background with the
// text wordmark above it. No 'use client': it renders inside server pages too.

import Link from 'next/link'
import { APP_NAME } from '@/lib/brand'
import { btnGhost, btnPrimary, inputClass } from '@/components/primitives'
import { cn } from '@/lib/utils'

/** 48px field, radius 10 (handoff "Campo"). */
export const authInput = cn(inputClass, 'h-12 text-base')
/** Full-width primary action, 48px. */
export const authBtn = cn(btnPrimary, 'h-12 w-full text-base font-semibold')
/** Full-width secondary action, 46px. */
export const authBtn2 = cn(btnGhost, 'h-[46px] w-full text-[15px]')
/** Inline link in primary teal. */
export const authLink = 'font-medium text-primary hover:underline'

export function AuthShell({ children, below }: { children: React.ReactNode; below?: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-4 pt-[clamp(20px,5vw,56px)] pb-14 text-foreground">
      <div className="w-full max-w-[440px]">
        <Link href="/" className="mx-auto mb-5 block w-fit text-[22px] font-semibold tracking-[-0.04em] text-foreground">
          {APP_NAME}
        </Link>
        <div className="rounded-[14px] border border-border bg-card p-[clamp(20px,5vw,28px)]">{children}</div>
        {below}
      </div>
    </main>
  )
}

export function AuthTitle({ title, sub }: { title: string; sub?: React.ReactNode }) {
  return (
    <>
      <h1 className="text-[22px] leading-[1.2] font-semibold tracking-[-0.03em] text-balance">{title}</h1>
      {sub && <p className="mt-1.5 text-[15px] text-pretty text-muted-foreground">{sub}</p>}
    </>
  )
}

/** 4px segmented progress bar + "Paso n de N". */
export function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-4" aria-label={`Paso ${step} de ${total}`}>
      <div className="mb-1.5 flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-[2px] ${i < step ? 'bg-primary' : 'bg-border'}`} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Paso {step} de {total}
      </p>
    </div>
  )
}

/** The single amber form error (handoff: errors are amber, never red). */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[10px] border border-amber px-3 py-2.5 text-sm font-medium text-amber" role="alert">
      {children}
    </p>
  )
}

/** Muted footnote under the actions. */
export function AuthNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-3.5 text-[13px] text-pretty text-muted-foreground">{children}</p>
}
