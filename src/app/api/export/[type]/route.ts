// CSV export endpoint (v4 spec §A.2): /api/export/{appointments|patients|invoices}?from&to
// Auth + tenant scope are enforced server-side: owners export their own clinic,
// a super admin passes ?tenant=<id>. Rows stream from the Local API in pages of
// 500, capped at 10k (narrow the range beyond that). Patient exports carry PII
// (phone numbers), so every export writes an `export.generated` audit entry.

import { getPayload } from 'payload'
import type { Payload, PayloadRequest, Where } from 'payload'
import config from '@payload-config'
import type { Appointment, Invoice, Patient, Tenant, User } from '@/payload-types'
import { getTenantID, isSuperAdmin } from '@/access'
import { toCsv, type CsvValue } from '@/lib/csv'
import { logAudit } from '@/lib/audit'
import { formatDateTime } from '@/lib/format'
import { APP_NAME } from '@/lib/brand'

const PAGE_SIZE = 500
const MAX_ROWS = 10_000

type ExportType = 'appointments' | 'patients' | 'invoices'
const EXPORT_TYPES: ExportType[] = ['appointments', 'patients', 'invoices']

/** The date field that `from`/`to` filter on, per type. */
const RANGE_FIELD: Record<ExportType, string> = {
  appointments: 'start',
  patients: 'createdAt',
  invoices: 'createdAt',
}

/** Spanish nouns for each export type — file names and audit summaries. */
const TYPE_LABELS: Record<ExportType, string> = {
  appointments: 'citas',
  patients: 'pacientes',
  invoices: 'facturas',
}

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programada',
  'checked-in': 'En espera',
  completed: 'Atendida',
  cancelled: 'Cancelada',
  'no-show': 'No asistió',
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  paid: 'Pagada',
  partial: 'Parcial',
  unpaid: 'Pendiente',
  voided: 'Anulada',
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Masculino',
  female: 'Femenino',
  other: 'Otro',
}

/** Product name as a file-name-safe slug (e.g. "Consultorio" → "consultorio"). */
const fileSlug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'export'

const relName = (v: unknown): string =>
  v && typeof v === 'object' && 'name' in (v as Record<string, unknown>)
    ? String((v as { name: unknown }).name)
    : ''

const bad = (status: number, message: string) => Response.json({ error: message }, { status })

export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  if (!EXPORT_TYPES.includes(type as ExportType)) return bad(404, 'Tipo de exportación desconocido.')

  const payload = await getPayload({ config: await config })
  const { user } = await payload.auth({ headers: req.headers as never })
  if (!user) return bad(401, 'Inicie sesión para exportar datos.')

  // Route-level access (spec §A.3): owner + superAdmin only.
  const actor = user as unknown as User
  if (actor.role !== 'owner' && !isSuperAdmin(actor)) {
    return bad(403, 'Solo el titular del consultorio puede exportar datos.')
  }

  const url = new URL(req.url)
  // Tenant scope is never client-chosen for owners — it comes from the session.
  const tenantID = isSuperAdmin(actor) ? url.searchParams.get('tenant') : getTenantID(actor)
  if (!tenantID) return bad(400, 'Se requiere un consultorio para exportar.')

  const from = new Date(url.searchParams.get('from') ?? '')
  const to = new Date(url.searchParams.get('to') ?? '')
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return bad(400, 'Indique un rango de fechas válido (desde/hasta).')
  }

  const where: Where = {
    tenant: { equals: tenantID },
    [RANGE_FIELD[type as ExportType]]: {
      greater_than_equal: from.toISOString(),
      less_than: to.toISOString(),
    },
  }

  const probe = await payload.count({ collection: type as ExportType, where, overrideAccess: true })
  if (probe.totalDocs > MAX_ROWS) {
    return bad(400, `La exportación está limitada a ${MAX_ROWS.toLocaleString('es-DO')} filas; reduzca el rango de fechas.`)
  }

  const tenant = (await payload
    .findByID({ collection: 'tenants', id: tenantID, depth: 0, overrideAccess: true })
    .catch(() => null)) as Tenant | null
  if (!tenant) return bad(400, 'Se requiere un consultorio para exportar.')

  const { headers, rows } = await collectRows(payload, type as ExportType, where, tenant)

  // PII leaves the system — record who took what (spec §A.2).
  await logAudit({ payload, user: actor } as unknown as PayloadRequest, {
    action: 'export.generated',
    targetCollection: type,
    targetId: tenantID,
    tenantID,
    summary: `Se ${rows.length === 1 ? 'exportó' : 'exportaron'} ${rows.length} ${rows.length === 1 ? 'fila' : 'filas'} de ${TYPE_LABELS[type as ExportType]} en CSV`,
    meta: { from: from.toISOString(), to: to.toISOString() },
  })

  const day = (d: Date) => d.toISOString().slice(0, 10)
  const filename = `${fileSlug(APP_NAME)}-${TYPE_LABELS[type as ExportType]}-${tenant.slug || tenantID}-${day(from)}-${day(to)}.csv`
  return new Response(toCsv(headers, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

async function collectRows(
  payload: Payload,
  type: ExportType,
  where: Where,
  tenant: Tenant,
): Promise<{ headers: string[]; rows: CsvValue[][] }> {
  const rows: CsvValue[][] = []
  let page = 1
  let hasNext = true
  while (hasNext && rows.length < MAX_ROWS) {
    const res = await payload.find({
      collection: type,
      where,
      limit: PAGE_SIZE,
      page,
      sort: RANGE_FIELD[type],
      depth: 1, // patient/doctor names in appointment & invoice rows
      overrideAccess: true,
    })
    for (const doc of res.docs) rows.push(rowFor(type, doc as never, tenant))
    hasNext = res.hasNextPage
    page += 1
  }

  const headers: Record<ExportType, string[]> = {
    appointments: ['Fecha y hora', 'Paciente', 'Médico', 'Estado', 'Motivo', 'Duración (min)'],
    patients: ['N.º de expediente', 'Nombre', 'Teléfono', 'Sexo', 'Edad', 'Registrado'],
    invoices: ['N.º de factura', 'Paciente', 'Total', 'Pagado', 'Saldo pendiente', 'Estado', 'Moneda', 'Creada'],
  }
  return { headers: headers[type], rows }
}

function rowFor(type: ExportType, doc: Appointment | Patient | Invoice, tenant: Tenant): CsvValue[] {
  if (type === 'appointments') {
    const a = doc as Appointment
    return [
      formatDateTime(a.start, tenant),
      relName(a.patient),
      relName(a.doctor),
      APPOINTMENT_STATUS_LABELS[a.status ?? ''] ?? a.status ?? '',
      a.reason ?? '',
      a.durationMins ?? '',
    ]
  }
  if (type === 'patients') {
    const p = doc as Patient
    return [
      p.mrn ?? '',
      p.name,
      p.phone ?? '',
      p.gender ? (GENDER_LABELS[p.gender] ?? p.gender) : '',
      p.ageYears ?? '',
      formatDateTime(p.createdAt, tenant),
    ]
  }
  const inv = doc as Invoice
  return [
    inv.invoiceNumber ?? '',
    relName(inv.patient),
    inv.totalAmount ?? 0,
    inv.amountPaid ?? 0,
    inv.balanceDue ?? 0,
    INVOICE_STATUS_LABELS[inv.voided ? 'voided' : (inv.paymentStatus ?? 'unpaid')],
    inv.currency ?? '',
    formatDateTime(inv.createdAt, tenant),
  ]
}
