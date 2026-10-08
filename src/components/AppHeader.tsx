'use client'

// Redesigned page chrome (design handoff shell): sticky translucent header with an
// optional back button, Bricolage title + subtitle, page actions, and — on phones —
// the user's avatar, which opens the menu with admin pages and sign-out.
// ContentFrame keeps not-yet-redesigned pages working inside the new shell.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useShell } from './Sidebar'
import { IconBack, IconLogout } from './icons'
import { logoutAction } from '@/app/(frontend)/login/actions'
import { initialsOf } from '@/lib/apptStatus'
import { APP_NAME } from '@/lib/brand'

/** Pages already on the new design render their own AppHeader. */
const REDESIGNED = ['/dashboard', '/dashboard/appointments', '/dashboard/invoices']

function UserMenu() {
  const shell = useShell()
  const [open, setOpen] = useState(false)
  if (!shell) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menú de usuario"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e6f1ee] text-[11px] font-semibold text-[#0d6e60] md:hidden"
      >
        {initialsOf(shell.userName)}
      </button>
      {/* Portal: the header's backdrop-blur would otherwise become the containing
          block of this fixed overlay and trap it inside the 56px bar. */}
      {open &&
        createPortal(
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-[rgba(12,33,29,.45)]" />
          <div
            className="absolute inset-x-0 bottom-0 flex animate-[emr-up_.25s_ease-out] flex-col gap-1 rounded-t-[18px] bg-white px-4 pt-2.5 pb-[max(20px,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="mb-2 h-1 w-10 self-center rounded-full bg-[#d7dddd]" />
            <div className="px-2 pb-2">
              <div className="truncate text-[15px] font-semibold">{shell.userName}</div>
              <div className="truncate text-xs text-[#6b7577]">
                {shell.roleText} · {shell.clinicName}
              </div>
            </div>
            {shell.adminItems.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center rounded-xl px-3 text-[15px] font-medium text-[#15201e] hover:bg-[#f4f6f6] hover:text-[#15201e]"
              >
                {i.label}
              </Link>
            ))}
            <form action={logoutAction}>
              <button type="submit" className="flex min-h-12 w-full items-center gap-2.5 rounded-xl px-3 text-[15px] font-medium text-[#b3261e] hover:bg-[#fbeceb]">
                <IconLogout size={18} />
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>,
          document.body,
        )}
    </>
  )
}

export function AppHeader({
  title,
  subtitle,
  backHref,
  actions,
}: {
  title: string
  subtitle?: string
  /** Non-root views show a back button. */
  backHref?: string
  /** Desktop/mobile actions on the right (e.g. "+ Nueva cita"). */
  actions?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-[#e3e7e7] bg-[rgba(244,246,246,.92)] px-4 py-3 backdrop-blur-md md:px-7 md:py-3.5">
      {backHref && (
        <Link
          href={backHref}
          aria-label="Volver"
          className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[#e3e7e7] bg-white text-[#15201e] hover:text-[#15201e]"
        >
          <IconBack size={20} />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-lg font-semibold tracking-[-.01em]">{title}</h1>
        {subtitle && <div className="truncate text-xs text-[#6b7577]">{subtitle}</div>}
      </div>
      {actions}
      <UserMenu />
    </header>
  )
}

/** Padded content area for redesigned pages. */
export function AppContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-3.5 pt-3.5 pb-6 md:px-7 md:pt-6 md:pb-10 ${className}`}>{children}</div>
}

/**
 * Wraps every dashboard page. Redesigned pages pass through untouched; older pages
 * get the previous padding plus a slim phone bar with the user menu, so admin pages
 * and sign-out stay reachable until they are redesigned.
 */
export function ContentFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (REDESIGNED.includes(pathname)) return <main className="flex-1 overflow-x-hidden pb-24 md:pb-0">{children}</main>
  return (
    <main className="flex-1 overflow-x-hidden pb-24 md:pb-8">
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#e3e7e7] bg-[rgba(244,246,246,.92)] px-4 backdrop-blur-md md:hidden">
        <span className="flex items-center gap-2 font-display text-base font-bold">
          <span aria-hidden className="flex size-6 items-center justify-center rounded-md bg-[#0d6e60] text-xs text-white">
            +
          </span>
          {APP_NAME}
        </span>
        <UserMenu />
      </div>
      <div className="mx-auto max-w-7xl animate-fade-up px-4 pt-6 sm:px-6">{children}</div>
    </main>
  )
}
