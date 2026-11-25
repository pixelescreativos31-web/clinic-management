// The two profile axes (docs/feedback-igaleno-y-oftalmologia.md, Parte III):
//
//   macro — ORGANIZATION TYPE per clinic (tenant.settings.orgType): consultorio,
//           clínica estética, clínica de especialidades, policlínica, hospital.
//           Drives onboarding, the suggested specialties and (later) plans/modules.
//   micro — SPECIALTY per professional (user.specialtyKey): drives which clinical
//           sheets (consultation formats) that doctor records.
//
// A specialty either ships its own sheet(s) (`ready`) or, until its template lands,
// records the general consultation — so a doctor can pick «Oftalmología» today and
// automatically get the ophthalmology sheet the day it ships, without migrating data.
//
// Pure module so client components can import it.

import type { ConsultFormat, PracticeProfile } from './profiles'

export type SpecialtyKey =
  // Nivel 0 — ready
  | 'general'
  | 'internal'
  | 'family'
  | 'nutrition'
  | 'aesthetic'
  // Nivel 0 — in progress
  | 'ophthalmology'
  // Nivel 1
  | 'dentistry'
  | 'obgyn'
  | 'pediatrics'
  | 'dermatology'
  // Nivel 2
  | 'physiotherapy'
  | 'mentalHealth'
  | 'cardiology'
  | 'endocrinology'
  | 'neurology'
  // Nivel 3
  | 'plasticSurgery'
  | 'orthopedics'
  | 'ent'
  | 'gastro'
  | 'urology'
  | 'pulmonology'
  | 'podiatry'
  | 'optometry'
  | 'occupational'

export type Specialty = {
  key: SpecialtyKey
  /** Display name; also the default letterhead title. */
  label: string
  /** Build priority (0 = ready/now … 3 = complete the catalogue). */
  tier: 0 | 1 | 2 | 3
  /** Consultation formats this specialty records. */
  formats: ConsultFormat[]
  /** Has its own clinical sheet today; otherwise it uses the general consultation. */
  ready: boolean
  hint: string
}

const GENERAL: ConsultFormat[] = ['general']

const s = (key: SpecialtyKey, label: string, tier: Specialty['tier'], hint: string, formats?: ConsultFormat[]): Specialty => ({
  key,
  label,
  tier,
  hint,
  formats: formats ?? GENERAL,
  ready: Boolean(formats) || key === 'general' || key === 'internal' || key === 'family',
})

export const SPECIALTIES: Specialty[] = [
  s('general', 'Medicina general', 0, 'Signos vitales, examen físico, diagnóstico y receta.'),
  s('internal', 'Medicina interna', 0, 'Consulta del adulto con signos vitales, laboratorio y receta.'),
  s('family', 'Medicina familiar', 0, 'Consulta para todas las edades con seguimiento.'),
  s('nutrition', 'Nutrición', 0, 'Antropometría, laboratorio, seguimiento y programa de control de peso.', ['nutrition', 'general', 'program']),
  s('aesthetic', 'Medicina estética', 0, 'Consulta médica, nutrición, programa de control de peso y ficha de masajes.', ['general', 'nutrition', 'program', 'massage']),
  s('ophthalmology', 'Oftalmología', 0, 'Agudeza visual, refracción, PIO y fondo de ojo por ojo (OD/OI); receta de lentes.'),
  s('dentistry', 'Odontología', 1, 'Odontograma por pieza y plan de tratamiento.'),
  s('obgyn', 'Ginecología y obstetricia', 1, 'Control prenatal (FUM, FPP, semanas), citología y ecografías.'),
  s('pediatrics', 'Pediatría', 1, 'Curvas de crecimiento, vacunas y desarrollo.'),
  s('dermatology', 'Dermatología', 1, 'Mapa de lesiones con fotos y procedimientos.'),
  s('physiotherapy', 'Fisioterapia', 2, 'Evaluación funcional, escalas de dolor y plan de sesiones.'),
  s('mentalHealth', 'Psicología y psiquiatría', 2, 'Escalas (PHQ-9, GAD-7), notas de sesión privadas y plan terapéutico.'),
  s('cardiology', 'Cardiología', 2, 'Factores de riesgo, ECG y ecocardiograma.'),
  s('endocrinology', 'Endocrinología', 2, 'Diabetes, tiroides y control metabólico con tendencias.'),
  s('neurology', 'Neurología', 2, 'Examen neurológico por sistemas y escalas.'),
  s('plasticSurgery', 'Cirugía plástica', 3, 'Valoración, fotos antes/después y consentimiento quirúrgico.'),
  s('orthopedics', 'Ortopedia y traumatología', 3, 'Examen osteoarticular, imágenes y seguimiento posquirúrgico.'),
  s('ent', 'Otorrinolaringología', 3, 'Oído, nariz y garganta; audiometría.'),
  s('gastro', 'Gastroenterología', 3, 'Síntomas digestivos y endoscopías.'),
  s('urology', 'Urología', 3, 'Síntomas urinarios, PSA e imágenes.'),
  s('pulmonology', 'Neumología', 3, 'Espirometría y función respiratoria.'),
  s('podiatry', 'Podología', 3, 'Evaluación del pie y procedimientos.'),
  s('optometry', 'Optometría', 3, 'Refracción y receta de lentes.'),
  s('occupational', 'Medicina ocupacional', 3, 'Evaluaciones pre-empleo y periódicas.'),
]

export const SPECIALTY_TIER_LABELS: Record<Specialty['tier'], string> = {
  0: 'Disponibles',
  1: 'Próximas plantillas',
  2: 'Siguiente ola',
  3: 'Catálogo completo',
}

export function asSpecialty(value: unknown): SpecialtyKey | null {
  return SPECIALTIES.some((x) => x.key === value) ? (value as SpecialtyKey) : null
}

export function specialtyByKey(key: unknown): Specialty | null {
  return SPECIALTIES.find((x) => x.key === key) ?? null
}

export const specialtyLabel = (key: unknown): string => specialtyByKey(key)?.label ?? ''

// ── Macro axis: organization type ──────────────────────────────────────────────

export type OrgType = 'consultorio' | 'estetica' | 'especialidades' | 'policlinica' | 'hospital'

export type OrgTypeDef = {
  value: OrgType
  label: string
  hint: string
  /** `individual` hides multi-doctor tooling (see practice.ts). */
  practiceType: 'individual' | 'clinic'
  /** Clinic-wide base profile (settings.consultTemplate) for staff with no specialty. */
  profile: PracticeProfile
  /** Specialties offered first in onboarding / staff forms. */
  suggested: SpecialtyKey[]
}

export const ORG_TYPES: OrgTypeDef[] = [
  {
    value: 'consultorio',
    label: 'Consultorio independiente',
    hint: 'Un médico con su asistente.',
    practiceType: 'individual',
    profile: 'general',
    suggested: ['general', 'internal', 'nutrition', 'ophthalmology', 'pediatrics', 'obgyn', 'dermatology', 'dentistry'],
  },
  {
    value: 'estetica',
    label: 'Clínica estética / spa',
    hint: 'Medicina estética, nutrición, programas y terapeutas (masajes, cosmetología).',
    practiceType: 'clinic',
    profile: 'aesthetic',
    suggested: ['aesthetic', 'nutrition', 'dermatology', 'plasticSurgery', 'general'],
  },
  {
    value: 'especialidades',
    label: 'Clínica de especialidades',
    hint: 'Varios especialistas; cada médico trabaja con la ficha de su especialidad.',
    practiceType: 'clinic',
    profile: 'general',
    suggested: ['general', 'internal', 'ophthalmology', 'obgyn', 'pediatrics', 'cardiology', 'dermatology', 'neurology'],
  },
  {
    value: 'policlinica',
    label: 'Policlínica / centro médico',
    hint: 'Muchas especialidades, laboratorio e imágenes.',
    practiceType: 'clinic',
    profile: 'general',
    suggested: ['general', 'internal', 'pediatrics', 'obgyn', 'cardiology', 'orthopedics', 'gastro', 'urology'],
  },
  {
    value: 'hospital',
    label: 'Hospital',
    hint: 'Internamiento y emergencias (plan institucional, a la medida).',
    practiceType: 'clinic',
    profile: 'general',
    suggested: ['general', 'internal', 'pediatrics', 'obgyn', 'cardiology', 'neurology'],
  },
]

export function asOrgType(value: unknown): OrgType | null {
  return ORG_TYPES.some((o) => o.value === value) ? (value as OrgType) : null
}

export const orgTypeDef = (value: OrgType): OrgTypeDef => ORG_TYPES.find((o) => o.value === value)!

type TenantLike =
  | { practiceType?: string | null; settings?: { orgType?: string | null; consultTemplate?: string | null } | null }
  | null
  | undefined

/**
 * The clinic's organization type: the stored one, else derived from what older
 * tenants already have (an aesthetic profile ⇒ clínica estética; an individual
 * practice ⇒ consultorio; any other clinic ⇒ clínica de especialidades).
 */
export function orgTypeOf(tenant: TenantLike): OrgType {
  const stored = asOrgType(tenant?.settings?.orgType)
  if (stored) return stored
  if (tenant?.settings?.consultTemplate === 'aesthetic') return 'estetica'
  if ((tenant?.practiceType ?? 'individual') === 'individual') return 'consultorio'
  return 'especialidades'
}

/** Specialties in display order: the org type's suggestions first, then the rest by tier. */
export function specialtiesFor(org: OrgType): Specialty[] {
  const suggested = orgTypeDef(org).suggested
  const first = suggested.map((k) => specialtyByKey(k)!).filter(Boolean)
  const rest = SPECIALTIES.filter((x) => !suggested.includes(x.key)).sort((a, b) => a.tier - b.tier)
  return [...first, ...rest]
}

/**
 * Base profile (settings.consultTemplate) a new clinic gets from its org type and,
 * for an independent practice, from the owner's specialty (a nutritionist's
 * consultorio is a nutrition practice).
 */
export function profileForSignup(org: OrgType, specialty: SpecialtyKey | null): PracticeProfile {
  if (org === 'consultorio' && specialty === 'nutrition') return 'nutrition'
  if (org === 'consultorio' && specialty === 'aesthetic') return 'aesthetic'
  return orgTypeDef(org).profile
}
