// Public marketing homepage — recreated from design_handoff_emr/EMR Frontpage.dc.html
// (high fidelity). Exact colours are kept as Tailwind arbitrary values because the
// homepage palette (paper #f7f6f2, dark hero) is specific to marketing.

import Link from 'next/link'
import Image from 'next/image'
import { connection } from 'next/server'
import { PricingTabs } from '@/components/PricingTabs'
import { FaqList } from '@/components/FaqList'

const FAQS = [
  { q: '¿Necesito instalar algo?', a: 'No. EMR funciona en el navegador de su computadora, tablet o celular. Crea su cuenta y empieza a usarlo el mismo día.' },
  { q: '¿Mis pacientes pueden verse desde otro consultorio?', a: 'Nunca. Cada consultorio tiene sus datos completamente separados; ni siquiera otro médico de la plataforma puede ver sus pacientes.' },
  { q: '¿Qué pasa si llega un paciente sin cita?', a: 'Su asistente le da un turno con un toque. El paciente aparece en la agenda del día con su número de turno, sin desplazar las citas programadas.' },
  { q: '¿Los recordatorios por WhatsApp son automáticos?', a: 'Con un clic se abre WhatsApp con el mensaje ya escrito: fecha, hora y nombre del médico. Usted solo pulsa enviar, desde su propio número.' },
  { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. No hay contrato ni permanencia. Si cancela, puede exportar sus pacientes y consultas antes de cerrar la cuenta.' },
]

const STATS = [
  { n: '0', t: 'Citas duplicadas', d: 'El sistema bloquea dos citas a la misma hora, aunque las agenden dos personas a la vez.' },
  { n: '1 clic', t: 'Recordatorio por WhatsApp', d: 'Mensaje listo con fecha, hora y médico. Menos pacientes que no asisten.' },
  { n: '5 min', t: 'Para empezar, gratis', d: 'Cree su consultorio con 1 médico y hasta 50 pacientes sin pagar nada.' },
]

const STEPS = [
  { t: 'Registre al paciente', d: 'Nombre y teléfono. EMR asigna el número de expediente y la historia clínica empieza a crecer desde la primera visita.' },
  { t: 'Agende, o atienda sin cita', d: 'Su asistente ve los horarios libres al instante. Quien llega sin cita recibe su turno con un toque, sin pisar a nadie.' },
  { t: 'Consulte, recete y cobre', d: 'Anote la consulta, imprima la receta con sus datos y emita la factura. Todo desde la misma pantalla, sin cambiar de sistema.' },
]

const FEATURES = [
  { t: 'Agenda de citas', d: 'Citas programadas y pacientes sin cita en la misma lista. Nunca dos citas a la misma hora: el sistema no lo permite.', bg: 'bg-[#e2efec]', num: 'text-[#0d6e60]' },
  { t: 'Expediente e historia clínica', d: 'Alergias bien visibles, signos vitales, diagnósticos y todas las consultas anteriores, ordenadas por fecha.', bg: 'bg-white', num: 'text-[#97a09a]' },
  { t: 'Recetas imprimibles', d: 'Escriba la receta durante la consulta e imprímala con el membrete de su consultorio, lista para entregar.', bg: 'bg-[#e9f0f9]', num: 'text-[#2563ab]' },
  { t: 'Facturación simple', d: 'Facture la consulta, registre pagos en efectivo, tarjeta o transferencia y vea el saldo pendiente de un vistazo.', bg: 'bg-white', num: 'text-[#97a09a]' },
  { t: 'Recordatorios por WhatsApp', d: 'Un clic abre WhatsApp con el recordatorio ya escrito, con fecha, hora y nombre del médico. Menos ausencias.', bg: 'bg-[#e8f4ec]', num: 'text-[#1a7a50]' },
  { t: 'Usted y su asistente', d: 'Usted ve la parte clínica; su asistente maneja agenda y cobros. Cada quien ve solo lo que necesita.', bg: 'bg-white', num: 'text-[#97a09a]' },
]

// Demo logins live on the separate demo instance (seeded, password123). The
// platform super admin is deliberately NOT offered: its password would be public.
const DEMO_LOGINS = [
  { label: 'Asistente', clinic: 'Consultorio Dra. Carmen Rosario', blurb: 'Agendar citas, registrar llegadas, atender sin cita', email: 'asistente@demo.app' },
  { label: 'Doctora (titular)', clinic: 'Consultorio Dra. Carmen Rosario', blurb: 'Agenda, consultas, recetas, cobros y configuración', email: 'doctora@demo.app' },
  { label: 'Médico de clínica', clinic: 'Centro Médico Los Prados', blurb: 'Su agenda y sus pacientes dentro de una clínica', email: 'doctor1@clinica.app' },
]

const HERO_APPTS = [
  { time: '9:00', init: 'JR', name: 'José Rodríguez', note: 'Control · hipertensión', badge: 'Atendido', avatar: 'bg-[#e8f4ec] text-[#1a7a50]', tag: 'bg-[#e8f4ec] text-[#1a7a50]', row: 'bg-[#f7f6f2]' },
  { time: '9:30', init: 'AM', name: 'Ana Martínez', note: 'Primera consulta', badge: 'En sala', avatar: 'bg-[#e9f0f9] text-[#2563ab]', tag: 'bg-[#e9f0f9] text-[#2563ab]', row: '' },
  { time: '10:00', init: 'MP', name: 'María Peña', note: 'Fiebre · sin cita', badge: 'T-03', avatar: 'bg-[#faf3e6] text-[#b45309]', tag: 'bg-[#e9f0f9] text-[#2563ab] font-bold', row: 'border border-dashed border-[#0d6e60] bg-[#f3faf8]', now: true },
  { time: '10:30', init: 'LG', name: 'Luis García', note: 'Resultados de laboratorio', badge: 'Programada', avatar: 'bg-[#e2efec] text-[#0d6e60]', tag: 'bg-[#e2efec] text-[#0d6e60]', row: '' },
]

const H2 = 'mt-3 font-display text-[clamp(30px,3.6vw,42px)] leading-[1.08] font-bold tracking-[-.02em] text-balance'
const EYEBROW = 'text-xs font-semibold tracking-[.14em] text-[#0d6e60] uppercase'

function Logo({ size = 30 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-lg bg-[#3ad6bb] font-display text-[13px] font-bold text-[#0c211d]"
    >
      +
    </span>
  )
}

export default async function HomePage() {
  await connection()
  // The real site links its demo cards to the demo instance (DEMO_URL); the demo
  // instance itself (SHOW_DEMO=1) links to its own login.
  const showDemo = process.env.SHOW_DEMO === '1'
  const demoBase = showDemo ? '' : process.env.DEMO_URL?.replace(/\/+$/, '') ?? null
  const supportWa = process.env.SUPPORT_WHATSAPP?.replace(/[^0-9]/g, '')
  const supportHref = supportWa ? `https://wa.me/${supportWa}` : 'mailto:gelinson@pixelescreativos.com.do'

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f6f2] text-base leading-normal text-[#182320]">
      {/* ---------------- Nav ---------------- */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[rgba(12,33,29,.92)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 px-6">
          <a href="#top" className="flex items-center gap-2.5 text-[#f3f7f5] hover:text-[#f3f7f5]">
            <Logo />
            <span className="font-display text-xl font-bold tracking-[-.02em]">EMR</span>
          </a>
          <nav className="hidden items-center gap-1 md:flex">
            {[
              ['#how', 'Cómo funciona'],
              ['#features', 'Funciones'],
              ['#precios', 'Precios'],
              ['#faq', 'Preguntas'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="px-3 py-2 text-sm font-medium text-[#9fb5ae] transition-colors hover:text-[#f3f7f5]">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg border border-white/18 px-3.5 py-[9px] text-sm font-medium text-[#f3f7f5] transition-colors hover:bg-white/6 hover:text-[#f3f7f5]">
              Iniciar sesión
            </Link>
            <Link href="/signup" className="rounded-lg bg-[#3ad6bb] px-3.5 py-[9px] text-sm font-semibold text-[#0c211d] transition-colors hover:bg-[#5ee2cb] hover:text-[#0c211d]">
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section id="top" className="relative overflow-hidden bg-[linear-gradient(135deg,#0c211d_0%,#0d4a42_55%,#0d6e60_100%)] text-[#f3f7f5]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_70%_at_85%_20%,rgba(58,214,187,.28),transparent_70%),radial-gradient(ellipse_40%_50%_at_10%_100%,rgba(58,214,187,.12),transparent_70%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] bg-size-[48px_48px]"
        />
        <div className="relative mx-auto grid max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-center gap-14 px-6 pt-[72px] pb-32">
          <div className="animate-[emr-fade_.5s_ease-out_both]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(58,214,187,.35)] bg-[rgba(58,214,187,.08)] px-3 py-[5px] text-xs font-semibold tracking-[.02em] text-[#3ad6bb]">
              <span className="relative inline-flex size-[7px]">
                <span className="absolute inset-0 animate-[emr-ping_2s_ease-out_infinite] rounded-full bg-[#3ad6bb]" />
                <span className="relative size-[7px] rounded-full bg-[#3ad6bb]" />
              </span>
              Historia clínica digital para médicos y clínicas
            </span>
            <h1 className="mt-6 max-w-[11ch] font-display text-[clamp(40px,5.2vw,64px)] leading-[1.02] font-bold tracking-[-.025em] text-balance">
              Su consulta, sin papeleo.
            </h1>
            <p className="mt-6 max-w-[460px] text-lg leading-[1.55] text-pretty text-[#9fb5ae]">
              Agenda, historia clínica, recetas, facturación y recordatorios por WhatsApp. Una sola pantalla para su consultorio o
              clínica, lista en cinco minutos.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-[10px] bg-[#3ad6bb] px-[22px] py-3.5 font-semibold text-[#0c211d] transition-colors hover:bg-[#5ee2cb] hover:text-[#0c211d]">
                Crear cuenta <span aria-hidden>→</span>
              </Link>
              {demoBase !== null && (
                <a href="#demo" className="inline-flex items-center rounded-[10px] border border-white/20 px-[22px] py-3.5 font-medium text-[#f3f7f5] transition-colors hover:bg-white/6 hover:text-[#f3f7f5]">
                  Ver la demostración
                </a>
              )}
            </div>
            <p className="mt-5 text-sm text-[#9fb5ae]">
              Empiece <strong className="font-semibold text-[#f3f7f5]">gratis</strong>; planes desde US$25 al mes por médico. Sin costo
              por paciente.
            </p>
          </div>

          {/* Hero mockup: photo + today's agenda + WhatsApp bubble */}
          <div className="relative flex min-h-[520px] animate-[emr-fade_.6s_.1s_ease-out_both] items-end justify-start pb-7">
            <div className="absolute top-0 right-0 aspect-[4/4.8] w-[min(80%,420px)] overflow-hidden rounded-3xl border border-white/14 shadow-[0_40px_90px_-30px_rgba(0,0,0,.6)]">
              <Image
                src="/images/hero-doctor2.jpg"
                alt="Médico sonriente en su consultorio"
                fill
                priority
                sizes="(max-width: 768px) 80vw, 420px"
                className="object-cover object-[35%_15%]"
              />
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(12,33,29,.75),rgba(13,110,96,.1)_60%,transparent)]" />
            </div>
            <div className="relative mt-[200px] w-[min(78%,340px)] overflow-hidden rounded-[14px] border border-[#e6e4dc] bg-white text-xs text-[#182320] shadow-[0_40px_90px_-30px_rgba(0,0,0,.7)]">
              <div className="flex items-center justify-between gap-3 border-b border-[#e6e4dc] px-4 py-3.5">
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold tracking-[-.01em]">Agenda de hoy</div>
                  <div className="mt-px truncate text-xs text-[#65716c]">Jueves 8 de octubre · 7 citas</div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#e2efec] px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-[#0d6e60]">
                  ● Dra. Rosario
                </span>
              </div>
              <div className="flex flex-col gap-1 px-2.5 py-2">
                {HERO_APPTS.map((a) => (
                  <div key={a.time} className={`grid grid-cols-[52px_1fr_auto] items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] ${a.row}`}>
                    <span className={`tabular text-[13px] font-semibold ${a.now ? 'text-[#0d6e60]' : 'text-[#65716c]'}`}>{a.time}</span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`flex size-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${a.avatar}`}>{a.init}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold">{a.name}</span>
                        <span className="block truncate text-[11px] text-[#65716c]">{a.note}</span>
                      </span>
                    </span>
                    <span className={`tabular rounded-md px-2 py-[3px] text-[11px] font-semibold ${a.tag}`}>{a.badge}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 border-t border-[#e6e4dc] px-4 pt-2.5 pb-3.5">
                <span className="flex-1 rounded-lg bg-[#0d6e60] p-[9px] text-center text-[13px] font-semibold text-white">Registrar llegada</span>
                <span className="rounded-lg border border-[#e6e4dc] px-3 py-[9px] text-[13px] font-medium">Sin cita</span>
              </div>
            </div>
            <div className="absolute right-[-8px] bottom-[150px] w-[200px] rounded-[14px] border border-[#e6e4dc] bg-white p-3 text-[#182320] shadow-[0_18px_40px_-16px_rgba(0,0,0,.5)]">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-[#1a7a50]">
                <span className="flex size-[18px] items-center justify-center rounded-full bg-[#1a7a50] text-[10px] text-white">W</span>
                Recordatorio listo
              </div>
              <div className="mt-2 rounded-[10px_10px_10px_2px] bg-[#e8f4ec] px-2.5 py-2 text-xs leading-[1.4]">
                Hola Ana, le recordamos su cita mañana a las <strong>9:30 a. m.</strong> con la Dra. Rosario. Responda SÍ para confirmar.
              </div>
            </div>
            <div className="absolute bottom-1.5 left-[-10px] inline-flex items-center gap-2 rounded-full border border-[#e6e4dc] bg-white px-3.5 py-2 text-xs font-semibold text-[#1a7a50] shadow-[0_14px_30px_-14px_rgba(0,0,0,.5)]">
              <span className="flex size-4 items-center justify-center rounded-full bg-[#e8f4ec] text-[10px]">✓</span>
              Cita duplicada evitada
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Why EMR strip ---------------- */}
      <section className="relative z-[2] -mt-14 px-6">
        <div className="mx-auto grid max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] overflow-hidden rounded-[20px] border border-[#e6e4dc] bg-white shadow-[0_30px_60px_-30px_rgba(12,33,29,.45)]">
          <div className="flex flex-col justify-center gap-2.5 bg-[#0d6e60] p-7 text-[#f3f7f5]">
            <span className="text-[11px] font-semibold tracking-[.14em] text-[#3ad6bb] uppercase">Por qué EMR</span>
            <p className="font-display text-xl leading-[1.25] font-semibold tracking-[-.01em] text-balance">
              Menos tiempo en la computadora, más tiempo con el paciente.
            </p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
            {STATS.map((s) => (
              <div key={s.t} className="flex flex-col gap-1.5 border-[#e6e4dc] p-7 not-last:border-r not-last:border-b">
                <div className="tabular font-display text-[40px] leading-none font-bold tracking-[-.03em] text-[#0d6e60]">{s.n}</div>
                <div className="mt-1.5 text-[15px] font-semibold">{s.t}</div>
                <div className="text-[13px] leading-[1.45] text-[#65716c]">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how" className="mx-auto max-w-[1120px] scroll-mt-20 px-6 pt-24 pb-20">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-end gap-10">
          <div>
            <span className={EYEBROW}>Cómo funciona</span>
            <h2 className={H2}>Una consulta, en tres pasos</h2>
          </div>
          <p className="max-w-[440px] text-[17px] text-pretty text-[#65716c]">
            Pensado para el ritmo real de un consultorio o una clínica. Si sabe usar WhatsApp, sabe usar EMR.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {STEPS.map((s, i) => {
            const first = i === 0
            return (
              <div
                key={s.t}
                className={`relative flex min-h-[320px] flex-col justify-end overflow-hidden rounded-[18px] border px-7 pt-40 pb-8 ${
                  first ? 'border-[#0d6e60] bg-[#0d6e60] text-[#f3f7f5]' : 'border-[#e6e4dc] bg-white'
                }`}
              >
                <div
                  aria-hidden
                  className={`pointer-events-none absolute -top-12 -right-[18px] font-display text-[240px] leading-none font-bold tracking-[-.06em] select-none ${
                    first ? 'text-[rgba(58,214,187,.22)]' : 'text-[#e2efec]'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="relative font-display text-[22px] font-semibold tracking-[-.01em]">{s.t}</h3>
                <p className={`relative mt-2.5 text-[15px] leading-[1.55] ${first ? 'text-[#cfe3dd]' : 'text-[#65716c]'}`}>{s.d}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ---------------- Day view ---------------- */}
      <section className="border-y border-[#e6e4dc] bg-white">
        <div className="mx-auto max-w-[1120px] px-6 py-[88px]">
          <div className="max-w-[640px]">
            <span className={EYEBROW}>Agenda del día</span>
            <h2 className={H2}>Todo su día en una sola pantalla</h2>
            <p className="mt-4 text-[17px] text-pretty text-[#65716c]">
              Una lista que su asistente lee de arriba hacia abajo y una línea de tiempo que muestra huecos, pacientes sin cita y
              conflictos de un vistazo.
            </p>
          </div>
          <div className="mt-12 overflow-hidden rounded-2xl border border-[#e6e4dc] bg-[#f7f6f2] shadow-[0_30px_70px_-40px_rgba(24,35,32,.4)]">
            <div className="flex items-center gap-1.5 border-b border-[#e6e4dc] bg-white px-4 py-3">
              {[0, 1, 2].map((d) => (
                <span key={d} className="size-2.5 rounded-full bg-[#e6e4dc]" />
              ))}
              <span className="ml-3 truncate rounded-md bg-[#f7f6f2] px-3 py-1 text-[11px] text-[#65716c]">emr.pixelescreativos.com.do/agenda</span>
            </div>
            <div className="flex min-h-[420px]">
              <aside className="hidden w-[200px] shrink-0 flex-col gap-1 bg-[#0c211d] px-3.5 py-5 text-[13px] text-[#9fb5ae] md:flex">
                <div className="flex items-center gap-2 px-2 pb-4 font-display text-base font-bold text-[#f3f7f5]">
                  <Logo size={22} />
                  EMR
                </div>
                <div className="px-2 py-1.5 text-[10px] tracking-[.12em] text-[#65716c] uppercase">Consultorio</div>
                <div className="rounded-lg bg-[#122b26] px-2.5 py-2 font-medium text-[#f3f7f5]">Agenda</div>
                {['Pacientes', 'Facturas', 'Reportes'].map((x) => (
                  <div key={x} className="px-2.5 py-2">{x}</div>
                ))}
                <div className="mt-2 px-2 py-1.5 text-[10px] tracking-[.12em] text-[#65716c] uppercase">Administrar</div>
                {['Equipo', 'Configuración'].map((x) => (
                  <div key={x} className="px-2.5 py-2">{x}</div>
                ))}
              </aside>
              <div className="min-w-0 flex-1 px-6 py-[22px]">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="font-display text-[22px] font-semibold tracking-[-.01em]">Agenda</div>
                    <div className="text-[13px] text-[#65716c]">Jueves 8 de octubre · 11 citas</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-[#e6e4dc] bg-white px-3 py-[7px] text-xs font-medium">Hoy</span>
                    <span className="rounded-lg bg-[#0d6e60] px-3 py-[7px] text-xs font-semibold text-white">+ Nueva cita</span>
                  </div>
                </div>
                <div className="mt-[18px] grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
                  <div className="overflow-hidden rounded-xl border border-[#e6e4dc] bg-white">
                    <div className="border-b border-[#e6e4dc] px-3.5 py-2.5 text-[11px] font-semibold tracking-[.1em] text-[#65716c] uppercase">
                      Lista · Dra. Rosario
                    </div>
                    {[
                      ['9:00', 'José Rodríguez', 'bg-[#1a7a50]'],
                      ['9:30', 'Ana Martínez', 'bg-[#2563ab]'],
                      ['10:00', 'María Peña', 'bg-[#2563ab]', 'T-03'],
                      ['10:30', 'Luis García', 'bg-[#0d6e60]'],
                      ['11:00', 'Carla Díaz', 'bg-[#0d6e60]'],
                    ].map(([t, n, dot, tok]) => (
                      <div
                        key={t}
                        className={`grid grid-cols-[52px_1fr_auto] items-center gap-2.5 border-b border-[#efeee8] px-3.5 py-2.5 text-[13px] ${tok ? 'bg-[#f3faf8]' : ''}`}
                      >
                        <span className={`tabular ${tok ? 'font-semibold text-[#0d6e60]' : 'text-[#65716c]'}`}>{t}</span>
                        <span className="font-medium">
                          {n}
                          {tok && <span className="ml-1 rounded bg-[#e9f0f9] px-[5px] py-px text-[10px] font-bold text-[#2563ab]">{tok}</span>}
                        </span>
                        <span className={`size-2 rounded-full ${dot}`} />
                      </div>
                    ))}
                    <div className="grid grid-cols-[52px_1fr_auto] items-center gap-2.5 px-3.5 py-2.5 text-[13px]">
                      <span className="tabular text-[#65716c]">11:30</span>
                      <span className="font-medium text-[#97a09a]">Pedro Núñez</span>
                      <span className="rounded bg-[#faf3e6] px-1.5 py-px text-[10px] text-[#b45309]">No asistió</span>
                    </div>
                  </div>
                  <div className="relative overflow-hidden rounded-xl border border-[#e6e4dc] bg-white">
                    <div className="border-b border-[#e6e4dc] px-3.5 py-2.5 text-[11px] font-semibold tracking-[.1em] text-[#65716c] uppercase">
                      Línea de tiempo
                    </div>
                    <div className="relative pt-2 pr-3.5 pb-3.5 pl-14">
                      <div className="tabular absolute top-3 bottom-3.5 left-3.5 flex w-[30px] flex-col justify-between text-[10px] text-[#97a09a]">
                        <span>9 am</span>
                        <span>10 am</span>
                        <span>11 am</span>
                        <span>12 pm</span>
                      </div>
                      <div className="relative h-[280px] border-l border-[#efeee8]">
                        {[0, 70, 140].map((top) => (
                          <div key={top} style={{ top }} className="absolute inset-x-0 h-[70px] border-t border-[#efeee8]" />
                        ))}
                        <div className="absolute inset-x-0 top-[210px] h-[70px] border-y border-[#efeee8] bg-[#f1f0ea]" />
                        {[
                          [2, '9:00', 'José Rodríguez', 'border-l-[3px] border-[#1a7a50] bg-[#e8f4ec]'],
                          [37, '9:30', 'Ana Martínez', 'border-l-[3px] border-[#2563ab] bg-[#e9f0f9]'],
                          [72, '10:00', 'María Peña · sin cita', 'border border-dashed border-[#2563ab] bg-white'],
                          [107, '10:30', 'Luis García', 'border-l-[3px] border-[#0d6e60] bg-[#e2efec]'],
                          [142, '11:00', 'Carla Díaz', 'border-l-[3px] border-[#0d6e60] bg-[#e2efec]'],
                        ].map(([top, t, n, cls]) => (
                          <div key={String(t)} style={{ top: Number(top) }} className={`absolute inset-x-2 h-[30px] truncate rounded-md px-2 py-1 text-[11px] font-medium ${cls}`}>
                            <span className="tabular mr-1.5 text-[#65716c]">{t}</span>
                            {n}
                          </div>
                        ))}
                        <div className="absolute inset-x-0 top-[104px] border-t-2 border-[#b3261e]" />
                        <div className="tabular absolute top-24 left-[-46px] rounded bg-[#b3261e] px-1.5 py-px text-[10px] font-semibold text-white">10:41</div>
                        <div className="absolute inset-x-2 top-[224px] text-center text-[10px] text-[#97a09a]">Fuera de horario</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section id="features" className="mx-auto max-w-[1120px] scroll-mt-20 px-6 py-24">
        <div className="max-w-[640px]">
          <span className={EYEBROW}>Funciones</span>
          <h2 className={H2}>Del consultorio a la clínica. Herramientas serias.</h2>
        </div>
        <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-px overflow-hidden rounded-2xl border border-[#e6e4dc] bg-[#e6e4dc]">
          {FEATURES.map((f, i) => (
            <div key={f.t} className={`px-7 py-8 ${f.bg}`}>
              <div className={`text-[11px] font-semibold tracking-[.1em] uppercase ${f.num}`}>{String(i + 1).padStart(2, '0')}</div>
              <h3 className="mt-3.5 font-display text-[19px] font-semibold tracking-[-.01em]">{f.t}</h3>
              <p className="mt-2 text-[15px] leading-[1.55] text-[#65716c]">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Pricing ---------------- */}
      <section id="precios" className="scroll-mt-20 bg-[linear-gradient(160deg,#0d6e60_0%,#0d4a42_50%,#0c211d_100%)] text-[#f3f7f5]">
        <div className="mx-auto max-w-[1120px] px-6 py-24">
          <PricingTabs />
        </div>
      </section>

      {/* ---------------- Demo ---------------- */}
      {demoBase !== null && (
        <section id="demo" className="mx-auto max-w-[1120px] scroll-mt-20 px-6 pt-24 pb-20">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-start gap-12">
            <div>
              <span className={EYEBROW}>Demostración</span>
              <h2 className={H2}>Pruébelo con cualquier rol</h2>
              <p className="mt-4 text-[17px] text-pretty text-[#65716c]">
                Todas las cuentas usan la contraseña{' '}
                <code className="rounded-md border border-[#e6e4dc] bg-white px-[7px] py-0.5 font-mono text-sm">password123</code>. Cada
                consultorio ve únicamente sus propios datos.
              </p>
              <div className="relative mt-7 aspect-[16/10] overflow-hidden rounded-[18px] border border-[#e6e4dc]">
                <Image
                  src="/images/reception.jpg"
                  alt="Médica explicando resultados a un colega"
                  fill
                  sizes="(max-width: 768px) 100vw, 520px"
                  className="object-cover object-[70%_40%]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(12,33,29,.7),transparent_55%)]" />
                <div className="absolute right-5 bottom-[18px] left-5 text-sm leading-[1.4] text-[#f3f7f5]">
                  <span className="mb-2 inline-block rounded-full bg-[#3ad6bb] px-2.5 py-[3px] text-[11px] font-semibold text-[#0c211d]">
                    Datos de ejemplo
                  </span>
                  <br />
                  El consultorio de demostración trae pacientes, citas y facturas reales para que recorra el sistema completo.
                </div>
              </div>
            </div>
            <div className="grid gap-2.5">
              {DEMO_LOGINS.map((d) => (
                <a
                  key={d.email}
                  href={`${demoBase}/login?email=${encodeURIComponent(d.email)}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-[14px] border border-[#e6e4dc] bg-white px-[22px] py-[18px] text-[#182320] transition-colors hover:border-[#0d6e60] hover:text-[#182320]"
                >
                  <span>
                    <span className="block text-base font-semibold">
                      {d.label}
                      <span className="ml-1.5 text-[13px] font-normal text-[#97a09a]">{d.clinic}</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-[#65716c]">{d.blurb}</span>
                    <span className="mt-1 block text-xs text-[#97a09a]">{d.email}</span>
                  </span>
                  <span aria-hidden className="text-lg text-[#0d6e60]">
                    →
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- FAQ ---------------- */}
      <section id="faq" className="scroll-mt-20 border-t border-[#cfe3dd] bg-[#e2efec]">
        <div className="mx-auto grid max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-start gap-12 px-6 py-[88px]">
          <div>
            <span className={EYEBROW}>Preguntas frecuentes</span>
            <h2 className={H2}>Lo que suelen preguntarnos</h2>
            <p className="mt-4 text-[17px] text-[#65716c]">
              ¿Otra duda? Escríbanos por{' '}
              <a href={supportHref} className="font-semibold text-[#0d6e60] hover:text-[#0a584d]">
                {supportWa ? 'WhatsApp' : 'correo'}
              </a>
              .
            </p>
          </div>
          <FaqList items={FAQS} />
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="bg-[#0c211d] text-[#9fb5ae]">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6 py-10 text-[13px]">
          <span className="flex items-center gap-2.5 text-[#f3f7f5]">
            <Logo size={24} />
            <span className="font-display text-base font-bold">EMR</span>
            <span className="ml-1 text-[#65716c]">Historia Clínica Digital</span>
          </span>
          <span className="flex flex-wrap gap-5">
            <a href="#precios" className="text-[#9fb5ae] hover:text-[#f3f7f5]">Precios</a>
            {demoBase !== null && <a href="#demo" className="text-[#9fb5ae] hover:text-[#f3f7f5]">Demostración</a>}
            <Link href="/login" className="text-[#9fb5ae] hover:text-[#f3f7f5]">Iniciar sesión</Link>
          </span>
          <span className="text-[#65716c]">© 2026 Pixeles Creativos · Basado en Matab (MIT)</span>
        </div>
      </footer>
    </main>
  )
}
