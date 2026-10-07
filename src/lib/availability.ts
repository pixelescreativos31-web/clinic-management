// Per-doctor availability — the single source of truth for who can be booked when.
// Doctors are `regular` (set weekdays + a daily window), `onCall` (any time), or
// `byAppointment` (any time, but hidden from the auto "available doctors" finder —
// e.g. visiting surgeons). Shared by the booking action, the finder, and the Day Rail.

import { ALL_DAYS } from './constants'

export const DEFAULT_FROM = '09:00'
export const DEFAULT_TO = '17:00'

/** "HH:mm" → minutes from midnight. */
export function hhmmToMinutes(s?: string | null): number {
  if (!s) return 0
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Minutes-from-midnight of a UTC Date as seen in `tz`. */
export function minutesInTz(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' })
  const map: Record<string, number> = {}
  for (const p of dtf.formatToParts(date)) if (p.type !== 'literal') map[p.type] = Number(p.value)
  return (map.hour === 24 ? 0 : map.hour) * 60 + map.minute
}

export type DoctorWindow = { from: string; to: string }

export function windowOf(doctor: { availableFrom?: string | null; availableTo?: string | null }): DoctorWindow {
  return { from: doctor.availableFrom || DEFAULT_FROM, to: doctor.availableTo || DEFAULT_TO }
}

/** Pretty "9:00 am – 5:00 pm" for a window (24h input). */
export function formatWindow(win: DoctorWindow): string {
  const fmt = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    const ampm = h < 12 ? 'am' : 'pm'
    const hr = h % 12 === 0 ? 12 : h % 12
    return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
  }
  return `${fmt(win.from)} – ${fmt(win.to)}`
}

/**
 * Is the appointment [start, end] fully inside the doctor's window, in tenant tz?
 */
export function isWithinWindow(
  start: Date,
  end: Date,
  win: DoctorWindow,
  tz: string,
): boolean {
  const startMin = minutesInTz(start, tz)
  // end can land exactly on/after midnight visually; compute via duration to keep it on the same day.
  const endMin = startMin + Math.round((end.getTime() - start.getTime()) / 60000)
  const fromMin = hhmmToMinutes(win.from)
  const toMin = hhmmToMinutes(win.to)
  return startMin >= fromMin && endMin <= toMin
}

/** 3-letter lowercase weekday ("mon") of a UTC Date as seen in `tz`. */
export function weekdayInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
    .format(date)
    .toLowerCase()
    .slice(0, 3)
}

export type AvailabilityTag = 'regular' | 'onCall' | 'byAppointment'

export type DoctorAvailability = {
  availabilityType?: string | null
  availableDays?: string[] | null
  availableFrom?: string | null
  availableTo?: string | null
}

export type AvailabilityCheck = {
  /** Can this appointment be booked at all? (regular doctors are blocked off-window.) */
  bookable: boolean
  /** Should this doctor appear in the auto "available doctors at this time" finder? */
  inFinder: boolean
  tag: AvailabilityTag
  /** Human note: window text, "On call", or why it's blocked. */
  reason?: string
}

/** Decide whether a doctor can take an appointment at [start, end] (tenant tz). */
export function checkAvailability(
  doctor: DoctorAvailability,
  start: Date,
  end: Date,
  tz: string,
): AvailabilityCheck {
  const type = (doctor.availabilityType || 'regular') as AvailabilityTag

  if (type === 'onCall') {
    return { bookable: true, inFinder: true, tag: 'onCall', reason: 'De guardia' }
  }
  if (type === 'byAppointment') {
    return { bookable: true, inFinder: false, tag: 'byAppointment', reason: 'Previa cita' }
  }

  // regular: must be on an available weekday AND inside the daily window.
  const days = doctor.availableDays?.length ? doctor.availableDays : ALL_DAYS
  const day = weekdayInTz(start, tz)
  if (!days.includes(day)) {
    return { bookable: false, inFinder: false, tag: 'regular', reason: 'No disponible este día' }
  }
  const win = windowOf(doctor)
  if (!isWithinWindow(start, end, win, tz)) {
    return { bookable: false, inFinder: false, tag: 'regular', reason: `Disponible de ${formatWindow(win).replace(' – ', ' a ')}` }
  }
  return { bookable: true, inFinder: true, tag: 'regular', reason: formatWindow(win) }
}
