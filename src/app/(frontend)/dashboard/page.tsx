import Link from 'next/link'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { getDashboardData, getRevenueData, startOfDayInTz } from '@/lib/reports'
import { formatTime, formatMoney } from '@/lib/format'
import { windowOf, weekdayInTz } from '@/lib/availability'
import { KpiCard, StatusBadge, EmptyState } from '@/components/ui-kit'
import { btnPrimary, Avatar } from '@/components/primitives'
import {
  IconPlus,
  IconCalendar,
  IconCalendarCheck,
  IconUserX,
  IconUserPlus,
  IconArrowUpRight,
  IconStaff,
  IconWallet,
  IconReceipt,
  IconCheck,
} from '@/components/icons'
import { BarChart } from '@/components/BarChart'
import { RevenueChart } from '@/components/RevenueChart'
import { DEFAULT_TIMEZONE } from '@/lib/constants'
import { APP_NAME } from '@/lib/brand'
import type { Patient, User } from '@/payload-types'
import { practitionerWhere } from '@/lib/practice'

function greetingFor(tz: string): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(
      new Date(),
    ),
  )
  if (hour < 12) return 'Buenos días'
  if (hour < 17) return 'Buenas tardes'
  return 'Buenas noches'
}

export default async function DashboardHome({
  searchParams,
}: {
  searchParams?: Promise<{ welcome?: string }>
}) {
  const { user, tenant } = await requireDashboardSession()
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const tz = tenant?.settings?.timezone || DEFAULT_TIMEZONE
  const params = (await searchParams) ?? {}

  const todayStart = startOfDayInTz(tz, 0)
  const tomorrowStart = startOfDayInTz(tz, 1)
  const [data, doctorsRes, todayApptsRes, recentPatientsRes, patientsCount, apptsCount] = await Promise.all([
    getDashboardData(payload, tenantID, tenant),
    payload.find({
      collection: 'users',
      where: { and: [practitionerWhere(String(tenantID)), { active: { equals: true } }] },
      limit: 20,
      sort: 'name',
      overrideAccess: true,
    }),
    payload.find({
      collection: 'appointments',
      where: {
        tenant: { equals: tenantID },
        start: { greater_than_equal: todayStart.toISOString(), less_than: tomorrowStart.toISOString() },
      },
      limit: 300,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'patients',
      where: { tenant: { equals: tenantID } },
      limit: 5,
      sort: '-createdAt',
      overrideAccess: true,
    }),
    payload.count({ collection: 'patients', where: { tenant: { equals: tenantID } }, overrideAccess: true }),
    payload.count({ collection: 'appointments', where: { tenant: { equals: tenantID } }, overrideAccess: true }),
  ])
  const recentPatients = recentPatientsRes.docs as Patient[]

  // Welcome state for fresh self-serve clinics (spec §9): a 3-step checklist that
  // derives entirely from counts — no extra state is stored. It fades out on its
  // own once the clinic has more than its seeded sample patients.
  const activeDoctors = doctorsRes.totalDocs
  const showWelcome =
    params.welcome === '1' ||
    (tenant?.onboardingSource === 'self-serve' && patientsCount.totalDocs <= 3)
  const checklist = [
    { done: activeDoctors > 0, title: 'Agregue a sus médicos', desc: 'Defina especialidades y horarios', href: '/dashboard/staff', ownerOnly: true },
    { done: patientsCount.totalDocs > 0, title: 'Registre un paciente', desc: 'Basta con nombre y teléfono', href: '/dashboard/patients/new', ownerOnly: false },
    { done: apptsCount.totalDocs > 0, title: 'Agende una cita', desc: 'O registre un paciente sin cita', href: '/dashboard/appointments/new', ownerOnly: false },
  ].filter((s) => !s.ownerOnly || user.role === 'owner')
  const doneCount = checklist.filter((s) => s.done).length

  // Revenue & outstanding are owner-only (sensitive money figures).
  const isOwner = user.role === 'owner'
  const revenue = isOwner ? await getRevenueData(payload, tenantID, tenant) : null

  const todayWeekday = weekdayInTz(todayStart, tz)
  const countByDoctor = new Map<string, number>()
  for (const a of todayApptsRes.docs) {
    const docID = String((a as { doctor: unknown }).doctor)
    countByDoctor.set(docID, (countByDoctor.get(docID) ?? 0) + 1)
  }
  const doctors = (doctorsRes.docs as User[]).map((d) => {
    const type = (d.availabilityType as string) || 'regular'
    const days = (d.availableDays as string[] | undefined) || []
    const onToday = type !== 'regular' || days.length === 0 || days.includes(todayWeekday)
    const win = windowOf(d)
    return {
      id: String(d.id),
      name: d.name,
      specialty: (d as { specialty?: string }).specialty,
      note:
        type === 'onCall'
          ? 'De guardia'
          : type === 'byAppointment'
            ? 'Previa cita'
            : onToday
              ? `${win.from} – ${win.to}`
              : 'No consulta hoy',
      onToday,
      count: countByDoctor.get(String(d.id)) ?? 0,
    }
  })
  // "viernes, 12 de junio" in the clinic's timezone
  const todayRaw = new Date().toLocaleDateString('es-DO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: tz,
  })
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1)
  // "Dra. Carmen Rosario" → "Dra. Rosario"; "Carmen Rosario" → "Carmen".
  const nameParts = (user.name ?? '').trim().split(/\s+/).filter(Boolean)
  const firstName = /^dra?\.?$/i.test(nameParts[0] ?? '')
    ? nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
      : ''
    : (nameParts[0] ?? '')

  return (
    <div className="space-y-5">
      {showWelcome && (
        <section className="card-flat overflow-hidden border-primary/20 bg-secondary/30">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/15 px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-primary">
                Bienvenido(a) a {APP_NAME}{firstName ? `, ${firstName}` : ''} 👋
              </h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Su consultorio está listo: agregamos algunos datos de ejemplo para que explore.
                Hágalo suyo en tres pasos.
              </p>
            </div>
            <span className="tabular shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {doneCount}/{checklist.length} completados
            </span>
          </div>
          <ol className="divide-y divide-primary/10">
            {checklist.map((step, i) => (
              <li key={step.href}>
                <Link
                  href={step.href}
                  className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-card/60"
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      step.done
                        ? 'bg-primary text-white'
                        : 'border border-primary/30 bg-card text-primary'
                    }`}
                  >
                    {step.done ? <IconCheck size={14} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] font-semibold ${step.done ? 'text-muted-foreground line-through' : 'group-hover:text-primary'}`}>
                      {step.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{step.desc}</span>
                  </span>
                  <IconArrowUpRight
                    size={14}
                    className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-muted-foreground">{today}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
            {greetingFor(tz)}{firstName ? `, ${firstName}` : ''}
          </h1>
        </div>
        <Link href="/dashboard/appointments/new" className={btnPrimary}>
          <IconPlus className="size-4" strokeWidth={1.75} />
          Nueva cita
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          label="Citas de hoy"
          value={data.todayCount}
          icon={<IconCalendar size={17} strokeWidth={1.75} />}
          tone="primary"
        />
        <KpiCard
          label="Atendidas hoy"
          value={data.completedToday}
          icon={<IconCalendarCheck size={17} strokeWidth={1.75} />}
          tone="green"
        />
        <KpiCard
          label="No asistieron hoy"
          value={data.noShowsToday}
          icon={<IconUserX size={17} strokeWidth={1.75} />}
          tone="amber"
        />
        <KpiCard
          label="Pacientes nuevos (7 días)"
          value={data.newPatients7d}
          icon={<IconUserPlus size={17} strokeWidth={1.75} />}
          tone="blue"
        />
      </div>

      {/* Revenue (owner only) */}
      {revenue && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            <KpiCard
              label="Ingresos de hoy"
              value={formatMoney(revenue.revenueToday, tenant)}
              icon={<IconWallet size={17} strokeWidth={1.75} />}
              tone="green"
            />
            <KpiCard
              label="Ingresos del mes"
              value={formatMoney(revenue.revenueMonth, tenant)}
              icon={<IconArrowUpRight size={17} strokeWidth={1.75} />}
              tone="primary"
            />
            <KpiCard
              label="Saldo pendiente"
              value={formatMoney(revenue.outstandingTotal, tenant)}
              hint="Facturas pendientes y parciales"
              icon={<IconReceipt size={17} strokeWidth={1.75} />}
              tone="amber"
            />
          </div>

          {revenue.outstanding.length > 0 && (
            <section className="card-flat overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <h2 className="font-display text-lg font-semibold">Saldos pendientes</h2>
                <span className="tabular text-xs text-faint">
                  Total: {formatMoney(revenue.outstandingTotal, tenant)}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {revenue.outstanding.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/dashboard/invoices/${o.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-secondary/40"
                    >
                      <span className="tabular w-20 shrink-0 text-[13px] font-medium">{o.invoiceNumber}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">{o.patientName}</span>
                      <span className="tabular shrink-0 font-semibold text-amber">
                        {formatMoney(o.balanceDue, { settings: { currency: o.currency } })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Revenue per day (owner only) */}
          <section className="card-flat flex flex-col p-5 sm:p-6">
            <div className="mb-5 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Ingresos</h2>
              <span className="text-xs text-faint">Últimos 14 días</span>
            </div>
            <div className="my-auto">
              <RevenueChart data={revenue.series} currency={revenue.currency} />
            </div>
          </section>
        </>
      )}

      {/* Chart + up-next */}
      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        <section className="card-flat flex flex-col p-5 sm:p-6 xl:col-span-2">
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Actividad</h2>
            <span className="text-xs text-faint">Últimos 14 días</span>
          </div>
          <div className="my-auto">
            <BarChart data={data.series} />
          </div>
        </section>

        <section className="card-flat flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Próximas citas de hoy</h2>
            <Link
              href="/dashboard/appointments"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
            >
              Agenda del día
              <IconArrowUpRight size={13} strokeWidth={2} />
            </Link>
          </div>
          {data.upcoming.length === 0 ? (
            <EmptyState
              message="No quedan citas para hoy."
              action={
                <Link
                  href="/dashboard/appointments/new"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Agendar una
                </Link>
              }
            />
          ) : (
            <ul className="flex-1 divide-y divide-border">
              {data.upcoming.slice(0, 7).map((appt) => {
                const patient = appt.patient as Patient
                const doctor = appt.doctor as User
                return (
                  <li key={appt.id}>
                    <Link
                      href="/dashboard/appointments"
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-secondary/40"
                    >
                      <Avatar name={patient?.name ?? 'Paciente'} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">
                          {patient?.name ?? 'Paciente'}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {doctor?.name}
                          {appt.reason ? ` · ${appt.reason}` : ''}
                        </span>
                      </span>
                      <span className="tabular shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-semibold">
                        {formatTime(appt.start, tenant)}
                      </span>
                      <StatusBadge status={appt.status} className="hidden sm:inline-flex" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Doctors today · Quick actions · Recent patients */}
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        <section className="card-flat overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Médicos hoy</h2>
            <span className="tabular text-xs text-faint">
              {doctors.filter((d) => d.onToday).length} en consulta
            </span>
          </div>
          <ul className="divide-y divide-border">
            {doctors.map((d) => (
              <li key={d.id} className={`flex items-center gap-3 px-5 py-2.5 ${d.onToday ? '' : 'opacity-50'}`}>
                <Avatar name={d.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{d.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {d.specialty ? `${d.specialty} · ` : ''}
                    {d.note}
                  </span>
                </span>
                {d.count > 0 && (
                  <span className="tabular shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-primary">
                    {d.count}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="card-flat overflow-hidden">
          <div className="border-b px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Acciones rápidas</h2>
          </div>
          <ul className="divide-y divide-border">
            {[
              {
                href: '/dashboard/appointments/new',
                icon: <IconPlus size={16} strokeWidth={1.75} />,
                title: 'Nueva cita',
                desc: 'Agende un horario o registre un paciente sin cita',
              },
              {
                href: '/dashboard/patients/new',
                icon: <IconUserPlus size={16} strokeWidth={1.75} />,
                title: 'Registrar paciente',
                desc: 'Basta con nombre y teléfono',
              },
              {
                href: '/dashboard/appointments',
                icon: <IconCalendar size={16} strokeWidth={1.75} />,
                title: 'Abrir la fila de hoy',
                desc: 'Registre llegadas y complete consultas',
              },
              ...(user.role === 'owner'
                ? [
                    {
                      href: '/dashboard/staff',
                      icon: <IconStaff size={16} strokeWidth={1.75} />,
                      title: 'Gestionar equipo',
                      desc: 'Médicos, horarios y roles',
                    },
                  ]
                : []),
            ].map((a) => (
              <li key={a.href + a.title}>
                <Link
                  href={a.href}
                  className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-secondary/40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    {a.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold group-hover:text-primary">
                      {a.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{a.desc}</span>
                  </span>
                  <IconArrowUpRight
                    size={14}
                    className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="card-flat overflow-hidden md:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Pacientes recientes</h2>
            <Link
              href="/dashboard/patients"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
            >
              Todos los pacientes
              <IconArrowUpRight size={13} strokeWidth={2} />
            </Link>
          </div>
          {recentPatients.length === 0 ? (
            <EmptyState
              message="Aún no hay pacientes registrados."
              action={
                <Link
                  href="/dashboard/patients/new"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Registrar el primero
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentPatients.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/dashboard/patients/${p.id}`}
                    className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-secondary/40"
                  >
                    <Avatar name={p.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{p.name}</span>
                      <span className="tabular block truncate text-xs text-muted-foreground">
                        {p.phone}
                      </span>
                    </span>
                    <span className="tabular shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {p.mrn}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
