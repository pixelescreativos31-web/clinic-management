'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconDashboard,
  IconCalendar,
  IconUsers,
  IconStaff,
  IconSettings,
  IconLogout,
  IconClock,
  IconCreditCard,
  IconChart,
  IconMenu,
} from './icons'
import { logoutAction } from '@/app/(frontend)/login/actions'
import { APP_NAME } from '@/lib/brand'
import { ROLE_LABELS, type Role } from '@/lib/constants'

type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }

function initialsOf(name: string) {
  return name
    .replace(/^Dr[a]?\.?\s+/i, '')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Sidebar({
  clinicName,
  userName,
  role,
  practitioner = false,
  individual = true,
}: {
  clinicName: string
  userName: string
  role: string
  /** The user sees patients (doctor, or an owner who practises). */
  practitioner?: boolean
  /** Independent practice: simplified navigation (no multi-doctor tooling). */
  individual?: boolean
}) {
  const pathname = usePathname()
  // Mobile: the bottom bar fits 3 tabs; everything else lives behind «Más».
  const [moreOpen, setMoreOpen] = useState(false)

  const items: NavItem[] = [
    { href: '/dashboard', label: 'Inicio', icon: IconDashboard },
    { href: '/dashboard/appointments', label: 'Agenda', icon: IconCalendar },
    { href: '/dashboard/patients', label: 'Pacientes', icon: IconUsers },
  ]
  const adminItems: NavItem[] = []
  if (role === 'owner') {
    adminItems.push({ href: '/dashboard/reports', label: 'Reportes', icon: IconChart })
    // An independent doctor manages at most an assistant — "Equipo" reads heavy.
    adminItems.push({ href: '/dashboard/staff', label: individual ? 'Asistente' : 'Equipo', icon: IconStaff })
    adminItems.push({ href: '/dashboard/activity', label: 'Auditoría', icon: IconClock })
    adminItems.push({ href: '/dashboard/plan', label: 'Mi plan', icon: IconCreditCard })
    adminItems.push({ href: '/dashboard/settings', label: 'Configuración', icon: IconSettings })
  }
  const roleText =
    role === 'owner' && practitioner ? 'Médico titular' : ROLE_LABELS[role as Role] ?? role

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href)
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150 ${
          active
            ? 'bg-white/[0.08] text-sidebar-active-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
            : 'text-sidebar-foreground hover:bg-white/[0.05] hover:text-sidebar-active-fg'
        }`}
      >
        {active && (
          <span className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-sidebar-accent" />
        )}
        <Icon
          size={16}
          strokeWidth={1.75}
          className={active ? 'text-sidebar-accent' : 'text-sidebar-foreground/70 transition-colors group-hover:text-sidebar-foreground'}
        />
        {item.label}
      </Link>
    )
  }

  return (
    <>
      {/* Desktop sidebar — dark emerald chrome */}
      <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        {/* Brand + clinic */}
        <div className="px-5 pt-6 pb-5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-accent/15 ring-1 ring-sidebar-accent/30">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-sidebar-accent" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
              </svg>
            </span>
            <span className="font-display text-lg leading-none font-semibold tracking-tight text-sidebar-active-fg">
              {APP_NAME}
            </span>
          </Link>
          <div className="mt-4 rounded-lg border border-sidebar-border bg-sidebar-soft px-3 py-2.5">
            <div className="text-[10px] font-semibold tracking-[0.12em] text-sidebar-foreground/60 uppercase">
              Consultorio
            </div>
            <div className="mt-0.5 truncate text-[13px] font-medium text-sidebar-active-fg">
              {clinicName}
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          <div className="mb-1 px-3 text-[10px] font-semibold tracking-[0.12em] text-sidebar-foreground/50 uppercase">
            General
          </div>
          {items.map(renderItem)}
          {adminItems.length > 0 && (
            <>
              <div className="mt-5 mb-1 px-3 text-[10px] font-semibold tracking-[0.12em] text-sidebar-foreground/50 uppercase">
                Administración
              </div>
              {adminItems.map(renderItem)}
            </>
          )}
        </nav>

        {/* User card */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.04]">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent/15 text-[11px] font-semibold text-sidebar-accent ring-1 ring-sidebar-accent/25">
              {initialsOf(userName) || '•'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium leading-tight text-sidebar-active-fg">
                {userName}
              </div>
              <div className="truncate text-[11px] text-sidebar-foreground/70">
                {roleText}
              </div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                title="Cerrar sesión"
                className="flex size-8 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors duration-150 hover:bg-white/[0.07] hover:text-sidebar-active-fg"
              >
                <IconLogout size={15} strokeWidth={1.75} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile «Más» sheet: admin pages + sign out (no sidebar on phones) */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-ink/30" />
          <div
            className="absolute inset-x-0 bottom-[57px] rounded-t-2xl border-t bg-card p-3 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 pt-1 pb-2">
              <div className="truncate text-sm font-semibold">{userName}</div>
              <div className="truncate text-xs text-muted-foreground">
                {roleText} · {clinicName}
              </div>
            </div>
            {adminItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${
                    isActive(item.href) ? 'bg-primary-soft text-primary' : 'text-ink'
                  }`}
                >
                  <Icon size={17} strokeWidth={1.75} />
                  {item.label}
                </Link>
              )
            })}
            <form action={logoutAction}>
              <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-red">
                <IconLogout size={17} strokeWidth={1.75} />
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t bg-card md:hidden">
        {items.slice(0, 3).map((item) => {
          const active = isActive(item.href) && !moreOpen
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon size={18} strokeWidth={1.75} />
              {item.label}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
            moreOpen || adminItems.some((i) => isActive(i.href)) ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <IconMenu size={18} strokeWidth={1.75} />
          Más
        </button>
      </nav>
    </>
  )
}
