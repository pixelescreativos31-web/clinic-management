'use client'

// Homepage pricing (design handoff "Precios"): two audience tabs on a dark teal
// band; the featured plan is a dark card with an accent outline. Each card lists
// what it adds over the previous plan; data lives in src/lib/plans.ts.

import { useState } from 'react'
import Link from 'next/link'
import { PLAN_AUDIENCES, PLAN_FEATURES, PLAN_LIMITS, type Plan, type PlanAudience } from '@/lib/plans'

const CONTACT_HREF = 'mailto:gelinson@pixelescreativos.com.do?subject=EMR%20para%20instituciones'

/** Dark (featured) card per tab. */
const FEATURED: Record<PlanAudience, Plan> = { individual: 'pro', institutions: 'plus' }

function PlanCard({ plan: p, featured }: { plan: Plan; featured: boolean }) {
  const plan = PLAN_LIMITS[p]
  const { inherits, features } = PLAN_FEATURES[p]
  const quote = plan.priceUsd === null
  const dark = featured
  const ctaClass = `mt-7 block rounded-[10px] p-[13px] text-center text-[15px] font-semibold transition-[filter] hover:brightness-105 ${
    dark ? 'bg-[#3ad6bb] text-[#0c211d] hover:text-[#0c211d]' : 'bg-[#e2efec] text-[#0d6e60] hover:text-[#0d6e60]'
  }`
  return (
    <div
      className={`relative flex flex-col rounded-[18px] p-8 ${
        dark ? 'bg-[#0c211d] text-[#f3f7f5] shadow-[0_30px_60px_-30px_rgba(0,0,0,.6)] outline-2 outline-[#3ad6bb]' : 'bg-white text-[#182320]'
      }`}
    >
      {p === 'pro' && (
        <span className="absolute -top-3 left-8 rounded-full bg-[#3ad6bb] px-3 py-1 text-[11px] font-semibold tracking-[.04em] text-[#0c211d]">
          Más elegido
        </span>
      )}
      <div className="font-display text-xl font-semibold tracking-[-.01em]">{plan.label}</div>
      <div className={`mt-1 min-h-[42px] text-sm ${dark ? 'text-[#9fb5ae]' : 'text-[#65716c]'}`}>{plan.description}</div>
      <div className="mt-5 flex flex-wrap items-baseline gap-1.5">
        <span className="tabular font-display text-[44px] leading-none font-bold tracking-[-.03em]">
          {quote ? 'Cotizado' : `US$${plan.priceUsd}`}
        </span>
        {!quote && (
          <span className={`text-sm ${dark ? 'text-[#9fb5ae]' : 'text-[#65716c]'}`}>{plan.perDoctor ? 'por médico / mes' : '/mes'}</span>
        )}
      </div>
      {inherits && (
        <div className={`mt-[22px] text-[13px] font-semibold ${dark ? 'text-[#3ad6bb]' : 'text-[#0d6e60]'}`}>
          Todo lo de {PLAN_LIMITS[inherits].label}, más:
        </div>
      )}
      <ul className={`${inherits ? 'mt-3' : 'mt-6'} grid flex-1 content-start gap-2.5 text-sm`}>
        {features.map((f) => (
          <li key={f.text} className={`flex items-start gap-2.5 ${f.included ? '' : 'opacity-50'}`}>
            <span
              aria-hidden
              className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                dark ? 'bg-[rgba(58,214,187,.18)] text-[#3ad6bb]' : 'bg-[#e2efec] text-[#0d6e60]'
              }`}
            >
              {f.included ? '✓' : '✕'}
            </span>
            <span className={f.included ? '' : 'line-through'}>
              <span className="sr-only">{f.included ? 'Incluye: ' : 'No incluye: '}</span>
              {f.text}
            </span>
          </li>
        ))}
      </ul>
      {quote || p === 'plus' ? (
        <a href={CONTACT_HREF} className={ctaClass}>
          Contáctenos
        </a>
      ) : (
        <Link href="/signup" className={ctaClass}>
          {plan.priceUsd === 0 ? 'Crear cuenta gratis' : 'Empezar'}
        </Link>
      )}
    </div>
  )
}

export function PricingTabs() {
  const [audience, setAudience] = useState<PlanAudience>('individual')
  const current = PLAN_AUDIENCES.find((a) => a.key === audience)!

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-[560px]">
          <span className="text-xs font-semibold tracking-[.14em] text-[#3ad6bb] uppercase">Precios</span>
          <h2 className="mt-3 font-display text-[clamp(30px,3.6vw,42px)] leading-[1.08] font-bold tracking-[-.02em] text-balance">
            Un plan para cada etapa
          </h2>
          <p className="mt-4 text-[17px] text-pretty text-[#9fb5ae]">
            Empiece gratis y cambie de plan cuando su consultorio crezca. Sin costo por paciente ni por cita.
          </p>
        </div>
        <div role="tablist" aria-label="Tipo de cliente" className="inline-flex gap-1 rounded-full border border-white/12 bg-white/8 p-1">
          {PLAN_AUDIENCES.map((a) => {
            const active = a.key === audience
            return (
              <button
                key={a.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setAudience(a.key)}
                className={`rounded-full px-[18px] py-2.5 text-sm font-semibold transition-colors ${
                  active ? 'bg-[#3ad6bb] text-[#0c211d]' : 'text-[#cfe3dd] hover:text-white'
                }`}
              >
                {a.label}
              </button>
            )
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        className={`mt-12 grid items-stretch gap-5 ${
          current.plans.length === 3 ? 'grid-cols-[repeat(auto-fit,minmax(260px,1fr))]' : 'max-w-[760px] grid-cols-[repeat(auto-fit,minmax(280px,1fr))]'
        }`}
      >
        {current.plans.map((p) => (
          <PlanCard key={p} plan={p} featured={FEATURED[audience] === p} />
        ))}
      </div>
      {audience === 'institutions' && (
        <p className="mt-5 text-[13px] text-[#9fb5ae]">¹ Servicios de acompañamiento incluidos en el plan; se coordinan al contratar.</p>
      )}
      <p className="mt-6 text-[13px] text-[#9fb5ae]">Precios en dólares. Sin contrato: cancele cuando quiera y exporte sus datos.</p>
    </>
  )
}
