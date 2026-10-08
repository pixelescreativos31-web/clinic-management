import Link from 'next/link'
import { connection } from 'next/server'
import Image from 'next/image'
import { btnPrimary, btnGhost } from '@/components/primitives'
import {
  IconCalendar,
  IconUsers,
  IconArrowRight,
  IconCheck,
  IconStethoscope,
  IconBuilding,
  IconStaff,
  IconUserPlus,
  IconCalendarCheck,
  IconPrinter,
  IconReceipt,
  IconWhatsApp,
} from '@/components/icons'
import { APP_NAME, APP_TAGLINE, BASED_ON } from '@/lib/brand'
import { PLAN_LIMITS } from '@/lib/plans'
import { PricingTabs } from '@/components/PricingTabs'

// Demo logins only exist on the demo instance (SHOW_DEMO=1, seeded with `pnpm seed`),
// never on the real one, which links out to DEMO_URL instead. Read at request time
// so one image serves both deployments.

const STEPS = [
  {
    n: '01',
    icon: IconUserPlus,
    title: 'Registre a su paciente',
    body: 'Con el nombre y el teléfono basta. Se le asigna un número de expediente y su historia clínica empieza a crecer.',
  },
  {
    n: '02',
    icon: IconCalendar,
    title: 'Agende la cita o atiéndalo sin cita',
    body: 'Su asistente ve los horarios libres al instante. Quien llega sin cita recibe su turno en un toque.',
  },
  {
    n: '03',
    icon: IconCalendarCheck,
    title: 'Consulte, recete y cobre',
    body: 'Registre la consulta, imprima la receta y emita la factura desde la misma pantalla.',
  },
]

const FEATURES = [
  {
    icon: IconCalendar,
    title: 'Agenda de citas',
    body: 'Su agenda del día en una sola pantalla: citas programadas, pacientes sin cita y nunca dos citas a la misma hora.',
  },
  {
    icon: IconUsers,
    title: 'Expediente e historia clínica',
    body: 'Cada paciente con su expediente: alergias bien visibles, signos vitales, diagnósticos y todas sus consultas.',
  },
  {
    icon: IconPrinter,
    title: 'Recetas imprimibles',
    body: 'Escriba la receta durante la consulta e imprímala con los datos de su consultorio, lista para entregar.',
  },
  {
    icon: IconReceipt,
    title: 'Facturación simple',
    body: 'Facture la consulta, registre pagos en efectivo, tarjeta o transferencia y vea el saldo pendiente de un vistazo.',
  },
  {
    icon: IconWhatsApp,
    title: 'Recordatorios por WhatsApp',
    body: 'Con un clic se abre WhatsApp con el recordatorio de la cita ya escrito. Menos pacientes que no asisten.',
  },
  {
    icon: IconStaff,
    title: 'Usted y su asistente',
    body: 'Usted ve la parte clínica; su asistente maneja la agenda y los cobros. Cada quien ve solo lo que necesita.',
  },
]

const DEMO_LOGINS = [
  {
    label: 'Asistente',
    clinic: 'Consultorio Dra. Carmen Rosario',
    email: 'asistente@demo.app',
    blurb: 'Agendar citas, registrar llegadas, atender sin cita',
    icon: IconUsers,
  },
  {
    label: 'Doctora (titular)',
    clinic: 'Consultorio Dra. Carmen Rosario',
    email: 'doctora@demo.app',
    blurb: 'Agenda, consultas, recetas, cobros y configuración',
    icon: IconBuilding,
  },
  {
    label: 'Médico de clínica',
    clinic: 'Clínica con varios médicos',
    email: 'doctor1@clinica.app',
    blurb: 'Su propia agenda y pacientes dentro de una clínica',
    icon: IconStethoscope,
  },
]

export default async function HomePage() {
  await connection()
  const SHOW_DEMO = process.env.SHOW_DEMO === '1'
  const DEMO_URL = process.env.DEMO_URL?.replace(/\/+$/, '')
  const demoHref = SHOW_DEMO ? '#demo' : DEMO_URL ? `${DEMO_URL}/#demo` : null
  return (
    <main className="min-h-screen bg-canvas">
      {/* ---------------- Nav ---------------- */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
              </svg>
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-primary">{APP_NAME}</span>
          </span>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#how" className="hidden px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-ink md:block">
              Cómo funciona
            </a>
            <a href="#features" className="hidden px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-ink md:block">
              Funciones
            </a>
            <a href="#precios" className="hidden px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-ink md:block">
              Precios
            </a>
            {demoHref && (
              <a href={demoHref} className="hidden px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-ink sm:block">
                Demostración
              </a>
            )}
            <Link href="/login" className={btnGhost}>
              Iniciar sesión
            </Link>
            <Link href="/signup" className={btnPrimary}>
              Crear cuenta
            </Link>
          </nav>
        </div>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 60% 55% at 75% 0%, rgb(13 110 96 / 0.09), transparent), radial-gradient(rgb(24 35 32 / 0.05) 1px, transparent 1px)',
            backgroundSize: 'auto, 28px 28px',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pt-14 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
          {/* Copy */}
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-secondary px-3 py-1 text-xs font-medium text-primary">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
              </span>
              {APP_TAGLINE}
            </span>
            <h1 className="mt-6 max-w-xl font-display text-[2.6rem] leading-[1.06] font-semibold sm:text-[3.6rem]">
              Atienda a sus pacientes,
              <br />
              <span className="relative inline-block text-primary">
                no al papeleo.
                <svg
                  viewBox="0 0 220 10"
                  className="absolute -bottom-2 start-0 w-full text-primary/30"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path d="M2 8c40-5 140-7 216-3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
                </svg>
              </span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Agenda de citas, historia clínica, recetas imprimibles, facturación y recordatorios
              por WhatsApp. Todo lo que necesita su consultorio, en una pantalla sencilla para
              usted y su asistente.
            </p>
            <p className="mt-2 text-sm text-faint">
              Desde <strong className="font-semibold text-ink">US${PLAN_LIMITS.pro.priceUsd}/mes</strong> por médico con su asistente.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className={btnPrimary}>
                Crear cuenta
                <IconArrowRight size={15} />
              </Link>
              {demoHref ? (
                <a href={demoHref} className={btnGhost}>
                  Pruebe la demostración
                </a>
              ) : (
                <a href="#precios" className={btnGhost}>
                  Ver precios
                </a>
              )}
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
              {['Sin citas duplicadas', 'Recordatorios por WhatsApp', 'Recetas listas para imprimir'].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <IconCheck size={13} strokeWidth={2.5} className="text-primary" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Photo + floating product cards */}
          <div className="relative animate-fade-up [animation-delay:80ms]">
            <div className="relative mx-auto aspect-[4/4.4] max-w-[440px] overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_30px_70px_-30px_rgb(13_110_96/0.45)]">
              <Image
                src="/images/hero-doctor2.jpg"
                alt="Médica en su consultorio"
                fill
                priority
                sizes="(min-width: 1024px) 440px, 90vw"
                className="object-cover object-[60%_20%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-sidebar/45 via-transparent to-transparent" />
            </div>

            {/* floating: doctor schedule chip */}
            <div className="absolute -start-2 top-8 w-[200px] rounded-xl border border-border bg-card/95 p-3 shadow-[0_14px_36px_-14px_rgb(24_35_32/0.35)] backdrop-blur sm:-start-6">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-primary">
                  CR
                </span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[12px] font-semibold">Dra. Carmen Rosario</div>
                  <div className="tabular mt-0.5 text-[10px] text-muted-foreground">
                    9:00 – 12:00 · 4 citas
                  </div>
                </div>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-2/3 rounded-full bg-primary" />
              </div>
            </div>

            {/* floating: live appointment card */}
            <div className="absolute -end-2 bottom-10 w-[224px] rounded-xl border border-border bg-card/95 p-3 shadow-[0_14px_36px_-14px_rgb(24_35_32/0.35)] backdrop-blur sm:-end-5">
              <div className="flex items-center justify-between gap-2">
                <span className="tabular text-[12px] font-bold">11:20 a. m.</span>
                <span className="rounded bg-blue-soft px-1.5 py-0.5 text-[10px] font-bold text-blue">T-03</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-blue-soft text-[10px] font-semibold text-blue">
                  MP
                </span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[12px] font-semibold">María Peña</div>
                  <div className="truncate text-[10px] text-muted-foreground">Fiebre · sin cita</div>
                </div>
              </div>
              <button className="mt-2.5 w-full cursor-default rounded-lg bg-primary py-1.5 text-[11px] font-semibold text-white">
                Registrar llegada
              </button>
            </div>

            {/* floating: guard chip */}
            <div className="absolute end-6 -top-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-1.5 text-[11px] font-semibold text-green-strong shadow-[0_10px_26px_-12px_rgb(24_35_32/0.3)] backdrop-blur">
              <IconCheck size={12} strokeWidth={3} />
              Cita duplicada evitada
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Demo stats strip ---------------- */}
      <section className="border-y border-border/70 bg-card">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-border/70 px-6 sm:grid-cols-4">
          {[
            { v: `US$${PLAN_LIMITS.pro.priceUsd}`, l: 'al mes por médico' },
            { v: '1 + 1', l: 'usted y su asistente' },
            { v: '0', l: 'citas duplicadas' },
            { v: 'WhatsApp', l: 'recordatorios en un clic' },
          ].map((s) => (
            <div key={s.l} className="px-4 py-6 text-center sm:py-7">
              <div className="tabular font-display text-2xl font-semibold text-primary sm:text-3xl">{s.v}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
        <div className="mx-auto max-w-xl text-center">
          <span className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Cómo funciona</span>
          <h2 className="mt-3 font-display text-3xl font-semibold">
            Una consulta, en tres pasos
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Pensado para el día a día de un consultorio: si sabe usar un celular, sabe usar{' '}
            {APP_NAME}.
          </p>
        </div>
        <div className="relative mt-12 grid gap-5 md:grid-cols-3">
          {/* connecting line */}
          <div className="pointer-events-none absolute inset-x-16 top-[2.4rem] hidden border-t-2 border-dashed border-border md:block" />
          {STEPS.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.n} className="card-flat relative p-6 pt-7">
                <div className="flex items-center gap-3">
                  <span className="relative flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary ring-4 ring-canvas">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <span className="tabular font-display text-sm font-semibold text-faint">{s.n}</span>
                </div>
                <h3 className="mt-4 text-[16px] font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ---------------- Product shot ---------------- */}
      <section className="relative overflow-hidden bg-sidebar py-20">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 50% 40% at 50% 0%, rgb(58 214 187 / 0.10), transparent), linear-gradient(rgb(255 255 255 / 0.03) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.03) 1px, transparent 1px)',
            backgroundSize: 'auto, 44px 44px, 44px 44px',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-xl text-center">
            <span className="text-xs font-semibold tracking-[0.14em] text-sidebar-accent uppercase">
              Agenda del día
            </span>
            <h2 className="mt-3 font-display text-3xl font-semibold text-sidebar-active-fg">
              Todo su día en una sola pantalla
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-sidebar-foreground">
              Una lista que su asistente lee de arriba hacia abajo y una línea de tiempo que muestra
              huecos, pacientes sin cita y conflictos de un vistazo.
            </p>
          </div>
          <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-sidebar-soft shadow-[0_40px_90px_-40px_rgb(0_0_0/0.7)]">
            {/* browser chrome */}
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="ms-3 hidden rounded-md bg-white/5 px-3 py-1 text-[11px] text-sidebar-foreground sm:block">
                /dashboard/appointments
              </span>
            </div>
            {/* product screenshot (captured from the real app) */}
            <Image
              src="/images/product-day-view.png"
              alt={`Agenda del día en ${APP_NAME}`}
              width={1600}
              height={950}
              className="block w-full"
            />
          </div>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
        <div className="mx-auto max-w-xl text-center">
          <span className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Funciones</span>
          <h2 className="mt-3 font-display text-3xl font-semibold">
            Consultorio pequeño. Herramientas serias.
          </h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="group card-flat p-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-16px_rgb(24_35_32/0.22)]"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ---------------- Pricing ---------------- */}
      <section id="precios" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-20">
        <div className="mx-auto max-w-xl text-center">
          <span className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Precios</span>
          <h2 className="mt-3 font-display text-3xl font-semibold">Un precio simple, sin sorpresas</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Pague por médico, no por paciente ni por cita. Precios en dólares, mensuales.
          </p>
        </div>
        <PricingTabs />
      </section>

      {/* ---------------- Demo accounts ---------------- */}
      {SHOW_DEMO && (
      <section id="demo" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-20">
        <div className="card-flat overflow-hidden">
          <div className="grid items-center gap-8 p-8 sm:p-10 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <span className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Demostración</span>
              <h2 className="mt-3 font-display text-3xl font-semibold">Entre con cualquier rol</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                Todas las cuentas usan la contraseña{' '}
                <code className="rounded-md border border-border bg-canvas px-1.5 py-0.5 text-[13px] font-semibold">
                  password123
                </code>
                . Cada consultorio ve únicamente sus propios datos: la información de sus pacientes
                nunca se mezcla con la de otro.
              </p>
            </div>
            <div className="grid gap-3">
              {DEMO_LOGINS.map((d) => {
                const Icon = d.icon
                return (
                  <Link
                    key={d.email}
                    href={`/login?email=${encodeURIComponent(d.email)}`}
                    className="group flex items-center gap-4 rounded-xl border border-border bg-canvas/60 px-5 py-4 transition-all hover:border-primary/40 hover:bg-secondary/40"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                      <Icon size={17} strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold group-hover:text-primary">
                        {d.label}
                        <span className="ms-2 text-xs font-normal text-faint">{d.clinic}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">{d.blurb}</span>
                      <span className="tabular mt-0.5 block text-xs text-faint">{d.email}</span>
                    </span>
                    <IconArrowRight
                      size={16}
                      className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    />
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-border/70 bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-faint">
          <span className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded bg-primary text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
              </svg>
            </span>
            <span className="font-display text-sm font-semibold text-primary/80">{APP_NAME}</span>
          </span>
          <span>
            {APP_TAGLINE} · {BASED_ON} · Fotos: Unsplash
          </span>
        </div>
      </footer>
    </main>
  )
}
