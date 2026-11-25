'use client'

import { FORMAT_LABELS, type ConsultFormat } from '@/lib/profiles'
import { specialtiesFor, specialtyByKey, type OrgType } from '@/lib/specialties'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary, btnGhost, inputClass, Field, Spinner } from './primitives'
import { AppHeader, AppContent } from './AppHeader'
import { AppSelect } from './AppSelect'
import { TimePicker } from './TimePicker'
import { TablePager } from './TablePager'
import { avatarTint, initialsOf } from '@/lib/apptStatus'

const STAFF_PAGE_SIZE = 10
import {
  createStaff,
  updateStaff,
  toggleStaffActive,
} from '@/app/(frontend)/dashboard/staff/actions'
import { AVAILABILITY_TYPES, WEEKDAYS, ALL_DAYS, ROLE_LABELS, type Role } from '@/lib/constants'

const CARD = 'rounded-[12px] border border-[#e7e5e4] bg-white'
const TH = 'px-3.5 py-2.5 text-left text-xs font-medium whitespace-nowrap text-[#57534e]'
const TD = 'px-3.5 py-[11px] align-middle'
const SMALL_BTN =
  'flex h-9 items-center rounded-lg border border-[#d6d3d1] bg-white px-3 text-[13px] font-medium text-[#1c1917] transition-colors hover:border-[#a8a29e] disabled:opacity-50'
const roleLabel = (r: string) => ROLE_LABELS[r as Role] ?? r

export type StaffRow = {
  id: string
  name: string
  email: string
  role: string
  phone?: string | null
  specialty?: string | null
  specialtyKey?: string
  defaultFormat?: string
  consultationFee?: number | null
  active: boolean
  availability?: string | null
  availabilityType?: string
  availableDays?: string[]
  availableFrom?: string
  availableTo?: string
}

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'receptionist',
  phone: '',
  specialty: '',
  specialtyKey: '',
  defaultFormat: '',
  consultationFee: '',
  availabilityType: 'regular',
  availableFrom: '09:00',
  availableTo: '17:00',
}

export function StaffManager({
  staff,
  currency,
  formatOptions = [],
  orgType = 'consultorio',
  title = 'Equipo',
}: {
  /** «Equipo», or «Asistente» for an independent practice (same rule as the menu). */
  title?: string
  staff: StaffRow[]
  currency: string
  /** The clinic profile's formats (staff without a specialty). */
  formatOptions?: ConsultFormat[]
  orgType?: OrgType
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const filtered = needle
    ? staff.filter((s) =>
        [s.name, s.email, s.phone ?? '', s.specialty ?? '', roleLabel(s.role)].some((v) =>
          v.toLowerCase().includes(needle),
        ),
      )
    : staff
  const totalPages = Math.max(1, Math.ceil(filtered.length / STAFF_PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * STAFF_PAGE_SIZE, page * STAFF_PAGE_SIZE)
  const activeCount = staff.filter((s) => s.active).length
  const clinicalCount = staff.filter(
    (s) => s.active && (s.role === 'doctor' || s.role === 'therapist'),
  ).length
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [days, setDays] = useState<string[]>([...ALL_DAYS])
  const toggleDay = (d: string) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))

  const openAdd = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setDays([...ALL_DAYS])
    setError(null)
    setShowForm(true)
  }

  // A doctor with a specialty opens with one of that specialty's formats.
  const doctorFormats = (specialtyByKey(form.specialtyKey)?.formats ?? formatOptions).filter(
    (f) => f !== 'program',
  )
  const openEdit = (s: StaffRow) => {
    setEditingId(s.id)
    setForm({
      name: s.name,
      email: s.email,
      password: '',
      role: s.role,
      phone: s.phone || '',
      specialty: s.specialty || '',
      specialtyKey: s.specialtyKey || '',
      defaultFormat: s.defaultFormat || '',
      consultationFee: s.consultationFee != null ? String(s.consultationFee) : '',
      availabilityType: s.availabilityType || 'regular',
      availableFrom: s.availableFrom || '09:00',
      availableTo: s.availableTo || '17:00',
    })
    setDays(s.availableDays?.length ? [...s.availableDays] : [...ALL_DAYS])
    setError(null)
    setShowForm(true)
  }

  const close = () => {
    setShowForm(false)
    setEditingId(null)
  }

  const save = () => {
    setError(null)
    start(async () => {
      const input = {
        name: form.name,
        email: form.email,
        role: form.role as 'doctor' | 'therapist' | 'receptionist' | 'owner',
        phone: form.phone || undefined,
        specialty: form.specialty || undefined,
        specialtyKey: form.specialtyKey,
        defaultFormat: form.defaultFormat,
        consultationFee: form.consultationFee ? Number(form.consultationFee) : undefined,
        availabilityType: form.availabilityType,
        availableDays: days,
        availableFrom: form.availableFrom,
        availableTo: form.availableTo,
      }
      const res = editingId
        ? await updateStaff(editingId, { ...input, password: form.password || undefined })
        : await createStaff({ ...input, password: form.password })
      if (res.ok) {
        close()
        setForm({ ...EMPTY_FORM })
        setDays([...ALL_DAYS])
        router.refresh()
      } else setError(res.message)
    })
  }

  const toggle = (id: string, active: boolean) => {
    start(async () => {
      const res = await toggleStaffActive(id, active)
      if (res.ok) router.refresh()
      else setError(res.message)
    })
  }

  const money = (n?: number | null) =>
    n == null
      ? '—'
      : new Intl.NumberFormat('es-DO', {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        }).format(n)

  return (
    <>
      <AppHeader
        title={title}
        subtitle={`${staff.length} ${staff.length === 1 ? 'miembro' : 'miembros'} del equipo`}
        actions={
          <button className={btnPrimary} onClick={openAdd}>
            Agregar miembro
          </button>
        }
      />
      <AppContent className="flex flex-col gap-3">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          {[
            ['Miembros', staff.length],
            ['Activos', activeCount],
            ['Atienden pacientes', clinicalCount],
          ].map(([l, v]) => (
            <div key={l} className={`${CARD} px-4 py-3.5`}>
              <div className="text-xs text-[#57534e]">{l}</div>
              <div className="tabular mt-0.5 text-[22px] font-medium tracking-[-.03em]">{v}</div>
            </div>
          ))}
        </div>

        {showForm && (
          <section className={`${CARD} overflow-hidden`}>
            <div className="border-b border-[#f0eeec] px-[18px] py-4">
              <h2 className="text-base font-semibold">
                {editingId
                  ? `Editar a ${form.name || 'miembro del equipo'}`
                  : 'Nuevo miembro del equipo'}
              </h2>
              <p className="mt-0.5 text-[13px] text-[#57534e]">
                {editingId
                  ? 'Los cambios se aplicarán la próxima vez que inicie sesión.'
                  : 'Iniciará sesión con este correo y la contraseña temporal.'}
              </p>
            </div>
            <div className="grid gap-4 px-[18px] py-4 sm:grid-cols-2">
              <Field label="Nombre completo">
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                />
              </Field>
              <Field label="Correo electrónico">
                <input
                  className={inputClass}
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                />
              </Field>
              <Field
                label={
                  editingId
                    ? 'Nueva contraseña (déjela en blanco para conservarla)'
                    : 'Contraseña temporal'
                }
                hint="Mínimo 10 caracteres."
              >
                <input
                  className={inputClass}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                />
              </Field>
              <Field label="Rol">
                <AppSelect
                  value={form.role}
                  onChange={(v) => set('role', v)}
                  options={[
                    { value: 'receptionist', label: ROLE_LABELS.receptionist },
                    { value: 'doctor', label: ROLE_LABELS.doctor },
                    {
                      value: 'therapist',
                      label: `${ROLE_LABELS.therapist} (masajes, cosmetología)`,
                    },
                    { value: 'owner', label: ROLE_LABELS.owner },
                  ]}
                />
              </Field>
              <Field label="Teléfono (opcional)">
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                />
              </Field>
              {(form.role === 'doctor' || form.role === 'therapist') && (
                <>
                  <Field label={form.role === 'doctor' ? 'Título en la receta' : 'Especialidad'}>
                    <input
                      className={inputClass}
                      value={form.specialty}
                      onChange={(e) => set('specialty', e.target.value)}
                      placeholder={form.role === 'therapist' ? 'Masajista' : 'Medicina general'}
                    />
                  </Field>
                  <Field
                    label={`${form.role === 'therapist' ? 'Tarifa por sesión' : 'Tarifa de consulta'} (${currency})`}
                  >
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      value={form.consultationFee}
                      onChange={(e) => set('consultationFee', e.target.value)}
                    />
                  </Field>
                  {form.role === 'doctor' && (
                    <Field
                      label="Especialidad (ficha clínica)"
                      hint={
                        specialtyByKey(form.specialtyKey)?.ready === false
                          ? 'Su ficha especializada está en camino; mientras tanto usa la consulta general.'
                          : 'Define las fichas que usa en sus consultas.'
                      }
                    >
                      <select
                        className={inputClass}
                        value={form.specialtyKey}
                        onChange={(e) => {
                          const key = e.target.value
                          const next = specialtyByKey(key)?.formats ?? formatOptions
                          setForm((f) => ({
                            ...f,
                            specialtyKey: key,
                            defaultFormat: next.includes(f.defaultFormat as ConsultFormat)
                              ? f.defaultFormat
                              : '',
                          }))
                        }}
                      >
                        <option value="">Según el perfil del consultorio</option>
                        {specialtiesFor(orgType).map((x) => (
                          <option key={x.key} value={x.key}>
                            {x.ready ? x.label : `${x.label} (pronto)`}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  {form.role === 'doctor' && doctorFormats.length > 1 && (
                    <Field
                      label="Ficha por defecto"
                      hint="Con qué ficha abre sus consultas. Pacientes en el programa abren su control."
                    >
                      <select
                        className={inputClass}
                        value={form.defaultFormat}
                        onChange={(e) => set('defaultFormat', e.target.value)}
                      >
                        <option value="">Según el perfil del consultorio</option>
                        {doctorFormats.map((f) => (
                          <option key={f} value={f}>
                            {FORMAT_LABELS[f]}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                </>
              )}
            </div>

            {(form.role === 'doctor' || form.role === 'therapist') && (
              <div className="mx-[18px] mb-4 rounded-[10px] border border-[#e7e5e4] bg-[#fafaf7] p-4">
                <Field label="Disponibilidad">
                  <AppSelect
                    value={form.availabilityType}
                    onChange={(v) => set('availabilityType', v)}
                    options={AVAILABILITY_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                  />
                </Field>
                {form.availabilityType === 'regular' && (
                  <div className="mt-3.5 flex flex-col gap-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => toggleDay(d.value)}
                          aria-pressed={days.includes(d.value)}
                          className={`h-10 min-w-12 rounded-[10px] border px-3 text-sm font-medium transition-colors ${
                            days.includes(d.value)
                              ? 'border-[#1c1917] bg-[#1c1917] text-white'
                              : 'border-[#d6d3d1] bg-white text-[#57534e] hover:border-[#a8a29e]'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <TimePicker
                        value={form.availableFrom}
                        onChange={(v) => set('availableFrom', v)}
                        openTime="00:00"
                        closeTime="24:00"
                        stepMins={30}
                        className="max-w-36"
                      />
                      <span className="text-sm text-[#57534e]">a</span>
                      <TimePicker
                        value={form.availableTo}
                        onChange={(v) => set('availableTo', v)}
                        openTime="00:00"
                        closeTime="24:00"
                        stepMins={30}
                        className="max-w-36"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0eeec] px-[18px] py-4">
              {error ? (
                <p className="text-sm text-[#b45309]" role="alert">
                  {error}
                </p>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button className={btnGhost} onClick={close}>
                  Cancelar
                </button>
                <button
                  className={btnPrimary}
                  disabled={pending || !form.name || !form.email || (!editingId && !form.password)}
                  onClick={save}
                >
                  {pending && <Spinner />}
                  {pending ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Agregar miembro'}
                </button>
              </div>
            </div>
          </section>
        )}

        {!showForm && error && (
          <p
            className="rounded-[10px] border border-[#b45309]/30 bg-[#faf3e6] px-3 py-2 text-sm text-[#b45309]"
            role="alert"
          >
            {error}
          </p>
        )}

        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          placeholder="Filtrar por nombre, correo o rol"
          aria-label="Filtrar el equipo"
          className="h-10 w-full max-w-[320px] rounded-[10px] border border-[#d6d3d1] bg-white px-3 text-base outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] md:text-sm"
        />

        <section className={`${CARD} overflow-hidden`}>
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#57534e]">
              {needle ? (
                <>
                  Nadie coincide con «{q.trim()}».{' '}
                  <button
                    type="button"
                    className="font-medium text-[#0f766e]"
                    onClick={() => setQ('')}
                  >
                    Quitar el filtro
                  </button>
                </>
              ) : (
                <>
                  Aún no hay miembros.{' '}
                  <button type="button" className="font-medium text-[#0f766e]" onClick={openAdd}>
                    Agregar miembro
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="bg-[#fafaf7]">
                    <th className={TH}>Miembro</th>
                    <th className={TH}>Rol</th>
                    <th className={TH}>Teléfono</th>
                    <th className={TH}>Especialidad · Tarifa · Disponibilidad</th>
                    <th className={TH}>Estado</th>
                    <th className={TH}>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((s) => {
                    const tint = avatarTint(s.name)
                    return (
                      <tr
                        key={s.id}
                        className="border-t border-[#f0eeec] transition-colors hover:bg-[#fafaf7]"
                      >
                        <td className={TD}>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                              style={{ background: tint.bg, color: tint.fg }}
                              aria-hidden
                            >
                              {initialsOf(s.name)}
                            </span>
                            <div className="min-w-0">
                              <div
                                className={`truncate font-medium ${s.active ? '' : 'text-[#57534e]'}`}
                              >
                                {s.name}
                              </div>
                              <div className="truncate text-[13px] text-[#57534e]">{s.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className={`${TD} whitespace-nowrap`}>{roleLabel(s.role)}</td>
                        <td className={`${TD} tabular whitespace-nowrap text-[#57534e]`}>
                          {s.phone || '—'}
                        </td>
                        <td className={TD}>
                          {s.role === 'doctor' || s.role === 'therapist' ? (
                            <div>
                              <div>
                                {s.specialty || '—'} ·{' '}
                                <span className="tabular">{money(s.consultationFee)}</span>
                              </div>
                              {s.availability && (
                                <div className="text-[13px] text-[#57534e]">{s.availability}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#57534e]">—</span>
                          )}
                        </td>
                        <td className={TD}>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                              s.active
                                ? 'border-[#d6d3d1] bg-white text-[#1c1917]'
                                : 'border-[#f0eeec] bg-[#f0eeec] text-[#57534e]'
                            }`}
                          >
                            {s.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className={TD}>
                          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                            <button
                              className={SMALL_BTN}
                              disabled={pending}
                              onClick={() => openEdit(s)}
                            >
                              Editar
                            </button>
                            <button
                              className={SMALL_BTN}
                              disabled={pending}
                              onClick={() => toggle(s.id, !s.active)}
                            >
                              {s.active ? 'Desactivar' : 'Reactivar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <TablePager page={page} totalPages={totalPages} onChange={setPage} />
        </section>
        <p className="text-[13px] text-[#57534e]">
          Al desactivar a un miembro se conserva su historial; simplemente no podrá iniciar sesión.
        </p>
      </AppContent>
    </>
  )
}
