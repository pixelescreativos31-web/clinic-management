// Practice profiles. A clinic picks one base profile (stored in the tenant's
// `settings.consultTemplate` for backwards compatibility); it decides the formats —
// clinical-record templates — of staff who have no specialty of their own. A doctor
// with a specialty (user.specialtyKey, see ./specialties) records that specialty's
// formats instead, so one clinic can host an ophthalmologist and a pediatrician.
// A new specialty sheet is a field-list module (like massage.ts, built on ./sheet)
// plus its format here and its entry in ./specialties.
//
// Pure module so client components can import it.

import { isTherapist } from './practice'
import { specialtyByKey } from './specialties'

export type ConsultFormat = 'general' | 'nutrition' | 'massage' | 'program'

export const FORMAT_LABELS: Record<ConsultFormat, string> = {
  general: 'Consulta general',
  nutrition: 'Nutrición',
  massage: 'Ficha de masajes',
  program: 'Control del programa',
}

/** Short label for chips and badges. */
export const FORMAT_SHORT: Record<ConsultFormat, string> = {
  general: 'General',
  nutrition: 'Nutrición',
  massage: 'Masajes',
  program: 'Programa',
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
    hint: 'Antropometría, laboratorio, hoja de seguimiento y programa de control de peso.',
    formats: ['nutrition', 'general', 'program'],
  },
  {
    value: 'aesthetic',
    label: 'Estética y spa',
    hint: 'Consulta médica, nutrición, programa de control de peso y ficha de masajes con consentimiento.',
    formats: ['general', 'nutrition', 'program', 'massage'],
  },
]

export const ALL_FORMATS = Object.keys(FORMAT_LABELS) as ConsultFormat[]

type TenantLike = { settings?: { consultTemplate?: string | null } | null } | null | undefined
type UserLike = { role?: string | null; specialtyKey?: string | null } | null | undefined

export function asProfile(value: unknown): PracticeProfile {
  return PROFILES.some((p) => p.value === value) ? (value as PracticeProfile) : 'general'
}

export function practiceProfile(tenant: TenantLike): PracticeProfile {
  return asProfile(tenant?.settings?.consultTemplate)
}

export function profileFormats(tenant: TenantLike): ConsultFormat[] {
  return PROFILES.find((p) => p.value === practiceProfile(tenant))!.formats
}

/**
 * Formats this user may record in this clinic. Therapists only fill session sheets;
 * a doctor with a specialty records that specialty's formats; everyone else follows
 * the clinic's base profile. The weight-management programme is a clinic-level
 * service, so its control is only offered where the clinic's profile runs one.
 */
export function formatsFor(tenant: TenantLike, user: UserLike): ConsultFormat[] {
  if (isTherapist(user)) return ['massage']
  const specialty = specialtyByKey(user?.specialtyKey)
  if (!specialty) return profileFormats(tenant)
  const clinicProgram = hasProgram(tenant)
  return specialty.formats.filter((f) => f !== 'program' || clinicProgram)
}

export function hasFormat(tenant: TenantLike, format: ConsultFormat): boolean {
  return profileFormats(tenant).includes(format)
}

export function asFormat(value: unknown): ConsultFormat | null {
  return ALL_FORMATS.includes(value as ConsultFormat) ? (value as ConsultFormat) : null
}

/** Does the clinic run a follow-up programme (enrolment + weekly controls)? */
export const hasProgram = (tenant: TenantLike) => hasFormat(tenant, 'program')

/**
 * Format a new consultation opens with. A patient in an active programme starts on
 * its control; otherwise the professional's own default (if the clinic offers it),
 * else the profile's first format. `program` is only offered with an active programme.
 */
export function initialFormat(available: ConsultFormat[], opts: { activeProgram: boolean; userDefault?: string | null }): ConsultFormat {
  if (opts.activeProgram && available.includes('program')) return 'program'
  const own = asFormat(opts.userDefault)
  if (own && own !== 'program' && available.includes(own)) return own
  return available.find((f) => f !== 'program') ?? available[0]
}
