'use client'

// Pricing cards grouped by audience (two tabs). Each card lists what it adds over
// the previous plan; data lives in src/lib/plans.ts.

import { useState } from 'react'
import Link from 'next/link'
import { btnGhost, btnPrimary } from './primitives'
import { IconCheck, IconX } from './icons'
import { PLAN_AUDIENCES, PLAN_FEATURES, PLAN_LIMITS, type PlanAudience } from '@/lib/plans'

// The ghost button blends into white cards; outline it in brand colour here.
const outline = `${btnGhost} border-primary/40! text-primary hover:border-primary!`

const CONTACT_HREF = 'mailto:gelinson@pixelescreativos.com.do?subject=EMR%20para%20instituciones'

function Price({ priceUsd, perDoctor }: { priceUsd: number | null; perDoctor: boolean }) {
  if (priceUsd === null) {
    return <div className="font-display text-3xl font-semibold text-primary">A cotizar</div>
  }
  return (
    <div className="flex items-baseline gap-1">
      <span className="font-display text-4xl font-semibold text-primary">US${priceUsd}</span>
      <span className="text-sm text-muted-foreground">{perDoctor ? '/médico/mes' : '/mes'}</span>
    </div>
  )
}

export function PricingTabs() {
  const [audience, setAudience] = useState<PlanAudience>('individual')
  const current = PLAN_AUDIENCES.find((a) => a.key === audience)!

  return (
    <div className="mt-10">
      <div className="flex flex-col items-center gap-2">
        <div role="tablist" aria-label="Tipo de cliente" className="inline-flex rounded-lg border border-border bg-card p-0.5 text-sm">
          {PLAN_AUDIENCES.map((a) => {
            const active = a.key === audience
            return (
              <button
                key={a.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setAudience(a.key)}
                className={`rounded-md px-4 py-2 font-medium transition-colors ${
                  active ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-ink'
                }`}
              >
                {a.label}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">{current.hint}</p>
      </div>

      <div
        role="tabpanel"
        className={`mx-auto mt-6 grid gap-4 ${current.plans.length === 3 ? 'max-w-5xl md:grid-cols-3' : 'max-w-3xl sm:grid-cols-2'}`}
      >
        {current.plans.map((p) => {
          const plan = PLAN_LIMITS[p]
          const { inherits, features } = PLAN_FEATURES[p]
          const featured = p === 'pro'
          const quote = plan.priceUsd === null
          return (
            <div key={p} className={`card-flat relative flex flex-col p-6 ${featured ? 'border-primary ring-1 ring-primary/30' : ''}`}>
              {featured && (
                <span className="absolute -top-2.5 left-6 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  Más elegido
                </span>
              )}
              <h3 className="text-[15px] font-semibold">{plan.label}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
              <div className="mt-4">
                <Price priceUsd={plan.priceUsd} perDoctor={plan.perDoctor} />
              </div>
              {inherits && (
                <p className="mt-5 text-xs font-semibold text-ink">Todo lo de {PLAN_LIMITS[inherits].label}, más:</p>
              )}
              <ul className={`${inherits ? 'mt-2.5' : 'mt-5'} flex-1 space-y-2.5 text-sm`}>
                {features.map((f) => (
                  <li key={f.text} className={`flex items-start gap-2.5 ${f.included ? '' : 'text-faint'}`}>
                    {f.included ? (
                      <IconCheck size={14} strokeWidth={2.5} className="mt-0.5 shrink-0 text-primary" />
                    ) : (
                      <IconX size={14} strokeWidth={2.5} className="mt-0.5 shrink-0" />
                    )}
                    <span className={f.included ? '' : 'line-through'}>{f.text}</span>
                  </li>
                ))}
              </ul>
              {quote ? (
                <a href={CONTACT_HREF} className={`${outline} mt-6 w-full`}>
                  Contáctenos
                </a>
              ) : (
                <Link href="/signup" className={`${featured ? btnPrimary : outline} mt-6 w-full`}>
                  {plan.priceUsd === 0 ? 'Empezar gratis' : 'Crear cuenta'}
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
