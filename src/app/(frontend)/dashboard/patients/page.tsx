// Pacientes — design_handoff_medira list: search, 60px rows with initials,
// record number / phone and the allergy badge (red only for allergies).

import Link from 'next/link'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { AppHeader, AppContent } from '@/components/AppHeader'
import { PageSizeSelect } from '@/components/PageSizeSelect'
import { avatarTint, initialsOf } from '@/lib/apptStatus'
import { ageFromDOB } from '@/lib/format'
import { GENDER_LABELS } from '@/lib/constants'
import type { Patient } from '@/payload-types'
import type { Where } from 'payload'

const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZES = [10, 25, 50]

const HEADER_BTN =
  'inline-flex h-9 items-center rounded-[8px] bg-[#0f766e] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#115e59] hover:text-white'
const PAGE_BTN =
  'tabular inline-flex h-9 min-w-9 items-center justify-center rounded-[8px] border px-2.5 text-[13px] font-medium transition-colors'

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
    <>
      <AppHeader
        title="Pacientes"
        subtitle={`${res.totalDocs} ${res.totalDocs === 1 ? 'paciente registrado' : 'pacientes registrados'}`}
        actions={
          <Link href="/dashboard/patients/new" className={HEADER_BTN}>
            Nuevo paciente
          </Link>
        }
      />
      <AppContent>
        <form className="flex flex-wrap gap-2" role="search">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, teléfono, cédula o expediente"
            aria-label="Buscar paciente"
            className="h-11 min-w-0 flex-[1_1_240px] rounded-[10px] border border-[#d6d3d1] bg-white px-3.5 text-base text-[#1c1917] outline-none transition-colors placeholder:text-[#57534e] focus:border-[#0f766e] md:text-[15px]"
          />
          <button
            type="submit"
            className="h-11 rounded-[10px] border border-[#d6d3d1] bg-white px-4 text-sm font-medium text-[#1c1917] transition-colors hover:bg-[#fafaf7]"
          >
            Buscar
          </button>
        </form>

        <div className="mt-3 overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white">
          {patients.length === 0 ? (
            <div className="px-4 py-8 text-center text-[15px] text-[#57534e]">
              {q ? `Ningún paciente coincide con «${q}».` : 'Todavía no hay pacientes.'}{' '}
              <Link href="/dashboard/patients/new" className="font-medium text-[#0f766e] hover:text-[#115e59]">
                Registrar paciente
              </Link>
            </div>
          ) : (
            patients.map((p) => {
              const tint = avatarTint(p.name)
              const a = age(p)
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/patients/${p.id}`}
                  className="grid min-h-[60px] grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-t border-[#f0eeec] px-4 py-2.5 text-[#1c1917] first:border-t-0 hover:bg-[#fafaf7] hover:text-[#1c1917]"
                >
                  <span
                    className="flex size-10 items-center justify-center rounded-full text-[13px] font-semibold"
                    style={{ background: tint.bg, color: tint.fg }}
                    aria-hidden
                  >
                    {initialsOf(p.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-[15px] font-semibold">{p.name}</span>
                      {p.allergies && (
                        <span
                          className="max-w-full truncate rounded-md bg-[#b91c1c] px-[7px] py-px text-xs font-semibold text-white"
                          title={`Alergias: ${p.allergies}`}
                        >
                          Alergia: {p.allergies.length > 24 ? `${p.allergies.slice(0, 24)}…` : p.allergies}
                        </span>
                      )}
                    </span>
                    <span className="tabular block truncate text-[13px] text-[#57534e]">
                      {[
                        p.phone,
                        a != null ? `${a} ${a === 1 ? 'año' : 'años'}` : null,
                        p.gender ? GENDER_LABELS[p.gender] : 'Sexo por completar',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-[#57534e]">{p.mrn}</span>
                </Link>
              )
            })
          )}
        </div>

        {res.totalDocs > DEFAULT_PAGE_SIZE && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#57534e]">
            <div className="flex flex-wrap items-center gap-4">
              <PageSizeSelect value={limit} basePath="/dashboard/patients" />
              <span className="tabular">
                Página {res.page} de {res.totalPages}
              </span>
            </div>
            {res.totalPages > 1 && (
              <nav aria-label="Paginación" className="flex flex-wrap items-center gap-1.5">
                {res.hasPrevPage && (
                  <Link href={pageHref(q, page - 1, limit)} className={`${PAGE_BTN} border-[#d6d3d1] bg-white text-[#1c1917] hover:bg-[#fafaf7]`}>
                    Anterior
                  </Link>
                )}
                {pageNumbers(page, res.totalPages).map((p, i) =>
                  p === '…' ? (
                    <span key={`e${i}`} className="px-1 text-[#57534e]">
                      …
                    </span>
                  ) : (
                    <Link
                      key={p}
                      href={pageHref(q, p, limit)}
                      aria-current={p === page ? 'page' : undefined}
                      className={`${PAGE_BTN} ${
                        p === page
                          ? 'border-[#1c1917] bg-[#1c1917] text-white hover:text-white'
                          : 'border-[#d6d3d1] bg-white text-[#1c1917] hover:bg-[#fafaf7]'
                      }`}
                    >
                      {p}
                    </Link>
                  ),
                )}
                {res.hasNextPage && (
                  <Link href={pageHref(q, page + 1, limit)} className={`${PAGE_BTN} border-[#d6d3d1] bg-white text-[#1c1917] hover:bg-[#fafaf7]`}>
                    Siguiente
                  </Link>
                )}
              </nav>
            )}
          </div>
        )}
      </AppContent>
    </>
  )
}
