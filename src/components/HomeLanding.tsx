'use client'

// Public homepage — recreated from design_handoff_medira/medira Inicio.dc.html
// ("Clinical Calm"). Copy follows the current spec doc, not the older package:
// prices come from PLAN_LIMITS, no tax features, roles Titular / Asistente.

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export type HomePlan = {
  key: string
  name: string
  price: number // monthly USD, 0 = free
  perDoctor?: boolean
  items: string[]
  hot?: boolean
}

type Props = {
  plans: HomePlan[]
  hospitalItems: string[]
  supportEmail: string
  demoBase: string | null
}

const DEEP = 'bg-[#042f2e] text-white'
const H2 = 'm-0 text-[clamp(26px,3.2vw,38px)] leading-[1.1] font-medium tracking-[-.03em] text-balance'
const LEAD = 'mt-3.5 text-[17px] text-pretty text-[#57534e]'
const CARD = 'min-w-0 rounded-xl border border-[#e7e5e4] bg-white p-[22px] transition-colors hover:border-[#a8a29e]'
const BTN_LIGHT = 'rounded-[10px] bg-white px-[22px] py-[13px] font-medium text-[#042f2e] transition-colors hover:bg-[#e7e5e4] hover:text-[#042f2e]'
const BTN_GHOST = 'rounded-[10px] border border-[#2b6b65] px-[22px] py-[13px] font-medium text-white transition-colors hover:border-white hover:text-white'
const NAV = [
  ['#especialidades', 'Especialidades'],
  ['#dia', 'Producto'],
  ['#seguridad', 'Seguridad'],
  ['#planes', 'Precios'],
  ['#faq', 'Preguntas'],
] as const

/** Ticks every 2.2 s unless the user prefers reduced motion. */
function useTick() {
  const [tick, setTick] = useState(0)
  const [animate, setAnimate] = useState(true)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setAnimate(!reduce)
    if (reduce) return
    const t = setInterval(() => setTick((n) => n + 1), 2200)
    return () => clearInterval(t)
  }, [])
  return { tick, animate }
}

/** Types each line letter by letter; reserves the longest line's space so layout never jumps. */
function Typer({ lines, speed = 38, hold = 2200, animate }: { lines: string[]; speed?: number; hold?: number; animate: boolean }) {
  const [s, setS] = useState({ i: 0, n: 0 })
  const full = lines[s.i % lines.length]
  useEffect(() => {
    if (!animate) return
    const t = setTimeout(
      () => setS(s.n < full.length ? { i: s.i, n: s.n + 1 } : { i: s.i + 1, n: 0 }),
      s.n < full.length ? speed : hold,
    )
    return () => clearTimeout(t)
  }, [s, full, animate, speed, hold])
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), '')
  return (
    <span className="grid">
      <span aria-hidden className="invisible [grid-area:1/1]">
        {longest} |
      </span>
      <span className="[grid-area:1/1]">
        {animate ? full.slice(0, s.n) : full}
        {animate && <span className="ml-0.5 inline-block h-[1em] w-0.5 bg-[#0f766e] align-[-0.12em]" />}
      </span>
    </span>
  )
}

// Status chip colours (README "Insignia de estado"; spec 16.3: Confirmada light blue, green only for Atendida).
const STATUS: Record<string, string> = {
  Programada: 'border-[#d6d3d1] bg-white text-[#57534e]',
  Confirmada: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]',
  'En sala': 'border-[#1d4ed8] bg-[#1d4ed8] text-white',
  'En consulta': 'border-[#0f766e] bg-[#0f766e] text-white',
  Atendida: 'border-[#15803d] bg-[#f0fdf4] text-[#15803d]',
  'Pidió cambiar': 'border-[#b45309] bg-white text-[#b45309]',
}
function Chip({ s }: { s: string }) {
  return (
    <span className={`rounded-md border px-2 py-[3px] text-xs font-semibold whitespace-nowrap transition-colors duration-200 ${STATUS[s]}`}>
      {s}
    </span>
  )
}

const FICHAS = {
  General: {
    paciente: 'Ana Martínez', sub: '34 años · Exp. 0318', alerta: 'Alergia: penicilina', notaL: 'Nota de la consulta', doc: 'Firmar receta',
    campos: [['Presión arterial', '118/76', 'mmHg'], ['Frecuencia', '88', 'lpm'], ['Temperatura', '38.4', '°C'], ['SpO₂', '98', '%'], ['Peso', '62.0', 'kg'], ['IMC', '23.1', '']],
    lineas: ['Refiere fiebre y dolor de garganta desde hace tres días. Amígdalas hiperémicas, sin exudado.', 'Diagnóstico: faringoamigdalitis aguda. Control en 7 días.'],
  },
  Nutrición: {
    paciente: 'Luis García', sub: '41 años · Exp. 0291', alerta: 'Alergia: mariscos', notaL: 'Nota del control', doc: 'Plan de alimentación',
    campos: [['Peso actual', '86.4', 'kg'], ['Peso habitual', '92.0', 'kg'], ['Meta', '78.0', 'kg'], ['Talla', '1.74', 'm'], ['IMC', '28.5', ''], ['Cintura', '96', 'cm']],
    lineas: ['Control 4 del programa. Bajó 1.8 kg desde el último control y cumple el plan de alimentación.', 'Evaluación: sobrepeso en descenso. Próximo control en 15 días.'],
  },
  Estética: {
    paciente: 'Carla Díaz', sub: '29 años · Exp. 0340', alerta: 'Alergia: látex', notaL: 'Nota de sesión', doc: 'Indicaciones',
    campos: [['Zona', 'Abdomen', ''], ['Tratamiento', 'Reductivo', ''], ['Terapeuta', 'M. Peña', ''], ['Restantes', '6', 'sesiones'], ['Fotos', 'Frente, perfil', ''], ['Consentimiento', 'Firmado', '']],
    lineas: ['Sesión 4 de 10 en abdomen. Sin molestias tras la sesión anterior.', 'Indicaciones: hidratación y evitar sol directo durante 48 horas.'],
  },
} as const
type Esp = keyof typeof FICHAS

const AGENDA: [string, string, string, string[]][] = [
  ['8:30', 'José Rodríguez', 'Control · hipertensión', ['Atendida', 'Atendida', 'Atendida', 'Atendida']],
  ['9:00', 'Ana Martínez', 'Fiebre y dolor de garganta', ['En sala', 'En consulta', 'En consulta', 'Atendida']],
  ['9:30', 'Luis García', 'Control 4 · programa de peso', ['Confirmada', 'En sala', 'En sala', 'En consulta']],
  ['10:00', 'María Peña', 'Sin cita · T-03', ['Programada', 'Programada', 'En sala', 'En sala']],
  ['10:30', 'Carla Díaz', 'Sesión 4 de 10', ['Programada', 'Confirmada', 'Confirmada', 'Confirmada']],
]

const LOG = [
  ['09:00', 'Dra. Rosario', 'abrió el expediente 0318', 'Santo Domingo'],
  ['09:12', 'Dra. Rosario', 'firmó la receta 0142', 'Santo Domingo'],
  ['09:13', 'Dra. Rosario', 'envió la receta por enlace seguro', 'Santo Domingo'],
  ['09:15', 'M. Peña (asistente)', 'registró un cobro', 'Santo Domingo'],
  ['09:31', 'Dra. Rosario', 'abrió el expediente 0291', 'Santo Domingo'],
  ['14:20', 'J. Almonte (contador)', 'exportó el informe de caja', 'Santiago'],
]

const SEGURIDAD = [
  ['Cifrado', 'En tránsito y en reposo, también en los respaldos.'],
  ['Aislamiento', 'Ningún otro médico de la plataforma puede ver sus pacientes.'],
  ['Respaldo diario', 'Cifrado, en otra ubicación y guardado 30 días.'],
  ['Ley 172-13', 'La IA no guarda ni entrena con datos de pacientes.'],
]

const FAQS = [
  ['¿Necesito instalar algo?', 'No. medira funciona en el navegador de su computadora, tableta o celular. Crea su cuenta y empieza a usarlo el mismo día.'],
  ['¿Mis pacientes pueden verse desde otro consultorio?', 'Nunca. Cada consultorio tiene sus datos completamente separados; ni siquiera otro médico de la plataforma puede ver sus pacientes.'],
  ['¿Qué pasa si llego al límite de mi plan?', 'La atención nunca se bloquea. Solo se frena la acción que cuesta dinero, como un WhatsApp o un estudio con IA. Ver y editar expedientes funciona siempre.'],
  ['¿Qué pasa si no pago?', 'Recibe avisos durante 10 días con todo su plan activo. Si sigue sin pagar, la cuenta baja a Gratis. Sus datos nunca se borran.'],
  ['¿Puedo cancelar cuando quiera?', 'Sí. Si cancela durante la prueba no se cobra nada. Ver, imprimir y exportar sus expedientes sigue funcionando siempre.'],
]

const DEMO_LOGINS = [
  { label: 'Asistente', clinic: 'Consultorio Dra. Carmen Rosario', blurb: 'Agendar citas, registrar llegadas, atender sin cita', email: 'asistente@demo.app' },
  { label: 'Doctora (Titular)', clinic: 'Consultorio Dra. Carmen Rosario', blurb: 'Agenda, consultas, recetas, cobros y configuración', email: 'doctora@demo.app' },
  { label: 'Médico de clínica', clinic: 'Centro Médico Los Prados', blurb: 'Su agenda y sus pacientes dentro de una clínica', email: 'doctor1@clinica.app' },
]

function Segmented<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-0.5 rounded-[10px] bg-[#f0eeec] p-[3px]">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={`h-[34px] cursor-pointer rounded-lg px-3 text-sm font-medium transition-colors ${value === o ? 'bg-white text-[#1c1917]' : 'text-[#57534e]'}`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className={`sticky top-0 z-40 ${DEEP}`}>
      <div className="mx-auto flex h-[60px] max-w-[1160px] items-center gap-4 px-5">
        <a href="#top" className="flex-none text-[22px] font-semibold tracking-[-.04em] text-white hover:text-white">
          medira
        </a>
        <nav className="hidden h-10 min-w-0 flex-1 flex-wrap justify-center gap-x-1 overflow-hidden min-[760px]:flex">
          {NAV.map(([href, label]) => (
            <a key={href} href={href} className="px-3 py-[9px] text-[15px] leading-[22px] text-[#d5e5e2] hover:text-white">
              {label}
            </a>
          ))}
        </nav>
        <span className="flex-1 min-[760px]:hidden" />
        <Link href="/login" className="hidden flex-none px-3 py-[9px] text-[15px] text-white hover:text-white min-[760px]:block">
          Entrar
        </Link>
        <Link href="/signup?plan=free" className="flex-none rounded-[10px] bg-white px-4 py-[9px] text-[15px] font-medium text-[#042f2e] transition-colors hover:bg-[#e7e5e4] hover:text-[#042f2e]">
          Empezar gratis
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="h-11 flex-none cursor-pointer pr-1 pl-2 text-[15px] font-medium text-white min-[760px]:hidden"
        >
          {open ? 'Cerrar' : 'Menú'}
        </button>
      </div>
      {open && (
        <nav onClick={() => setOpen(false)} className="flex flex-col border-t border-[#134e4a] px-5 pt-1 pb-4 min-[760px]:hidden">
          {NAV.map(([href, label]) => (
            <a key={href} href={href} className="border-b border-[#134e4a] py-3.5 text-[17px] text-white hover:text-white">
              {label}
            </a>
          ))}
          <Link href="/login" className="py-3.5 text-[17px] text-white hover:text-white">
            Entrar
          </Link>
        </nav>
      )}
    </header>
  )
}

function ProductWindow({ tick, animate }: { tick: number; animate: boolean }) {
  const [esp, setEsp] = useState<Esp>('General')
  const [dens, setDens] = useState<'Cómoda' | 'Compacta'>('Cómoda')
  const f = FICHAS[esp]
  const comoda = dens === 'Cómoda'
  const pad = comoda ? 'py-3.5' : 'py-[9px]'
  const cell = comoda ? 'py-3' : 'py-[7px]'
  const row = comoda ? 'py-2.5' : 'py-1.5'
  const step = tick % 4
  const citas = AGENDA.map(([hora, nombre, nota, est]) => ({ hora, nombre, nota, estado: est[step] }))
  const atendidas = citas.filter((c) => c.estado === 'Atendida').length
  return (
    <div
      id="especialidades"
      className="relative mt-[clamp(36px,5vw,64px)] -mb-[120px] scroll-mt-[76px] overflow-hidden rounded-[14px] border border-[#d6d3d1] bg-[#fafaf7] text-left text-[#1c1917] shadow-[0_30px_60px_-30px_rgba(4,47,46,.55)]"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-[#e7e5e4] bg-white px-4 py-3">
        <div className="flex h-10 min-w-0 flex-[1_1_220px] items-center gap-2.5 rounded-[10px] border border-[#e7e5e4] bg-[#fafaf7] px-3 text-sm">
          <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap">
            <Typer lines={['Buscar paciente o acción', 'ana mar', 'nueva cita', 'cobrar consulta']} speed={70} hold={1800} animate={animate} />
          </span>
          <kbd className="flex-none rounded-md border border-[#d6d3d1] bg-white px-1.5 py-px font-mono text-xs text-[#57534e]">⌘K</kbd>
        </div>
        <Segmented options={Object.keys(FICHAS) as Esp[]} value={esp} onChange={setEsp} />
        <Segmented options={['Cómoda', 'Compacta'] as const} value={dens} onChange={setDens} />
      </div>
      <div className="flex flex-wrap gap-3 p-3">
        <div className="flex min-w-0 flex-[1.5_1_340px] flex-col gap-3">
          <div className="overflow-hidden rounded-xl border border-[#e7e5e4] bg-white">
            <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#f0eeec] px-[18px] ${pad}`}>
              <div>
                <div className="text-xs text-[#57534e]">En consulta</div>
                <div className="text-lg font-semibold tracking-[-.02em]">{f.paciente}</div>
                <div className="text-[13px] text-[#57534e]">{f.sub}</div>
              </div>
              <span className="rounded-md bg-[#b91c1c] px-2.5 py-1 text-xs font-semibold text-white">{f.alerta}</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(118px,1fr))] gap-px bg-[#f0eeec]">
              {f.campos.map(([l, v, u]) => (
                <div key={l} className={`bg-white px-[18px] ${cell}`}>
                  <div className="truncate text-xs text-[#57534e]">{l}</div>
                  <div className="mt-0.5 text-lg font-medium tracking-[-.02em] tabular-nums">
                    {v} <span className="text-xs font-normal tracking-normal text-[#57534e]">{u}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className={`border-t border-[#f0eeec] px-[18px] ${pad}`}>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[#57534e]">
                <span>{f.notaL}</span>
                <span className="rounded-md border border-[#b45309] px-2 py-px font-medium text-[#b45309]">Generado por IA · revisar</span>
              </div>
              <div className="mt-1.5 text-[15px] leading-[1.55]">
                <Typer key={esp} lines={[...f.lineas]} animate={animate} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-[#f0eeec] bg-[#fafaf7] px-[18px] py-3">
              <span className="rounded-[10px] bg-[#0f766e] px-4 py-[9px] text-sm font-medium text-white">Guardar consulta</span>
              <span className="rounded-[10px] border border-[#d6d3d1] bg-white px-4 py-[9px] text-sm font-medium">{f.doc}</span>
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
          <div className="overflow-hidden rounded-xl border border-[#e7e5e4] bg-white">
            <div className={`flex items-baseline justify-between gap-3 px-4 ${pad}`}>
              <span className="font-semibold">Agenda de hoy</span>
              <span className="text-[13px] text-[#57534e] tabular-nums">{atendidas} de 5 atendidas</span>
            </div>
            {citas.map((c) => (
              <div key={c.hora} className={`grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-[#f0eeec] px-4 text-sm ${row}`}>
                <span className="text-[#57534e] tabular-nums">{c.hora}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.nombre}</span>
                  {comoda && <span className="block truncate text-xs text-[#57534e]">{c.nota}</span>}
                </span>
                <Chip s={c.estado} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <div className={`flex-[1_1_130px] rounded-xl border border-[#e7e5e4] bg-white px-4 ${pad}`}>
              <div className="text-xs text-[#57534e]">Caja del día</div>
              <div className="mt-0.5 text-[22px] font-medium tracking-[-.03em] tabular-nums">RD${(14500 + step * 2500).toLocaleString('en-US')}</div>
            </div>
            <div className={`flex-[1_1_130px] rounded-xl border border-[#e7e5e4] bg-white px-4 ${pad}`}>
              <div className="text-xs text-[#57534e]">WhatsApp del mes</div>
              <div className="mt-0.5 text-[22px] font-medium tracking-[-.03em] tabular-nums">
                {312 + step * 3} <span className="text-[13px] font-normal tracking-normal text-[#57534e]">de 500</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Producto({ tick, animate }: { tick: number; animate: boolean }) {
  const [wa, setWa] = useState<'ok' | 'cambio' | null>(null)
  const step = tick % 4
  const waEstado = wa === 'ok' ? 'Confirmada' : wa === 'cambio' ? 'Pidió cambiar' : 'Programada'
  const btn = (on: boolean) =>
    on ? 'border-[#1c1917] bg-[#1c1917] text-white' : 'border-[#d6d3d1] bg-white text-[#1c1917]'
  const cuotas = [
    ['WhatsApp automático', 312 + step * 3, 500, false],
    ['Consultas dictadas con IA', 41 + step, 100, false],
    ['Estudios con IA', 51, 60, true],
  ] as const
  const cobro = [
    ['Consulta', 'RD$2,500', ''],
    ['Cubre la ARS', 'RD$1,800', ''],
    ['Paga el paciente', 'RD$700', ''],
    ['Diferencia de caja', 'RD$0', 'text-[#15803d]'],
  ]
  const Title = ({ t, d }: { t: string; d: string }) => (
    <div>
      <div className="text-[17px] font-semibold tracking-[-.01em]">{t}</div>
      <div className="mt-0.5 text-[15px] text-[#57534e]">{d}</div>
    </div>
  )
  return (
    <section id="dia" className="mx-auto max-w-[1160px] px-5 pt-[calc(120px+clamp(48px,6vw,80px))]">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-center gap-x-12 gap-y-6">
        <div className="max-w-[620px]">
          <h2 className={H2}>Cambie la especialidad. Cambia la consulta. No cambie de sistema.</h2>
          <p className={LEAD}>
            Listas hoy: General, Nutrición y Estética. Oftalmología, Odontología, Gineco-obstetricia y Pediatría llegan pronto y mientras tanto
            usan la ficha general.
          </p>
        </div>
        <Photo src="/images/hero-doctor2.jpg" alt="Médica atendiendo en su consultorio" className="aspect-[4/3] rounded-xl" sizes="(min-width: 760px) 540px, 100vw" />
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <div className={`${CARD} flex flex-[2_1_440px] flex-col gap-4`}>
          <Title t="La agenda se confirma sola" d="El paciente responde por WhatsApp y la cita se actualiza. Pruebe los botones." />
          <div className="flex flex-wrap items-end gap-4">
            <div className="max-w-[400px] flex-[1_1_280px]">
              <div className="rounded-[12px_12px_12px_2px] bg-[#f0eeec] px-3.5 py-3 text-sm leading-[1.45]">
                Hola Ana, le recordamos su cita mañana a las <strong>9:30 a. m.</strong> con la Dra. Rosario.
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setWa('ok')} className={`h-11 flex-auto cursor-pointer rounded-[10px] border px-3.5 text-sm font-medium whitespace-nowrap transition-colors ${btn(wa === 'ok')}`}>
                  Confirmar asistencia
                </button>
                <button type="button" onClick={() => setWa('cambio')} className={`h-11 flex-auto cursor-pointer rounded-[10px] border px-3.5 text-sm font-medium whitespace-nowrap transition-colors ${btn(wa === 'cambio')}`}>
                  Cambiar hora
                </button>
              </div>
            </div>
            <div className="flex-[1_1_260px] rounded-[10px] border border-[#e7e5e4] px-3.5 py-3 text-sm">
              <div className="text-xs text-[#57534e]">En la agenda</div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5">
                <span className="font-medium whitespace-nowrap">Ana Martínez · 9:30</span>
                <Chip s={waEstado} />
              </div>
            </div>
          </div>
        </div>
        <div className={`${CARD} flex flex-[1_1_300px] flex-col gap-4`}>
          <Title t="Todo a un atajo" d="Busque pacientes y acciones sin salir de la consulta." />
          <div className="overflow-hidden rounded-[10px] border border-[#e7e5e4] text-sm">
            <div className="flex items-center gap-2 border-b border-[#f0eeec] px-3.5 py-[11px]">
              <span className="min-w-0 flex-1">
                <Typer lines={['ana mar', 'nueva cita', 'cobrar']} speed={90} hold={1600} animate={animate} />
              </span>
              <kbd className="rounded-md border border-[#d6d3d1] px-1.5 py-px font-mono text-xs text-[#57534e]">⌘K</kbd>
            </div>
            <div className="flex justify-between gap-2 bg-[#f0eeec] px-3.5 py-[9px]">
              <span className="font-medium">Ana Martínez</span>
              <span className="text-[#57534e]">Exp. 0318</span>
            </div>
            {['Nueva cita', 'Cobrar consulta'].map((a) => (
              <div key={a} className="flex justify-between gap-2 px-3.5 py-[9px]">
                <span>{a}</span>
                <span className="text-[#57534e]">Acción</span>
              </div>
            ))}
          </div>
        </div>
        <div className={`${CARD} flex flex-[1_1_300px] flex-col gap-4`}>
          <Title t="La receta sale firmada" d="PDF con membrete, firma, sello, folio y código QR." />
          <div className="rounded-[10px] border border-[#e7e5e4] p-3.5 text-sm">
            <div className="flex justify-between gap-3 border-b border-[#1c1917] pb-2.5">
              <span className="font-semibold">Dra. Carmen Rosario</span>
              <span className="font-mono text-xs text-[#57534e]">N.º 0142</span>
            </div>
            <div className="border-b border-[#f0eeec] py-[9px]">
              <div className="font-medium">Azitromicina 500 mg, tableta</div>
              <div className="text-[13px] text-[#57534e]">1 cada 24 horas por 3 días · 3 (tres)</div>
            </div>
            <div className="py-[9px]">
              <div className="font-medium">Paracetamol 500 mg, tableta</div>
              <div className="text-[13px] text-[#57534e]">1 cada 8 horas si hay fiebre · 10 (diez)</div>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="rounded-md bg-[#15803d] px-2 py-[3px] text-xs font-semibold text-white">Firmada</span>
              <span className="text-[13px] text-[#57534e]">Enviada por enlace seguro</span>
            </div>
          </div>
        </div>
        <div className={`${CARD} flex flex-[1_1_300px] flex-col gap-4`}>
          <Title t="Claro con el dinero" d="Usted siempre ve cuánto ha usado de su plan." />
          <div className="flex flex-col gap-3.5 text-sm">
            {cuotas.map(([l, n, max, aviso]) => (
              <div key={l}>
                <div className="flex justify-between gap-3">
                  <span>{l}</span>
                  <span className={`font-medium tabular-nums ${aviso ? 'text-[#b45309]' : ''}`}>
                    {n} de {max}
                    {aviso ? ' · Aviso al 80%' : ''}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-[3px] bg-[#f0eeec]">
                  <div
                    className={`h-full rounded-[3px] transition-[width] duration-200 ${aviso ? 'bg-[#b45309]' : 'bg-[#0f766e]'}`}
                    style={{ width: `${Math.round((n / max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={`${CARD} flex flex-[2_1_440px] flex-col gap-4`}>
          <Title t="Se cobra desde la cita y la caja cierra cuadrada" d="Efectivo, tarjeta, transferencia o cobertura de ARS. Al cerrar, lo esperado contra lo contado." />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-px overflow-hidden rounded-[10px] border border-[#e7e5e4] bg-[#e7e5e4]">
            {cobro.map(([l, v, c]) => (
              <div key={l} className="bg-white px-3.5 py-3">
                <div className="text-xs text-[#57534e]">{l}</div>
                <div className={`mt-0.5 text-lg font-medium tracking-[-.02em] tabular-nums ${c}`}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Photo in a fixed-ratio frame (design «image-slot»): fills and crops, stone background while loading. */
function Photo({ src, alt, className, sizes, position }: { src: string; alt: string; className: string; sizes: string; position?: string }) {
  return (
    <div className={`relative overflow-hidden bg-[#e7e5e4] ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" style={position ? { objectPosition: position } : undefined} />
    </div>
  )
}

const ROLES = [
  { t: 'El médico', d: 'Atiende, dicta y firma sin buscar.', src: '/images/login-doctor.jpg', alt: 'Médico atendiendo a un paciente' },
  { t: 'La recepción', d: 'Agenda, registra llegadas y cobra.', src: null, alt: '' },
  { t: 'El paciente', d: 'Confirma su cita y recibe su receta por WhatsApp.', src: null, alt: '' },
] as const

const RECEPCION = [
  ['9:00', 'Ana Martínez', 'Atendida'],
  ['9:30', 'Luis Peña', 'En consulta'],
  ['10:00', 'Rosa Díaz', 'En sala'],
  ['10:30', 'Carlos Gil', 'Confirmada'],
] as const

function ParaTodos() {
  return (
    <section className="mx-auto max-w-[1160px] px-5 pt-[clamp(56px,7vw,96px)]">
      <h2 className={`${H2} max-w-[620px]`}>Para todo el consultorio</h2>
      <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
        {ROLES.map((r) => (
          <div key={r.t} className="min-w-0 overflow-hidden rounded-xl border border-[#e7e5e4] bg-white">
            {r.src ? (
              <Photo src={r.src} alt={r.alt} className="aspect-[4/5]" sizes="(min-width: 860px) 370px, 100vw" />
            ) : r.t === 'La recepción' ? (
              // No reception photo yet: the day's agenda the front desk works from.
              <div className="flex aspect-[4/5] flex-col justify-center gap-2 bg-[#f0eeec] p-5" aria-hidden="true">
                <div className="text-[13px] font-medium text-[#57534e]">Hoy · 4 citas</div>
                {RECEPCION.map(([h, n, st]) => (
                  <div key={h} className="flex items-center justify-between gap-2 rounded-[10px] bg-white px-3 py-2.5 text-sm">
                    <span className="tabular text-[#57534e]">{h}</span>
                    <span className="min-w-0 flex-1 truncate">{n}</span>
                    <Chip s={st} />
                  </div>
                ))}
              </div>
            ) : (
              // No patient photo yet: the WhatsApp exchange the patient actually sees.
              <div className="flex aspect-[4/5] flex-col justify-end gap-2 bg-[#f0eeec] p-5" aria-hidden="true">
                <div className="max-w-[85%] rounded-[12px_12px_12px_2px] bg-white px-3.5 py-3 text-sm leading-[1.45]">
                  Hola Ana, le recordamos su cita mañana a las <strong>9:30 a. m.</strong> con la Dra. Rosario.
                </div>
                <div className="max-w-[60%] self-end rounded-[12px_12px_2px_12px] bg-[#0f766e] px-3.5 py-2.5 text-sm text-white">Confirmar</div>
                <div className="max-w-[85%] rounded-[12px_12px_12px_2px] bg-white px-3.5 py-3 text-sm leading-[1.45]">
                  Listo, su cita quedó confirmada. Aquí tiene su receta en PDF.
                </div>
              </div>
            )}
            <div className="px-[18px] pt-4 pb-[18px]">
              <div className="text-[17px] font-semibold tracking-[-.01em]">{r.t}</div>
              <div className="mt-0.5 text-[15px] text-[#57534e]">{r.d}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Seguridad({ tick, animate }: { tick: number; animate: boolean }) {
  const code = '482913'
  const nDig = animate ? tick % 8 : 6
  const registro = [0, 1, 2, 3].map((i) => LOG[(tick + i) % LOG.length])
  return (
    <section id="seguridad" className="mx-auto max-w-[1160px] scroll-mt-[60px] px-5 pt-[clamp(56px,7vw,96px)]">
      <div className="max-w-[620px]">
        <h2 className={H2}>Seguro por defecto</h2>
        <p className={LEAD}>Son datos de salud. La verificación en dos pasos, la auditoría y el cifrado vienen activos sin configurar nada.</p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <div className={`flex min-w-0 flex-[1_1_300px] flex-col gap-5 rounded-xl p-[22px] ${DEEP}`}>
          <div>
            <div className="text-[17px] font-semibold tracking-[-.01em]">Verificación en dos pasos</div>
            <div className="mt-0.5 text-[15px] text-[#b6d4cf]">Con app autenticadora y 10 códigos de respaldo. Obligatoria para el Titular.</div>
          </div>
          <div className="flex gap-1.5">
            {code.split('').map((n, i) => (
              <div
                key={i}
                className={`flex h-[54px] max-w-12 flex-1 items-center justify-center rounded-[10px] border bg-[#0b3b39] font-mono text-[22px] transition-colors ${i === Math.min(nDig, 5) && nDig < 6 ? 'border-[#2dd4bf]' : 'border-[#1f5b57]'}`}
              >
                {i < nDig ? n : ''}
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-[2_1_440px] overflow-hidden rounded-xl border border-[#e7e5e4] bg-white">
          <div className="flex justify-between gap-3 px-[22px] py-4">
            <span className="text-[17px] font-semibold tracking-[-.01em]">Registro de actividad</span>
            <span className="text-[13px] text-[#57534e]">No se puede editar ni borrar</span>
          </div>
          {registro.map(([h, quien, que, donde]) => (
            <div key={h + que} className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 border-t border-[#f0eeec] px-[22px] py-[11px] text-sm">
              <span className="font-mono text-[13px] text-[#0f766e]">{h}</span>
              <span className="truncate">
                <span className="font-medium">{quien}</span> {que} <span className="text-[#57534e]">· {donde}</span>
              </span>
            </div>
          ))}
        </div>
        {SEGURIDAD.map(([t, d]) => (
          <div key={t} className="min-w-0 flex-[1_1_190px] rounded-xl border border-[#e7e5e4] bg-white px-5 py-[18px]">
            <div className="font-semibold">{t}</div>
            <div className="mt-0.5 text-[15px] text-[#57534e]">{d}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

const money = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

function Planes({ plans, hospitalItems, demoHref }: { plans: HomePlan[]; hospitalItems: string[]; demoHref: string }) {
  const [anual, setAnual] = useState(false)
  return (
    <section id="planes" className="mx-auto max-w-[1160px] scroll-mt-[60px] px-5 pt-[clamp(56px,7vw,96px)]">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className={H2}>Elija su plan</h2>
          <p className={`${LEAD} max-w-[480px]`}>Los planes de pago empiezan con 3 días gratis. El plan Gratis no pide tarjeta.</p>
        </div>
        <div className="relative grid grid-cols-2 rounded-[10px] bg-[#f0eeec] p-[3px]">
          <span
            aria-hidden
            className="absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-lg bg-[#1c1917] transition-transform duration-200"
            style={{ transform: `translateX(${anual ? '100%' : '0%'})` }}
          />
          <button type="button" onClick={() => setAnual(false)} aria-pressed={!anual} className={`relative h-10 cursor-pointer px-[18px] text-[15px] font-medium transition-colors ${anual ? 'text-[#57534e]' : 'text-white'}`}>
            Mensual
          </button>
          <button type="button" onClick={() => setAnual(true)} aria-pressed={anual} className={`relative inline-flex h-10 cursor-pointer items-center justify-center gap-2 px-[18px] text-[15px] font-medium transition-colors ${anual ? 'text-white' : 'text-[#57534e]'}`}>
            Anual <span className="rounded-md bg-[#0f766e] px-2 py-0.5 text-xs font-semibold text-white">2 meses gratis</span>
          </button>
        </div>
      </div>
      <div className="-mx-5 mt-7 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pt-1 pb-2 [scrollbar-width:none] min-[760px]:mx-0 min-[760px]:mt-8 min-[760px]:grid min-[760px]:grid-cols-2 min-[760px]:overflow-visible min-[760px]:p-0 min-[1120px]:grid-cols-4">
        {plans.map((p) => {
          const hot = !!p.hot
          const amount = p.price === 0 ? '0' : money(anual ? p.price * 10 : p.price)
          const unidad =
            p.price === 0
              ? 'Para siempre, sin tarjeta'
              : anual
                ? `${p.perDoctor ? 'por médico al año, mínimo 4' : 'al año'} · equivale a US$${((p.price * 10) / 12).toFixed(2)}/mes`
                : p.perDoctor
                  ? 'por médico al mes, mínimo 4'
                  : 'al mes'
          const cta = p.price === 0 ? 'Empezar gratis' : 'Probar 3 días gratis'
          const muted = hot ? 'text-[#b6d4cf]' : 'text-[#57534e]'
          const btn = hot
            ? 'border-white bg-white text-[#042f2e] hover:text-[#042f2e]'
            : p.price
              ? 'border-[#1c1917] bg-[#1c1917] text-white hover:text-white'
              : 'border-[#d6d3d1] bg-transparent text-[#1c1917] hover:text-[#1c1917]'
          return (
            <div
              key={p.key}
              className={`flex flex-[0_0_80%] snap-center flex-col rounded-xl border px-5 pt-[22px] pb-5 transition-transform duration-200 hover:-translate-y-[3px] ${hot ? 'border-[#042f2e] bg-[#042f2e] text-white' : 'border-[#e7e5e4] bg-white text-[#1c1917]'}`}
            >
              <div className="text-[15px] font-semibold whitespace-nowrap">{p.name}</div>
              <div className="mt-2.5 flex items-baseline gap-1">
                <span className={`text-[15px] font-medium ${muted}`}>US$</span>
                <span className="text-4xl leading-none font-medium tracking-[-.05em] tabular-nums">{amount}</span>
              </div>
              <div className={`mt-2 min-h-10 text-[13px] leading-normal text-balance ${muted}`}>{unidad}</div>
              <div className="mt-3.5 flex flex-1 flex-col text-sm">
                {p.items.map((it) => (
                  <div key={it} className={`border-t py-2.5 ${hot ? 'border-[#134e4a]' : 'border-[#f0eeec]'}`}>
                    {it}
                  </div>
                ))}
              </div>
              <Link
                href={`/signup?plan=${p.key}${anual && p.price ? '&ciclo=anual' : ''}`}
                className={`mt-[18px] flex h-11 items-center justify-center rounded-[10px] border text-[15px] font-medium ${btn}`}
              >
                {cta}
              </Link>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-[#e7e5e4] bg-white px-5 py-[18px]">
        <div className="flex-none">
          <div className="text-[15px] font-semibold">Hospital</div>
          <div className="text-[13px] text-[#57534e]">Cotizado · contrato institucional</div>
        </div>
        <div className="flex flex-[1_1_300px] flex-wrap gap-x-6 gap-y-1 text-sm">
          {hospitalItems.map((it) => (
            <span key={it} className="whitespace-nowrap">
              {it}
            </span>
          ))}
        </div>
        <a
          href={demoHref}
          className="flex h-11 flex-none items-center justify-center rounded-[10px] border border-[#d6d3d1] px-5 text-[15px] font-medium text-[#1c1917] hover:border-[#1c1917] hover:text-[#1c1917]"
        >
          Pedir demo
        </a>
      </div>
      <p className="mt-4 text-sm text-[#57534e]">Precios en dólares. Sin contrato: cancele cuando quiera y exporte sus datos.</p>
    </section>
  )
}

function Faq({ supportEmail }: { supportEmail: string }) {
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className="mx-auto grid max-w-[1160px] scroll-mt-[60px] grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-start gap-x-14 gap-y-6 px-5 py-[clamp(56px,7vw,96px)]">
      <div>
        <h2 className={H2}>Antes de empezar</h2>
        <p className={LEAD}>
          ¿Otra duda? Escríbanos a{' '}
          <a href={`mailto:${supportEmail}`} className="font-medium text-[#0f766e] hover:text-[#115e59]">
            {supportEmail}
          </a>
          .
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#e7e5e4] bg-white">
        {FAQS.map(([q, a], i) => {
          const abierta = open === i
          return (
            <div key={q} className={i ? 'border-t border-[#f0eeec]' : ''}>
              <button
                type="button"
                onClick={() => setOpen(abierta ? -1 : i)}
                aria-expanded={abierta}
                className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 px-5 py-3.5 text-left text-base font-medium text-[#1c1917] hover:bg-[#fafaf7]"
              >
                {q}
                <span className="flex-none text-[13px] font-medium text-[#0f766e]">{abierta ? 'Cerrar' : 'Ver'}</span>
              </button>
              {abierta && <p className="m-0 max-w-[560px] px-5 pb-[18px] text-[15px] leading-[1.6] text-[#57534e]">{a}</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Demo({ demoBase }: { demoBase: string }) {
  return (
    <section id="demo" className="mx-auto max-w-[1160px] scroll-mt-[60px] px-5 pt-[clamp(56px,7vw,96px)]">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-[620px]">
          <h2 className={H2}>Pruébelo con cualquier rol</h2>
          <p className={LEAD}>
            Datos de ejemplo. Todas las cuentas usan la contraseña{' '}
            <code className="rounded-md border border-[#d6d3d1] bg-white px-1.5 py-px font-mono text-sm">password123</code>.
          </p>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3">
        {DEMO_LOGINS.map((d) => (
          <a
            key={d.email}
            href={`${demoBase}/login?email=${encodeURIComponent(d.email)}`}
            className="rounded-xl border border-[#e7e5e4] bg-white px-5 py-[18px] text-[#1c1917] transition-colors hover:border-[#a8a29e] hover:text-[#1c1917]"
          >
            <span className="block font-semibold">{d.label}</span>
            <span className="block text-[13px] text-[#57534e]">{d.clinic}</span>
            <span className="mt-2 block text-[15px]">{d.blurb}</span>
            <span className="mt-2 block font-mono text-xs text-[#57534e]">{d.email}</span>
          </a>
        ))}
      </div>
    </section>
  )
}

export function HomeLanding({ plans, hospitalItems, supportEmail, demoBase }: Props) {
  const { tick, animate } = useTick()
  const demoHref = `mailto:${supportEmail}?subject=${encodeURIComponent('Demo de medira para hospital')}`
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fafaf7] text-base leading-normal text-[#1c1917]">
      <Header />
      <section id="top" className={DEEP}>
        <div className="mx-auto max-w-[1160px] px-5 pt-[clamp(36px,6vw,80px)] text-center">
          <h1 className="mx-auto max-w-[780px] font-sans text-[clamp(34px,5.6vw,64px)] leading-[1.04] font-medium tracking-[-.04em] text-balance">
            Gestión médica inteligente.
          </h1>
          <p className="mx-auto mt-5 max-w-[540px] text-lg leading-[1.55] text-pretty text-[#b6d4cf]">
            Historia clínica en la nube para médicos y clínicas. Se adapta a su especialidad, se aprende rápido y cobra por lo que se usa.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/signup?plan=pro" className={BTN_LIGHT}>
              Probar 3 días gratis
            </Link>
            <Link href="/signup?plan=free" className={BTN_GHOST}>
              Empezar gratis, sin tarjeta
            </Link>
          </div>
          <ProductWindow tick={tick} animate={animate} />
        </div>
      </section>
      <Producto tick={tick} animate={animate} />
      <ParaTodos />
      <Seguridad tick={tick} animate={animate} />
      <Planes plans={plans} hospitalItems={hospitalItems} demoHref={demoHref} />
      {demoBase !== null && <Demo demoBase={demoBase} />}
      <Faq supportEmail={supportEmail} />
      <section className="mx-auto max-w-[1160px] px-5 pb-[clamp(56px,7vw,96px)]">
        <div className={`flex flex-wrap overflow-hidden rounded-[14px] ${DEEP}`}>
          <div className="flex flex-[1.2_1_320px] flex-col justify-center p-[clamp(28px,5vw,56px)]">
            <h2 className={H2}>Atienda su primera consulta hoy</h2>
            <p className="mt-2.5 text-[17px] text-[#b6d4cf]">Del registro a la primera consulta en menos de 10 minutos.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className={BTN_LIGHT}>
                Crear cuenta
              </Link>
              <a href={demoHref} className={BTN_GHOST}>
                Hospitales: pedir demo
              </a>
            </div>
          </div>
          <Photo src="/images/reception.jpg" alt="Recepción de un consultorio" className="min-h-[280px] flex-[1_1_300px] bg-[#134e4a]" sizes="(min-width: 760px) 500px, 100vw" />
        </div>
      </section>
      <footer className="border-t border-[#e7e5e4]">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 pt-6 pb-7 text-sm">
          <span className="text-lg font-semibold tracking-[-.04em]">medira.do</span>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#planes" className="text-[#57534e] hover:text-[#1c1917]">Precios</a>
            <a href="#seguridad" className="text-[#57534e] hover:text-[#1c1917]">Seguridad</a>
            <Link href="/login" className="text-[#57534e] hover:text-[#1c1917]">Entrar</Link>
          </div>
          <span className="text-[#57534e]">© 2026 Pixeles Creativos · Basado en Matab (MIT)</span>
        </div>
      </footer>
    </div>
  )
}
