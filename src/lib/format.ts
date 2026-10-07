// Single source of truth for displaying money, dates and times. Every amount and
// time in the UI flows through here so currency symbols and timezones are never
// hardcoded — they come from the tenant's settings (spec §8.6).

import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from './constants'
import { APP_LOCALE } from './brand'

type TenantLike =
  | {
      settings?: { currency?: string | null; timezone?: string | null } | null
    }
  | null
  | undefined

const currencyOf = (tenant: TenantLike): string => tenant?.settings?.currency || DEFAULT_CURRENCY
const timezoneOf = (tenant: TenantLike): string => tenant?.settings?.timezone || DEFAULT_TIMEZONE

/** Format an amount in the tenant's currency, e.g. "RD$1,500" / "US$1,500". */
export function formatMoney(amount: number, tenant: TenantLike): string {
  const currency = currencyOf(tenant)
  try {
    return new Intl.NumberFormat(APP_LOCALE, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString(APP_LOCALE)}`
  }
}

const toDate = (value: Date | string): Date => (value instanceof Date ? value : new Date(value))

/** "5:30 p. m." in the tenant's timezone (lowercase, no leading zero). */
export function formatTime(value: Date | string, tenant: TenantLike): string {
  return toDate(value)
    .toLocaleTimeString(APP_LOCALE, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezoneOf(tenant),
    })
    .toLowerCase()
}

/** "mar, 10 jun" in the tenant's timezone. */
export function formatDate(value: Date | string, tenant: TenantLike): string {
  return toDate(value).toLocaleDateString(APP_LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: timezoneOf(tenant),
  })
}

/** "mar, 10 jun · 5:30 p. m." */
export function formatDateTime(value: Date | string, tenant: TenantLike): string {
  return `${formatDate(value, tenant)} · ${formatTime(value, tenant)}`
}

/** YYYY-MM-DD for a Date as seen in the tenant's timezone (for grouping by day). */
export function tenantDayKey(value: Date | string, tenant: TenantLike): string {
  return toDate(value).toLocaleDateString('en-CA', { timeZone: timezoneOf(tenant) })
}

/** "10 de junio de 2026" — long date for printed documents. */
export function formatLongDate(value: Date | string, tenant: TenantLike): string {
  return toDate(value).toLocaleDateString(APP_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezoneOf(tenant),
  })
}

/** Compute age in whole years from a date of birth. */
export function ageFromDOB(dob: Date | string): number {
  const d = toDate(dob)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}
