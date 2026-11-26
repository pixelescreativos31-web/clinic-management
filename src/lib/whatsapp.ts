// WhatsApp deep links (v3 spec §6.2). Zero-API reminders: the assistant clicks
// a wa.me link and WhatsApp opens with the message prefilled. Pure helpers — safe
// to use on either side of the server/client boundary.

/**
 * Calling code per tenant currency, used only for numbers written with a national
 * trunk "0" prefix. Patient phones are stored loosely normalised (digits, optional
 * leading +). A `+`-prefixed number always wins over this guess.
 */
const CALLING_CODES: Record<string, string> = {
  DOP: '1',
  USD: '1',
}

/**
 * Dominican Republic (launch market). DR numbers are part of the North American
 * Numbering Plan: country code 1 + area code 809, 829 or 849 + 7 digits, written
 * locally WITHOUT a trunk "0" (e.g. "809-555-1234"). A 10-digit number on one of
 * those area codes therefore gets the "1" prefix for wa.me ("18095551234"),
 * whatever the tenant's currency — those area codes are DR-only.
 */
const DR_AREA_CODES = ['809', '829', '849']

/** International digits for wa.me (no +), or null when the phone is unusable. */
export function toWaDigits(phone: string | null | undefined, currency?: string | null): string | null {
  if (!phone) return null
  const trimmed = phone.trim()
  const digits = trimmed.replace(/[^0-9]/g, '')
  if (digits.length < 8) return null

  if (trimmed.startsWith('+')) return digits
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.length === 10 && DR_AREA_CODES.includes(digits.slice(0, 3))) return `1${digits}`
  if (digits.startsWith('0')) {
    const code = currency ? CALLING_CODES[currency] : undefined
    return code ? `${code}${digits.slice(1)}` : null
  }
  return digits // already international (e.g. "18095551234")
}

/** Prefilled wa.me reminder link, or null when the phone can't be dialled. */
export function waReminderLink({
  phone,
  currency,
  doctorName,
  clinicName,
  dateLabel,
  timeLabel,
}: {
  phone: string | null | undefined
  currency?: string | null
  doctorName: string
  clinicName: string
  dateLabel: string
  timeLabel: string
}): string | null {
  const digits = toWaDigits(phone, currency)
  if (!digits) return null
  const text = `Recordatorio: su cita con ${doctorName} en ${clinicName} es el ${dateLabel} a las ${timeLabel}.`
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
