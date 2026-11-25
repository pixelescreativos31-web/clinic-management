'use client'

// App shell navigation — design_handoff_medira "medira App" shell ("Clinical Calm").
// Desktop (≥1024px): fixed 232px white sidebar, text-only items grouped
// Clínica / Dinero / Administrar, user + clinic at the bottom.
// Phone: 64px bottom bar with Panel, Agenda, Pacientes, Caja and «Más» (a sheet
// with the rest of the menu and sign-out). No icons: every action is a word.

import { createContext, useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAction } from '@/app/(frontend)/login/actions'
import { APP_NAME } from '@/lib/brand'
import { ROLE_LABELS, type Role } from '@/lib/constants'

export type NavItem = { href: string; label: string }
export type NavGroup = { label: string; items: NavItem[] }

export type ShellInfo = {
  clinicName: string
  userName: string
  roleText: string
  adminItems: { href: string; label: string }[]
  groups: NavGroup[]
}

const ShellContext = createContext<ShellInfo | null>(null)
export const useShell = () => useContext(ShellContext)

/** Menu per role. Same pages and permissions as before; only grouping and names follow the spec (16.1). */
export function navFor(role: string, individual: boolean) {
  const clinica: NavItem[] = [
    { href: '/dashboard', label: 'Panel' },
    { href: '/dashboard/appointments', label: 'Agenda' },
    { href: '/dashboard/patients', label: 'Pacientes' },
  ]
  const dinero: NavItem[] = [{ href: '/dashboard/invoices', label: 'Caja' }]
  // Money reports stay owner-only (sensitive figures).
  if (role === 'owner') dinero.push({ href: '/dashboard/reports', label: 'Informes' })
  const admin: NavItem[] =
    role === 'owner'
      ? [
          // An independent doctor manages at most an assistant — "Equipo" reads heavy.
          { href: '/dashboard/staff', label: individual ? 'Asistente' : 'Equipo' },
          { href: '/dashboard/activity', label: 'Auditoría' },
          { href: '/dashboard/settings', label: 'Configuración' },
          { href: '/dashboard/plan', label: 'Mi plan' },
        ]
      : []
  const groups: NavGroup[] = [
    { label: 'Clínica', items: clinica },
    { label: 'Dinero', items: dinero },
    ...(admin.length ? [{ label: 'Administrar', items: admin }] : []),
  ]
  // Phone bottom bar: the four daily destinations; everything else lives under «Más».
  const tabs = [...clinica, dinero[0]]
  return { tabs, admin, groups }
}

export function isActivePath(pathname: string, href: string) {
  return href === '/dashboard'
    ? pathname === href
    : pathname.startsWith(href) || (href === '/dashboard/patients' && pathname.startsWith('/dashboard/visits'))
}

function MoreSheet({ onClose, shell }: { onClose: () => void; shell: ShellInfo }) {
  const pathname = usePathname()
  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-[rgba(28,25,23,.45)]" />
      <div
        role="dialog"
        aria-label="Menú"
        className="absolute inset-x-0 bottom-0 max-h-[85vh] animate-[md-up_.2s_ease-out] overflow-y-auto rounded-t-2xl bg-white px-4 pt-2.5 pb-[max(20px,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mx-auto mb-2 block h-1 w-10 rounded-full bg-[#d6d3d1]" />
        <div className="px-2 pb-1">
          <div className="truncate text-[15px] font-semibold">{shell.userName}</div>
          <div className="truncate text-[13px] text-[#57534e]">
            {shell.roleText} · {shell.clinicName}
          </div>
        </div>
        {shell.groups.map((g) => (
          <div key={g.label}>
            <div className="px-2 pt-3.5 pb-1.5 text-xs font-medium text-[#57534e]">{g.label}</div>
            {g.items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                onClick={onClose}
                aria-current={isActivePath(pathname, i.href) ? 'page' : undefined}
                className={`flex min-h-11 items-center rounded-lg px-2.5 text-[15px] text-[#1c1917] hover:bg-[#f0eeec] hover:text-[#1c1917] ${isActivePath(pathname, i.href) ? 'bg-[#f0eeec] font-semibold' : ''}`}
              >
                {i.label}
              </Link>
            ))}
          </div>
        ))}
        <form action={logoutAction} className="mt-2 border-t border-[#e7e5e4] pt-2">
          <button type="submit" className="flex min-h-11 w-full items-center rounded-lg px-2.5 text-[15px] font-medium text-[#1c1917] hover:bg-[#f0eeec]">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>,
    document.body,
  )
}

export function Sidebar({
  clinicName,
  clinicLogo,
  userName,
  role,
  practitioner = false,
  individual = true,
  children,
}: {
  clinicName: string
  /** Data-URL logo shown above the clinic name. */
  clinicLogo?: string | null
  userName: string
  role: string
  /** The user sees patients (doctor, or an owner who practises). */
  practitioner?: boolean
  /** Independent practice: simplified navigation (no multi-doctor tooling). */
  individual?: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [more, setMore] = useState(false)
  const { tabs, admin, groups } = navFor(role, individual)
  const roleText = role === 'owner' && practitioner ? 'Titular · atiende pacientes' : (ROLE_LABELS[role as Role] ?? role)
  const shell: ShellInfo = { clinicName, userName, roleText, adminItems: admin, groups }
  const inTabs = tabs.some((t) => isActivePath(pathname, t.href))

  return (
    <ShellContext.Provider value={shell}>
      <div className="flex min-h-screen bg-[#fafaf7] text-[#1c1917]">
        <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-[#e7e5e4] bg-white lg:flex">
          <Link href="/dashboard" className="flex h-14 items-center px-5 text-[21px] font-semibold tracking-[-.04em] text-[#1c1917] hover:text-[#1c1917]">
            {APP_NAME}
          </Link>
          <nav className="flex-1 overflow-y-auto px-3 pt-1 pb-3">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="px-2 pt-3.5 pb-1.5 text-xs font-medium text-[#57534e]">{g.label}</div>
                {g.items.map((item) => {
                  const active = isActivePath(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-9 items-center rounded-lg px-2.5 text-sm text-[#1c1917] transition-colors hover:bg-[#f0eeec] hover:text-[#1c1917] ${active ? 'bg-[#f0eeec] font-semibold' : ''}`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>
          <div className="border-t border-[#e7e5e4] p-3">
            {clinicLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clinicLogo} alt={clinicName} title={clinicName} className="mb-2 max-h-12 w-auto px-2" />
            )}
            <div className="truncate px-2 text-sm font-semibold">{userName}</div>
            <div className="truncate px-2 text-xs text-[#57534e]">{roleText}</div>
            <div className="truncate px-2 text-xs text-[#57534e]">{clinicName}</div>
            <form action={logoutAction} className="mt-2.5">
              <button
                type="submit"
                className="h-8 w-full rounded-lg border border-[#d6d3d1] bg-white text-[13px] font-medium text-[#1c1917] transition-colors hover:border-[#a8a29e]"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {children}
          <nav
            aria-label="Navegación principal"
            className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-[#e7e5e4] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
          >
            {tabs.map((item) => {
              const active = isActivePath(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center justify-center text-[13px] ${active ? 'font-semibold text-[#0f766e]' : 'font-medium text-[#57534e]'}`}
                >
                  {item.label}
                </Link>
              )
            })}
            <button
              type="button"
              onClick={() => setMore(true)}
              aria-haspopup="dialog"
              className={`text-[13px] ${!inTabs ? 'font-semibold text-[#0f766e]' : 'font-medium text-[#57534e]'}`}
            >
              Más
            </button>
          </nav>
          {more && <MoreSheet shell={shell} onClose={() => setMore(false)} />}
        </div>
      </div>
    </ShellContext.Provider>
  )
}
