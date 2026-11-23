// Practice profiles. A clinic picks one profile (stored in the tenant's
// `settings.consultTemplate` for backwards compatibility) and the profile decides
// which consultation formats — clinical-record templates — its staff can use.
// A new specialty (ophthalmology, dentistry…) is a new format module like
// nutrition.ts / massage.ts plus one entry here.
//
// Pure module so client components can import it.

import { isTherapist } from './practice'

export type ConsultFormat = 'general' | 'nutrition' | 'massage'

export const FORMAT_LABELS: Record<ConsultFormat, string> = {
  general: 'Consulta general',
  nutrition: 'Nutrición',
  massage: 'Ficha de masajes',
}

/** Short label for chips and badges. */
export const FORMAT_SHORT: Record<ConsultFormat, string> = {
  general: 'General',
  nutrition: 'Nutrición',
  massage: 'Masajes',
}

export type PracticeProfile = 'general' | 'nutrition' | 'aesthetic'

export const PROFILES: { value: PracticeProfile; label: string; hint: string; formats: ConsultFormat[] }[] = [
  {
    value: 'general',
    label: 'Medicina general',
    hint: 'Consulta con signos vitales, examen físico, diagnóstico y receta.',
    formats: ['general'],
  },
  {
    value: 'nutrition',
    label: 'Nutrición',
    hint: 'Agrega antropometría, laboratorio y la hoja de seguimiento de peso.',
    formats: ['nutrition', 'general'],
  },
  {
    value: 'aesthetic',
    label: 'Estética y spa',
    hint: 'Consulta médica, nutrición y la ficha técnica de masajes con consentimiento.',
    formats: ['general', 'nutrition', 'massage'],
  },
]

export const ALL_FORMATS = Object.keys(FORMAT_LABELS) as ConsultFormat[]

type TenantLike = { settings?: { consultTemplate?: string | null } | null } | null | undefined
type UserLike = { role?: string | null } | null | undefined

export function asProfile(value: unknown): PracticeProfile {
  return PROFILES.some((p) => p.value === value) ? (value as PracticeProfile) : 'general'
}

export function practiceProfile(tenant: TenantLike): PracticeProfile {
  return asProfile(tenant?.settings?.consultTemplate)
}

export function profileFormats(tenant: TenantLike): ConsultFormat[] {
  return PROFILES.find((p) => p.value === practiceProfile(tenant))!.formats
}

/** Formats this user may record in this clinic. Therapists only fill session sheets. */
export function formatsFor(tenant: TenantLike, user: UserLike): ConsultFormat[] {
  if (isTherapist(user)) return ['massage']
  return profileFormats(tenant)
}

export function hasFormat(tenant: TenantLike, format: ConsultFormat): boolean {
  return profileFormats(tenant).includes(format)
}

export function asFormat(value: unknown): ConsultFormat | null {
  return ALL_FORMATS.includes(value as ConsultFormat) ? (value as ConsultFormat) : null
}
