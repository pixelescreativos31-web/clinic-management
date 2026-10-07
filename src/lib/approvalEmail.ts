// Signup decision notifications (BACKLOG §1.2). When a super admin approves or
// rejects a self-serve clinic, the owner hears about it by email instead of
// discovering it on a login attempt. Pure communication layer: best-effort,
// graceful when email isn't configured, and never allowed to fail the decision
// itself. Testable with an injected sender, like lib/digest.ts.

import type { Payload } from 'payload'
import type { Tenant, User } from '@/payload-types'
import { appBaseUrl, sendEmail, type SendEmail } from './email'
import { APP_NAME, APP_TAGLINE } from './brand'

export type DecisionSummary = {
  sent: boolean
  /** Why nothing went out — for logs only. */
  skipped?: string
}

/** Email the clinic owner that their signup was approved or rejected. */
export async function notifySignupDecision(
  payload: Payload,
  tenant: Pick<Tenant, 'id' | 'name'>,
  decision: 'approved' | 'rejected',
  send: SendEmail = sendEmail,
): Promise<DecisionSummary> {
  const owners = await payload.find({
    collection: 'users',
    where: { tenant: { equals: tenant.id }, role: { equals: 'owner' } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const owner = owners.docs[0] as User | undefined
  if (!owner?.email) return { sent: false, skipped: 'no owner email' }

  const res = await send({
    to: owner.email,
    subject:
      decision === 'approved'
        ? `${tenant.name} fue aprobado: ya puede iniciar sesión`
        : `Actualización sobre el registro de ${tenant.name}`,
    html: decision === 'approved' ? approvedHtml(tenant, owner) : rejectedHtml(tenant, owner),
  })
  if (res.ok) return { sent: true }
  return { sent: false, skipped: res.skipped ? 'email not configured' : res.error }
}

function approvedHtml(tenant: Pick<Tenant, 'name'>, owner: User): string {
  const link = `${appBaseUrl()}/login?email=${encodeURIComponent(owner.email)}`
  return `<div style="font-family:Segoe UI,system-ui,sans-serif;color:#1c2422;max-width:520px">
    <h2 style="margin:0 0 2px;font-size:18px">${tenant.name} está listo</h2>
    <p style="margin:0 0 16px;color:#4b5f5a;font-size:14px">
      Su consultorio fue aprobado. Inicie sesión para configurar su agenda y empezar a dar citas.
    </p>
    <p style="margin:0 0 18px">
      <a href="${link}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">
        Entrar a mi consultorio
      </a>
    </p>
    <p style="margin:0;font-size:12px;color:#8aa19b">
      En su panel encontrará una lista de bienvenida que le guía en los primeros pasos.
    </p>
  </div>`
}

function rejectedHtml(tenant: Pick<Tenant, 'name'>, _owner: User): string {
  return `<div style="font-family:Segoe UI,system-ui,sans-serif;color:#1c2422;max-width:520px">
    <h2 style="margin:0 0 2px;font-size:18px">Sobre el registro de ${tenant.name}</h2>
    <p style="margin:0 0 16px;color:#4b5f5a;font-size:14px">
      Por el momento no pudimos aprobar el registro de su consultorio. Si cree que se trata de un
      error, responda a este correo y lo revisaremos de nuevo.
    </p>
    <p style="margin:0;font-size:12px;color:#8aa19b">
      Enviado por ${APP_NAME} — ${APP_TAGLINE.toLowerCase()}.
    </p>
  </div>`
}
