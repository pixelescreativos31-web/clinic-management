import Link from 'next/link'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { btnPrimary, Card, EmptyState, PageTitle, Avatar, Th, Td, inputClass } from '@/components/primitives'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { IconPlus, IconSearch } from '@/components/icons'
import { PageSizeSelect } from '@/components/PageSizeSelect'
import { ageFromDOB } from '@/lib/format'
import { GENDER_LABELS } from '@/lib/constants'
import type { Patient } from '@/payload-types'
import type { Where } from 'payload'

const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZES = [10, 25, 50]

const pageHref = (q: string, p: number, limit: number) =>
  `/dashboard/patients?q=${encodeURIComponent(q)}&page=${p}&limit=${limit}`

/** 1 … current−1 current current+1 … last (compact page list). */
function pageNumbers(current: number, total: number): (number | '…')[] {
  const pages = new Set<number>([1, total, current - 1, current, current + 1])
  const list = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let prev = 0
  for (const p of list) {
    if (p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; limit?: string }>
}) {
  const { user } = await requireDashboardSession()
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const params = await searchParams
  const q = (params.q || '').trim()
  const page = Math.max(1, Number(params.page) || 1)
  const limit = PAGE_SIZES.includes(Number(params.limit)) ? Number(params.limit) : DEFAULT_PAGE_SIZE

  const where: Where = { tenant: { equals: tenantID } }
  if (q) {
    const digits = q.replace(/[^0-9]/g, '')
    where.or = [
      { name: { like: q } },
      { phone: { like: q } },
      { mrn: { like: q } },
      // Cédulas are stored digits-only, so "001-1234567-8" still matches.
      ...(digits.length >= 4 ? [{ documentNumber: { like: digits } }] : []),
    ]
  }

  const res = await payload.find({
    collection: 'patients',
    where,
    limit,
    page,
    sort: '-createdAt',
    overrideAccess: true,
  })
  const patients = res.docs as Patient[]

  const age = (p: Patient) => p.ageYears ?? (p.dateOfBirth ? ageFromDOB(p.dateOfBirth) : null)

  return (
    <div>
      <PageTitle
        subtitle={`${res.totalDocs} ${res.totalDocs === 1 ? 'paciente registrado' : 'pacientes registrados'}`}
        action={
          <Link href="/dashboard/patients/new" className={btnPrimary}>
            <IconPlus size={15} />
            Nuevo paciente
          </Link>
        }
      >
        Pacientes
      </PageTitle>

      <form className="mb-4">
        <div className="relative max-w-md">
          <IconSearch size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, teléfono, cédula o expediente…"
            className={`${inputClass} ps-9`}
          />
        </div>
      </form>

      <Card className="overflow-hidden">
        {patients.length === 0 ? (
          <EmptyState
            message={q ? `Ningún paciente coincide con «${q}».` : 'Todavía no hay pacientes.'}
            actionHref="/dashboard/patients/new"
            actionLabel="Registrar paciente"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-canvas/50">
                <Th>Paciente</Th>
                <Th>Expediente</Th>
                <Th className="hidden sm:table-cell">Teléfono</Th>
                <Th className="hidden md:table-cell">Edad / sexo</Th>
                <Th className="hidden lg:table-cell">Alergias</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {patients.map((p) => (
                <tr key={p.id} className="group transition-colors hover:bg-canvas/60">
                  <Td>
                    <Link href={`/dashboard/patients/${p.id}`} className="flex items-center gap-3">
                      <Avatar name={p.name} size="sm" />
                      <span className="font-medium group-hover:text-primary">{p.name}</span>
                    </Link>
                  </Td>
                  <Td>
                    <span className="tabular rounded bg-canvas px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {p.mrn}
                    </span>
                  </Td>
                  <Td className="tabular hidden text-muted-foreground sm:table-cell">{p.phone}</Td>
                  <Td className="hidden text-muted-foreground md:table-cell">
                    {age(p) != null ? `${age(p)} años` : '—'} · {GENDER_LABELS[p.gender] ?? p.gender}
                  </Td>
                  <Td className="hidden lg:table-cell">
                    {p.allergies ? (
                      <span className="rounded-full bg-red-soft px-2 py-0.5 text-xs font-medium text-red">
                        {p.allergies.length > 24 ? `${p.allergies.slice(0, 24)}…` : p.allergies}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {res.totalDocs > DEFAULT_PAGE_SIZE && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <PageSizeSelect value={limit} basePath="/dashboard/patients" />
            <span className="tabular text-xs">
              Página {res.page} de {res.totalPages}
            </span>
          </div>
          {res.totalPages > 1 && (
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                {res.hasPrevPage && (
                  <PaginationItem>
                    <PaginationPrevious href={pageHref(q, page - 1, limit)} />
                  </PaginationItem>
                )}
                {pageNumbers(page, res.totalPages).map((p, i) =>
                  p === '…' ? (
                    <PaginationItem key={`e${i}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink href={pageHref(q, p, limit)} isActive={p === page}>
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                {res.hasNextPage && (
                  <PaginationItem>
                    <PaginationNext href={pageHref(q, page + 1, limit)} />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
    </div>
  )
}
