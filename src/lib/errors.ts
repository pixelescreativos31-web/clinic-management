// Maps server error codes to friendly UI messages (spec §9.1). Raw server text is
// never shown to the user; a cross-tenant resource's existence is never revealed.

import { ERROR_CODES } from './constants'

const MESSAGES: Record<string, string> = {
  [ERROR_CODES.SLOT_TAKEN]: 'Ese horario acaba de ocuparse. Elija otra hora.',
  [ERROR_CODES.INVALID_TRANSITION]: 'Ese cambio de estado no está permitido.',
  [ERROR_CODES.TENANT_SUSPENDED]: 'La cuenta de este consultorio está suspendida. Contacte a soporte.',
  [ERROR_CODES.TENANT_PENDING]:
    'Su consultorio está pendiente de aprobación. Podrá iniciar sesión cuando sea aprobado.',
  [ERROR_CODES.PLAN_LIMIT]: 'Alcanzó el límite de su plan. Solicite una mejora de plan para agregar más.',
  [ERROR_CODES.USER_INACTIVE]: 'Su cuenta fue desactivada. Contacte al titular del consultorio.',
  [ERROR_CODES.FORBIDDEN]: 'No tiene permiso para realizar esta acción.',
  [ERROR_CODES.VALIDATION]: 'Revise el formulario e intente de nuevo.',
  // v2 — clinical loop
  [ERROR_CODES.VISIT_EXISTS]: 'Ya se registró una consulta para esta cita.',
  [ERROR_CODES.INVALID_APPOINTMENT_STATE]: 'Registre la llegada del paciente antes de iniciar la consulta.',
  [ERROR_CODES.PAYMENT_EXCEEDS_BALANCE]: 'El pago excede el saldo pendiente.',
  [ERROR_CODES.INVOICE_VOIDED]: 'Esta factura fue anulada y no se puede modificar.',
  [ERROR_CODES.INVOICE_LOCKED]:
    'No se pueden cambiar las partidas después de un pago. Anule la factura y cree una nueva.',
  // v3 — self-serve onboarding
  [ERROR_CODES.SIGNUP_EMAIL_TAKEN]: 'Ya existe una cuenta con este correo.',
  [ERROR_CODES.SIGNUP_RATE_LIMITED]: 'Demasiados registros desde esta red. Intente más tarde.',
  [ERROR_CODES.SIGNUP_FAILED]: 'No pudimos crear su consultorio. Intente de nuevo.',
  // backlog — email hardening
  [ERROR_CODES.RESET_TOKEN_INVALID]:
    'Este enlace de restablecimiento no es válido o expiró. Solicite uno nuevo.',
  [ERROR_CODES.EMAIL_NOT_VERIFIED]:
    'Primero verifique su correo: revise su bandeja de entrada.',
  [ERROR_CODES.VERIFY_TOKEN_INVALID]:
    'Este enlace de verificación no es válido o expiró. Solicite uno nuevo abajo.',
}

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string }

/** Extract a stable code + friendly message from a thrown Payload/API error. */
export function toActionError(err: unknown): { code: string; message: string } {
  const anyErr = err as { data?: { code?: string }; code?: string; message?: string }
  const code = anyErr?.data?.code || anyErr?.code || 'UNKNOWN'
  // Prefer a catalog message; fall back to the server message for validation,
  // otherwise a generic line.
  // VALIDATION errors carry a specific, already-localised server message (e.g.
  // "Indique la fecha de nacimiento o la edad."), which beats the generic line.
  const serverMessage = typeof anyErr?.message === 'string' ? anyErr.message : null
  const message =
    (code === ERROR_CODES.VALIDATION && serverMessage) ||
    MESSAGES[code] ||
    (serverMessage && code === 'UNKNOWN'
      ? serverMessage
      : 'Algo salió mal. Intente de nuevo.')
  return { code, message }
}

export function friendly(code: string): string {
  return MESSAGES[code] || 'Algo salió mal. Intente de nuevo.'
}
