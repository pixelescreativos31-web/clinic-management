// Shared, market-agnostic option lists. Currency and timezone are tenant-level
// settings with Dominican Republic defaults — nothing region-specific is hardcoded.
// Labels are user-facing (Spanish); values are stable internal keys.

export const ROLES = ['superAdmin', 'owner', 'doctor', 'receptionist'] as const
export type Role = (typeof ROLES)[number]

export const TENANT_ROLES = ['owner', 'doctor', 'receptionist'] as const

export const ROLE_LABELS: Record<Role, string> = {
  superAdmin: 'Superadministrador',
  owner: 'Titular',
  doctor: 'Médico',
  receptionist: 'Asistente',
}

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programada',
  'checked-in': 'En espera',
  completed: 'Atendida',
  cancelled: 'Cancelada',
  'no-show': 'No asistió',
}

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'checked-in',
  'completed',
  'cancelled',
  'no-show',
] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

// Legal status transitions (spec §8.4). Terminal states have no outgoing edges.
export const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ['checked-in', 'cancelled', 'no-show'],
  'checked-in': ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  'no-show': [],
}

// Statuses that occupy a doctor's slot for conflict detection.
export const ACTIVE_STATUSES: AppointmentStatus[] = ['scheduled', 'checked-in']

export const GENDERS = ['male', 'female', 'other'] as const
export const GENDER_LABELS: Record<string, string> = {
  male: 'Masculino',
  female: 'Femenino',
  other: 'Otro',
}

// Identity documents (DR: cédula; foreigners: pasaporte).
export const DOCUMENT_TYPES = [
  { label: 'Cédula', value: 'cedula' },
  { label: 'Pasaporte', value: 'passport' },
  { label: 'Otro', value: 'other' },
] as const

// How the practice is organised. `individual` = one doctor (optionally with an
// assistant) — the MVP target; the UI hides multi-doctor tooling. `clinic` keeps
// the full multi-doctor feature set.
export const PRACTICE_TYPES = [
  { label: 'Médico independiente', value: 'individual' },
  { label: 'Clínica / varios médicos', value: 'clinic' },
] as const
export type PracticeType = (typeof PRACTICE_TYPES)[number]['value']

// Doctor availability patterns (covers daily / alternate / weekly / on-call / surgeon).
export const AVAILABILITY_TYPES = [
  { label: 'Regular (días y horario fijos)', value: 'regular' },
  { label: 'De guardia (cualquier hora)', value: 'onCall' },
  { label: 'Solo con cita previa', value: 'byAppointment' },
] as const
export type AvailabilityType = (typeof AVAILABILITY_TYPES)[number]['value']

export const WEEKDAYS = [
  { label: 'Dom', value: 'sun' },
  { label: 'Lun', value: 'mon' },
  { label: 'Mar', value: 'tue' },
  { label: 'Mié', value: 'wed' },
  { label: 'Jue', value: 'thu' },
  { label: 'Vie', value: 'fri' },
  { label: 'Sáb', value: 'sat' },
] as const
export const ALL_DAYS = WEEKDAYS.map((d) => d.value)

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const

export const MARITAL_STATUSES = [
  { label: 'Soltero/a', value: 'single' },
  { label: 'Casado/a', value: 'married' },
  { label: 'Unión libre', value: 'common-law' },
  { label: 'Divorciado/a', value: 'divorced' },
  { label: 'Viudo/a', value: 'widowed' },
] as const

// --- v2: clinical loop ---

// Appointment statuses on which a Visit (consultation) may be recorded.
export const VISIT_ALLOWED_APPOINTMENT_STATUSES: AppointmentStatus[] = ['checked-in', 'completed']

// Prescription dosing frequencies (standard medical shorthand). `other` reveals a note.
export const PRESCRIPTION_FREQUENCIES = [
  { label: 'Cada 24 horas (1 vez al día)', value: 'od' },
  { label: 'Cada 12 horas (2 veces al día)', value: 'bd' },
  { label: 'Cada 8 horas (3 veces al día)', value: 'tds' },
  { label: 'Cada 6 horas (4 veces al día)', value: 'qid' },
  { label: 'Si es necesario (SOS)', value: 'sos' },
  { label: 'Otra', value: 'other' },
] as const
export type PrescriptionFrequency = (typeof PRESCRIPTION_FREQUENCIES)[number]['value']

export const PAYMENT_METHODS = [
  { label: 'Efectivo', value: 'cash' },
  { label: 'Tarjeta', value: 'card' },
  { label: 'Transferencia', value: 'bank-transfer' },
  { label: 'Seguro médico (ARS)', value: 'insurance' },
  { label: 'Otro', value: 'other' },
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value']

// Derived — never set by a client. unpaid (paid=0) / partial / paid (balance=0).
export const INVOICE_STATUSES = ['unpaid', 'partial', 'paid'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

// Curated currency list (a full ISO list is overkill). `code` feeds Intl.NumberFormat.
export const CURRENCIES = [
  { label: 'DOP — Peso dominicano', value: 'DOP' },
  { label: 'USD — Dólar estadounidense', value: 'USD' },
  { label: 'EUR — Euro', value: 'EUR' },
  { label: 'MXN — Peso mexicano', value: 'MXN' },
  { label: 'COP — Peso colombiano', value: 'COP' },
  { label: 'PEN — Sol peruano', value: 'PEN' },
  { label: 'CLP — Peso chileno', value: 'CLP' },
  { label: 'GTQ — Quetzal guatemalteco', value: 'GTQ' },
  { label: 'CRC — Colón costarricense', value: 'CRC' },
  { label: 'PAB — Balboa panameño', value: 'PAB' },
] as const

// Curated IANA timezone list (a full dropdown is overkill for the launch markets).
export const TIMEZONES = [
  { label: 'Santo Domingo (AST, UTC−4)', value: 'America/Santo_Domingo' },
  { label: 'Puerto Rico (AST, UTC−4)', value: 'America/Puerto_Rico' },
  { label: 'Nueva York (ET)', value: 'America/New_York' },
  { label: 'Ciudad de México (CST)', value: 'America/Mexico_City' },
  { label: 'Bogotá (COT)', value: 'America/Bogota' },
  { label: 'Lima (PET)', value: 'America/Lima' },
  { label: 'Santiago de Chile', value: 'America/Santiago' },
  { label: 'Guatemala (CST)', value: 'America/Guatemala' },
  { label: 'Costa Rica (CST)', value: 'America/Costa_Rica' },
  { label: 'Panamá (EST)', value: 'America/Panama' },
  { label: 'Madrid (CET)', value: 'Europe/Madrid' },
] as const

export const DEFAULT_CURRENCY = 'DOP'
export const DEFAULT_TIMEZONE = 'America/Santo_Domingo'
export const DEFAULT_APPOINTMENT_DURATION = 20
export const DEFAULT_OPEN_TIME = '08:00'
export const DEFAULT_CLOSE_TIME = '18:00'

// Self-serve signup (v3 spec §3.2): the country select suggests sensible
// currency/timezone defaults (still editable). Keys are the labels shown in the
// form; values seed the new tenant's settings.
export const COUNTRY_DEFAULTS = [
  { label: 'República Dominicana', currency: 'DOP', timezone: 'America/Santo_Domingo' },
  { label: 'Puerto Rico', currency: 'USD', timezone: 'America/Puerto_Rico' },
  { label: 'Estados Unidos', currency: 'USD', timezone: 'America/New_York' },
  { label: 'México', currency: 'MXN', timezone: 'America/Mexico_City' },
  { label: 'Colombia', currency: 'COP', timezone: 'America/Bogota' },
  { label: 'Perú', currency: 'PEN', timezone: 'America/Lima' },
  { label: 'Chile', currency: 'CLP', timezone: 'America/Santiago' },
  { label: 'Guatemala', currency: 'GTQ', timezone: 'America/Guatemala' },
  { label: 'Costa Rica', currency: 'CRC', timezone: 'America/Costa_Rica' },
  { label: 'Panamá', currency: 'PAB', timezone: 'America/Panama' },
  { label: 'España', currency: 'EUR', timezone: 'Europe/Madrid' },
] as const
export const DEFAULT_COUNTRY = 'República Dominicana'

// v3 — audit log actions (spec §2.2). Append-only record of sensitive actions.
export const AUDIT_ACTIONS = [
  { value: 'appointment.created', label: 'Cita agendada' },
  { value: 'appointment.cancelled', label: 'Cita cancelada' },
  { value: 'appointment.status-changed', label: 'Estado de cita cambiado' },
  { value: 'invoice.voided', label: 'Factura anulada' },
  { value: 'payment.recorded', label: 'Pago registrado' },
  { value: 'user.created', label: 'Miembro del equipo agregado' },
  { value: 'user.deactivated', label: 'Miembro del equipo desactivado' },
  { value: 'user.role-changed', label: 'Rol cambiado' },
  { value: 'settings.updated', label: 'Configuración actualizada' },
  { value: 'tenant.suspended', label: 'Consultorio suspendido' },
  { value: 'tenant.reactivated', label: 'Consultorio reactivado' },
  { value: 'plan.upgrade-requested', label: 'Mejora de plan solicitada' },
  { value: 'plan.upgrade-rejected', label: 'Mejora de plan rechazada' },
  { value: 'plan.changed', label: 'Plan cambiado' },
  // v4 — reports & exports. Patient exports carry PII (phone numbers), so every
  // export is an auditable event.
  { value: 'export.generated', label: 'Datos exportados' },
  // MVP — clinical record trail (who created/changed a patient file or consultation).
  { value: 'patient.created', label: 'Paciente registrado' },
  { value: 'patient.updated', label: 'Expediente de paciente editado' },
  { value: 'visit.created', label: 'Consulta registrada' },
  { value: 'visit.updated', label: 'Consulta editada' },
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]['value']

// Stable error codes — UI maps these to friendly messages (spec §9.1).
export const ERROR_CODES = {
  SLOT_TAKEN: 'SLOT_TAKEN',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  TENANT_PENDING: 'TENANT_PENDING',
  USER_INACTIVE: 'USER_INACTIVE',
  PLAN_LIMIT: 'PLAN_LIMIT',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION: 'VALIDATION',
  // v3 — self-serve onboarding
  SIGNUP_EMAIL_TAKEN: 'SIGNUP_EMAIL_TAKEN',
  SIGNUP_RATE_LIMITED: 'SIGNUP_RATE_LIMITED',
  SIGNUP_FAILED: 'SIGNUP_FAILED',
  // v3 — reminders (internal; never surfaced in the UI)
  CRON_UNAUTHORIZED: 'CRON_UNAUTHORIZED',
  // backlog — email hardening
  RESET_TOKEN_INVALID: 'RESET_TOKEN_INVALID',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  VERIFY_TOKEN_INVALID: 'VERIFY_TOKEN_INVALID',
  // v2 — clinical loop
  VISIT_EXISTS: 'VISIT_EXISTS',
  INVALID_APPOINTMENT_STATE: 'INVALID_APPOINTMENT_STATE',
  PAYMENT_EXCEEDS_BALANCE: 'PAYMENT_EXCEEDS_BALANCE',
  INVOICE_VOIDED: 'INVOICE_VOIDED',
  INVOICE_LOCKED: 'INVOICE_LOCKED',
} as const
