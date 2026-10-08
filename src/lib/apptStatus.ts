// Appointment status → label + colours for the redesigned app (design handoff
// "Estados de cita"). Pure, so server and client components share it.

import type { AppointmentStatus } from './constants'

export type StatusStyle = { label: string; bg: string; fg: string }

export function apptStatusStyle(status: AppointmentStatus, opts: { isWalkIn?: boolean; token?: string | null } = {}): StatusStyle {
  switch (status) {
    case 'scheduled':
      return { label: 'Programada', bg: '#e6f1ee', fg: '#0d6e60' }
    case 'checked-in':
      return opts.isWalkIn
        ? { label: opts.token ? `Sin cita ${opts.token}` : 'Sin cita', bg: '#e9f0f9', fg: '#2563ab' }
        : { label: 'En sala', bg: '#e9f0f9', fg: '#2563ab' }
    case 'completed':
      return { label: 'Atendido', bg: '#e8f4ec', fg: '#1a7a50' }
    case 'no-show':
      return { label: 'No asistió', bg: '#faf3e6', fg: '#b45309' }
    default:
      return { label: 'Cancelada', bg: '#eef1f1', fg: '#6b7577' }
  }
}

const AVATARS: [string, string][] = [
  ['#e6f1ee', '#0d6e60'],
  ['#e9f0f9', '#2563ab'],
  ['#faf3e6', '#b45309'],
  ['#e8f4ec', '#1a7a50'],
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
