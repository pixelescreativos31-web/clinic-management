import { describe, expect, it } from 'vitest'
import {
  clockLabel,
  compactClock,
  dateTimeLabel,
  DEFAULT_REGIONAL,
  endSentence,
  heightIn,
  heightToCm,
  hhmmLabel,
  regionalOf,
  sortByWeek,
  weekOrder,
  weekStartsOn,
  weightIn,
  weightLabel,
  weightToKg,
} from '@/lib/regional'
import { formatWindow } from '@/lib/availability'
import { formatTime } from '@/lib/format'
import { fmtDelta, fmtWeight } from '@/lib/program'
import { WEEKDAYS } from '@/lib/constants'

describe('regional defaults', () => {
  it('defaults to 12 h, Sunday, lb and cm for clinics that never set them', () => {
    expect(DEFAULT_REGIONAL).toEqual({ timeFormat: '12h', weekStart: 'sunday', weightUnit: 'lb', heightUnit: 'cm' })
    expect(regionalOf(null)).toEqual(DEFAULT_REGIONAL)
    expect(regionalOf({ settings: { timeFormat: 'bogus', weekStart: null } })).toEqual(DEFAULT_REGIONAL)
  })
  it('reads the clinic choices', () => {
    expect(regionalOf({ settings: { timeFormat: '24h', weekStart: 'monday', weightUnit: 'kg', heightUnit: 'in' } })).toEqual({
      timeFormat: '24h',
      weekStart: 'monday',
      weightUnit: 'kg',
      heightUnit: 'in',
    })
  })
})

describe('clock', () => {
  it('12 h by default, 24 h on request', () => {
    expect(clockLabel(14, 30)).toBe('2:30 p. m.')
    expect(clockLabel(0, 5)).toBe('12:05 a. m.')
    expect(clockLabel(14, 30, '24h')).toBe('14:30')
    expect(hhmmLabel('09:00', '24h')).toBe('09:00')
    expect(compactClock(14 * 60 + 30)).toBe('2:30')
    expect(compactClock(14 * 60 + 30, '24h')).toBe('14:30')
  })
  it('formats windows and tenant times in the clinic format', () => {
    expect(formatWindow({ from: '09:00', to: '17:00' })).toBe('9:00 am – 5:00 pm')
    expect(formatWindow({ from: '09:00', to: '17:00' }, '24h')).toBe('09:00 – 17:00')
    const d = '2026-11-26T18:30:00Z' // 2:30 p. m. in Santo Domingo
    expect(formatTime(d, { settings: { timezone: 'America/Santo_Domingo', timeFormat: '24h' } })).toBe('14:30')
    expect(formatTime(d, { settings: { timezone: 'America/Santo_Domingo' } })).toMatch(/^2:30\s?p/)
  })
  it('builds date + time without a double period', () => {
    const s = dateTimeLabel('2026-11-28T00:16:00Z', 'America/Santo_Domingo')
    expect(s).toBe('27 de noviembre de 2026, 8:16 p. m.')
    expect(endSentence(`Hasta el ${s}`)).toBe(`Hasta el ${s}`)
    expect(endSentence('Hasta el 27 de noviembre')).toBe('Hasta el 27 de noviembre.')
    expect(dateTimeLabel('2026-11-28T00:16:00Z', 'America/Santo_Domingo', '24h', { year: false })).toBe('27 de noviembre, 20:16')
  })
})

describe('week', () => {
  it('Sunday first by default, Monday on request', () => {
    expect(weekOrder()).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])
    expect(weekOrder('monday')[0]).toBe('mon')
    expect(weekOrder('monday')[6]).toBe('sun')
    expect(weekStartsOn()).toBe(0)
    expect(weekStartsOn('monday')).toBe(1)
    expect(sortByWeek(WEEKDAYS, 'monday').map((d) => d.value)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  })
})

describe('measurements (stored in kg / cm)', () => {
  it('round-trips weight and height', () => {
    expect(weightIn(75, 'lb')).toBeCloseTo(165.3, 1)
    expect(weightIn(75, 'kg')).toBe(75)
    expect(weightToKg(165.3, 'lb')).toBeCloseTo(74.98, 1)
    expect(weightToKg(75, 'kg')).toBe(75)
    expect(heightIn(170, 'in')).toBeCloseTo(66.9, 1)
    expect(heightToCm(66.9, 'in')).toBeCloseTo(169.9, 0)
  })
  it('shows the clinic unit first and the other alongside', () => {
    expect(weightLabel(75, 'lb')).toBe('165.3 lb · 75.0 kg')
    expect(weightLabel(75, 'kg')).toBe('75.0 kg · 165.3 lb')
    expect(fmtWeight(75)).toBe('165.3 lb · 75.0 kg')
    expect(fmtWeight(75, 'kg')).toBe('75.0 kg · 165.3 lb')
    expect(fmtDelta(-1.5, 'kg')).toBe('−1.5 kg (−3.3 lb)')
    expect(fmtDelta(-1.5)).toBe('−3.3 lb (−1.5 kg)')
  })
})
