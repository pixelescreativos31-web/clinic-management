// Appointment status → label + colours for the redesigned app (design handoff
// "Estados de cita"). Pure, so server and client components share it.

import type { AppointmentStatus } from './constants'

export type StatusStyle = { label: string; bg: string; fg: string }

export function apptStatusStyle(status: AppointmentStatus, opts: { isWalkIn?: boolean; token?: string | null } = {}): StatusStyle {
  switch (status) {
    case 'scheduled':
      return { label: 'Programada', bg: '#f0eeec', fg: '#44403c' }
    case 'checked-in':
      return opts.isWalkIn
        ? { label: opts.token ? `Sin cita ${opts.token}` : 'Sin cita', bg: '#1d4ed8', fg: '#ffffff' }
        : { label: 'En sala', bg: '#1d4ed8', fg: '#ffffff' }
    case 'completed':
      return { label: 'Atendida', bg: '#e8f4ec', fg: '#15803d' }
    case 'no-show':
      return { label: 'No asistió', bg: '#1c1917', fg: '#ffffff' }
    default:
      return { label: 'Cancelada', bg: '#f0eeec', fg: '#57534e' }
  }
}

const AVATARS: [string, string][] = [
  ['#e6f1ee', '#0f766e'],
  ['#e9f0f9', '#1d4ed8'],
  ['#faf3e6', '#b45309'],
  ['#e8f4ec', '#15803d'],
]

/** Stable avatar tint per name. */
export function avatarTint(name: string): { bg: string; fg: string } {
  const [bg, fg] = AVATARS[((name.charCodeAt(0) || 0) + name.length) % AVATARS.length]
  return { bg, fg }
}

/** "Dra. Carmen Rosario" → "CR". */
export function initialsOf(name: string): string {
  return (
    name
      .replace(/^Dr[a]?\.?\s+/i, '')
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '•'
  )
}
