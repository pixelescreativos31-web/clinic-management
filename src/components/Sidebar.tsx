'use client'

// App shell navigation — design handoff "EMR App" shell. Desktop: white 232px
// sidebar (main tabs, then the owner's admin pages, user card + sign out).
// Mobile: bottom tab bar (up to 5 tabs, active icon inside a teal pill); the
// admin pages and sign-out live behind the avatar in each page header (AppHeader).

import { createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconHome,
  IconCalendar,
  IconUsers,
  IconMoney,
  IconChart,
  IconStaff,
  IconSettings,
  IconLogout,
  IconClock,
  IconCreditCard,
} from './icons'
import { logoutAction } from '@/app/(frontend)/login/actions'
import { APP_NAME } from '@/lib/brand'
import { ROLE_LABELS, type Role } from '@/lib/constants'
import { initialsOf } from '@/lib/apptStatus'

type Icon = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; fill?: string }>
export type NavItem = { href: string; label: string; icon: Icon }

export type ShellInfo = {
  clinicName: string
  userName: string
  roleText: string
  adminItems: { href: string; label: string }[]
}

const ShellContext = createContext<ShellInfo | null>(null)
export const useShell = () => useContext(ShellContext)

export function navFor(role: string, individual: boolean) {
  const tabs: NavItem[] = [
    { href: '/dashboard', label: 'Inicio', icon: IconHome },
    { href: '/dashboard/appointments', label: 'Agenda', icon: IconCalendar },
    { href: '/dashboard/patients', label: 'Pacientes', icon: IconUsers },
    { href: '/dashboard/invoices', label: 'Cobros', icon: IconMoney },
  ]
  // Money reports stay owner-only (sensitive figures).
  if (role === 'owner') tabs.push({ href: '/dashboard/reports', label: 'Reportes', icon: IconChart })
  const admin: NavItem[] =
    role === 'owner'
      ? [
          // An independent doctor manages at most an assistant — "Equipo" reads heavy.
          { href: '/dashboard/staff', label: individual ? 'Asistente' : 'Equipo', icon: IconStaff },
          { href: '/dashboard/activity', label: 'Auditoría', icon: IconClock },
          { href: '/dashboard/plan', label: 'Mi plan', icon: IconCreditCard },
          { href: '/dashboard/settings', label: 'Configuración', icon: IconSettings },
        ]
      : []
  return { tabs, admin }
}

export function Sidebar({
  clinicName,
  userName,
  role,
  practitioner = false,
  individual = true,
  children,
}: {
  clinicName: string
  userName: string
  role: string
  /** The user sees patients (doctor, or an owner who practises). */
  practitioner?: boolean
  /** Independent practice: simplified navigation (no multi-doctor tooling). */
  individual?: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { tabs, admin } = navFor(role, individual)
  const roleText = role === 'owner' && practitioner ? 'Médico titular' : ROLE_LABELS[role as Role] ?? role
  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === href
      : pathname.startsWith(href) || (href === '/dashboard/patients' && pathname.startsWith('/dashboard/visits'))

  const sideItem = (item: NavItem) => {
    const active = isActive(item.href)
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors ${
          active ? 'bg-[#e6f1ee] text-[#0d6e60]' : 'text-[#6b7577] hover:bg-[#f4f6f6] hover:text-[#15201e]'
        }`}
      >
        <Icon size={20} strokeWidth={active ? 2.2 : 1.75} />
        {item.label}
      </Link>
    )
  }

  return (
    <ShellContext.Provider value={{ clinicName, userName, roleText, adminItems: admin.map(({ href, label }) => ({ href, label })) }}>
      <div className="flex min-h-screen bg-[#f4f6f6] text-[#15201e]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col gap-1 border-r border-[#e3e7e7] bg-white px-3 py-5 lg:flex">
          <Link href="/dashboard" className="flex items-center gap-2.5 px-2.5 pb-[18px] text-[#15201e] hover:text-[#15201e]">
            <span aria-hidden className="flex size-7 items-center justify-center rounded-lg bg-[#0d6e60] text-sm font-bold text-white">
              +
            </span>
            <span className="font-display text-lg font-bold tracking-[-.02em]">{APP_NAME}</span>
          </Link>
          <div className="mx-2.5 mb-3.5 rounded-[10px] border border-[#e3e7e7] bg-[#f4f6f6] px-3 py-2.5">
            <div className="text-[10px] font-semibold tracking-[.12em] text-[#6b7577] uppercase">Consultorio</div>
            <div className="mt-0.5 truncate text-[13px] font-semibold">{clinicName}</div>
          </div>
          <nav className="flex flex-col gap-1">{tabs.map(sideItem)}</nav>
          {admin.length > 0 && (
            <>
              <div className="mt-4 mb-1 px-3 text-[10px] font-semibold tracking-[.12em] text-[#6b7577] uppercase">Administración</div>
              <nav className="flex flex-col gap-1">{admin.map(sideItem)}</nav>
            </>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2.5 border-t border-[#e3e7e7] px-3 pt-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e6f1ee] text-[11px] font-semibold text-[#0d6e60]">
              {initialsOf(userName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{userName}</span>
              <span className="block text-[11px] text-[#6b7577]">{roleText}</span>
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="flex size-8 items-center justify-center rounded-md text-[#6b7577] transition-colors hover:bg-[#f4f6f6] hover:text-[#15201e]"
              >
                <IconLogout size={16} strokeWidth={1.75} />
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {children}
          {/* Mobile bottom tabs */}
          <nav
            className="fixed inset-x-0 bottom-0 z-30 grid border-t border-[#e3e7e7] bg-white px-1 pt-1.5 pb-[max(14px,env(safe-area-inset-bottom))] lg:hidden"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          >
            {tabs.map((item) => {
              const active = isActive(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-12 flex-col items-center gap-1 py-1.5 ${active ? 'text-[#0d6e60]' : 'text-[#6b7577]'}`}
                >
                  <span className={`flex h-[30px] w-[52px] items-center justify-center rounded-full ${active ? 'bg-[#e6f1ee]' : ''}`}>
                    <Icon size={22} strokeWidth={active ? 2.2 : 1.75} />
                  </span>
                  <span className="text-[10px] font-semibold">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </ShellContext.Provider>
  )
}
