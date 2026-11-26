'use client'

// Page chrome — design_handoff_medira shell: sticky 56px header on the warm
// translucent background, «Volver» on child views, 17/600 title, the patient
// search (⌘K / Ctrl+K) and the page's own actions. ContentFrame keeps pages that
// do not render an AppHeader working inside the same shell.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useShell, isActivePath } from './Sidebar'

/** Pages that render their own AppHeader. */
const REDESIGNED: RegExp[] = [
  /^\/dashboard$/,
  /^\/dashboard\/appointments$/,
  /^\/dashboard\/appointments\/new$/,
  /^\/dashboard\/invoices$/,
  /^\/dashboard\/invoices\/[^/]+$/,
  /^\/dashboard\/reports$/,
  /^\/dashboard\/plan$/,
  /^\/dashboard\/settings$/,
  /^\/dashboard\/staff$/,
  /^\/dashboard\/activity$/,
  /^\/dashboard\/security$/,
  /^\/dashboard\/visits\/new$/,
  /^\/dashboard\/visits\/[^/]+\/edit$/,
  /^\/dashboard\/patients$/,
  /^\/dashboard\/patients\/new$/,
  /^\/dashboard\/patients\/[^/]+$/,
  /^\/dashboard\/patients\/[^/]+\/edit$/,
]

/** ⌘K palette: search patients by name, phone, cédula or record number, or jump to a menu page. */
function SearchPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const shell = useShell()
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    input.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  const pages = (shell?.groups ?? []).flatMap((g) => g.items).filter((i) => !q || i.label.toLowerCase().includes(q.toLowerCase()))
  const go = (href: string) => {
    onClose()
    router.push(href)
  }
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-[rgba(28,25,23,.45)]" />
      <div
        role="dialog"
        aria-label="Buscar"
        className="relative w-full max-w-[520px] animate-[md-up_.2s_ease-out] overflow-hidden rounded-[14px] border border-[#e7e5e4] bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (q.trim()) go(`/dashboard/patients?q=${encodeURIComponent(q.trim())}`)
          }}
        >
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar paciente por nombre, teléfono o cédula"
            aria-label="Buscar paciente"
            className="h-12 w-full border-b border-[#f0eeec] px-4 text-base outline-none"
          />
        </form>
        <div className="max-h-[50vh] overflow-y-auto py-1.5 text-sm">
          {q.trim() && (
            <button type="button" onClick={() => go(`/dashboard/patients?q=${encodeURIComponent(q.trim())}`)} className="flex w-full justify-between gap-3 bg-[#f0eeec] px-4 py-2.5 text-left">
              <span className="font-medium">Buscar «{q.trim()}» en pacientes</span>
              <span className="text-[#57534e]">Enter</span>
            </button>
          )}
          {pages.map((p) => (
            <button key={p.href} type="button" onClick={() => go(p.href)} className="flex w-full justify-between gap-3 px-4 py-2.5 text-left hover:bg-[#fafaf7]">
              <span>{p.label}</span>
              <span className="text-[#57534e]">Ir</span>
            </button>
          ))}
          {!q.trim() && (
            <button type="button" onClick={() => go('/dashboard/appointments/new')} className="flex w-full justify-between gap-3 px-4 py-2.5 text-left hover:bg-[#fafaf7]">
              <span>Nueva cita</span>
              <span className="text-[#57534e]">Acción</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function SearchButton() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-auto hidden h-[38px] max-w-[420px] min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-[#e7e5e4] bg-white pr-2.5 pl-3 text-left text-sm text-[#57534e] transition-colors hover:border-[#a8a29e] md:flex"
      >
        <span className="min-w-0 flex-1 truncate">Buscar paciente o acción</span>
        <kbd className="flex-none rounded-md border border-[#d6d3d1] px-1.5 py-px font-mono text-xs">Ctrl K</kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 flex-none rounded-lg border border-[#d6d3d1] bg-white px-2.5 text-[13px] font-medium md:hidden"
      >
        Buscar
      </button>
      {open && <SearchPalette onClose={() => setOpen(false)} />}
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
  /** Child views show «Volver». */
  backHref?: string
  /** Page actions on the right (e.g. «Nueva cita»). */
  actions?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[#e7e5e4] bg-[rgba(250,250,247,.94)] backdrop-blur-md">
      <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 md:px-5">
        {backHref && (
          <Link
            href={backHref}
            className="flex h-9 flex-none items-center rounded-lg border border-[#d6d3d1] bg-white px-2.5 text-[13px] font-medium text-[#1c1917] hover:text-[#1c1917]"
          >
            Volver
          </Link>
        )}
        <div className="min-w-0 flex-[0_1_auto]">
          <h1 className="truncate font-sans text-[17px] font-semibold tracking-[-.02em]">{title}</h1>
          {subtitle && <div className="truncate text-xs text-[#57534e]">{subtitle}</div>}
        </div>
        <SearchButton />
        {actions && <div className="flex flex-none flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

/** Padded content area: max width 1080, 20px gutter. */
export function AppContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1080px] px-4 pt-4 pb-6 md:px-5 md:pt-5 md:pb-10 ${className}`}>{children}</div>
}

/** Title of the current page from the menu, for pages without their own AppHeader. */
function useMenuTitle() {
  const pathname = usePathname()
  const shell = useShell()
  const items = (shell?.groups ?? []).flatMap((g) => g.items)
  return items.filter((i) => isActivePath(pathname, i.href)).sort((a, b) => b.href.length - a.href.length)[0]?.label ?? ''
}

/**
 * Wraps every dashboard page. Pages with their own AppHeader pass through; the rest
 * get the shell header with the menu title and the content width of the design.
 */
export function ContentFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const title = useMenuTitle()
  if (REDESIGNED.some((r) => r.test(pathname))) return <main className="flex-1 overflow-x-clip pb-24 lg:pb-0">{children}</main>
  return (
    <main className="flex-1 overflow-x-clip pb-24 lg:pb-8">
      <AppHeader title={title} />
      <div className="mx-auto w-full max-w-[1080px] animate-fade-up px-4 pt-5 md:px-5">{children}</div>
    </main>
  )
}
