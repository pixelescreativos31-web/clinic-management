import { describe, it, expect } from 'vitest'
import {
  PLANS,
  PLAN_QUOTAS,
  METERED_RESOURCES,
  asPlan,
  isPlan,
  limitFor,
  monthKey,
  quotaAllows,
  quotaExceededMessage,
  quotaFor,
  quotaLine,
  quotaStatus,
  usage,
  usagePeriod,
  formatBytes,
  periodLabel,
} from '@/lib/plans'

// Pure quota math for roadmap B1 (no DB). Flows and counter-flows: thresholds,
// unlimited/not-included plans, period keys across the month boundary in the
// clinic's timezone, downgrades, and untrusted plan values.

describe('quotaStatus — thresholds', () => {
  // pro: 60 AI studies / month
  it.each([
    [0, { ratio: 0, near: false, atLimit: false, over: 0 }],
    [47, { near: false, atLimit: false }], // 78.3%
    [48, { ratio: 0.8, near: true, atLimit: false }], // exactly 80%
    [59, { near: true, atLimit: false }],
    [60, { ratio: 1, near: true, atLimit: true, over: 0 }], // exactly 100%
    [75, { ratio: 1, near: true, atLimit: true, over: 15 }], // over
  ])('pro aiStudies used=%i', (used, expected) => {
    expect(quotaStatus('pro', 'aiStudies', used)).toMatchObject({ used, limit: 60, included: true, ...expected })
  })

  it('79% is not near, 80% is (free: 15 optical orders → 12 is 80%)', () => {
    expect(quotaStatus('free', 'opticalOrders', 11).near).toBe(false) // 73%
    expect(quotaStatus('free', 'opticalOrders', 12).near).toBe(true)
    expect(quotaStatus('clinic', 'aiStudies', 119).near).toBe(false) // 79.3% of 150
    expect(quotaStatus('clinic', 'aiStudies', 120).near).toBe(true) // 80% of 150
  })

  it('80% boundary on every plan quota', () => {
    for (const p of PLANS) {
      for (const r of METERED_RESOURCES) {
        const limit = PLAN_QUOTAS[p][r]
        if (!limit) continue
        const at80 = Math.ceil((limit * 4) / 5)
        expect(quotaStatus(p, r, at80).near).toBe(true)
        expect(quotaStatus(p, r, at80 - 1).near).toBe(false)
        expect(quotaStatus(p, r, limit - 1).atLimit).toBe(false)
        expect(quotaStatus(p, r, limit).atLimit).toBe(true)
      }
    }
    expect(quotaStatus('plus', 'whatsappMessages', 1599).near).toBe(false)
    expect(quotaStatus('plus', 'whatsappMessages', 1600).near).toBe(true)
  })

  it('negative / NaN usage reads as 0 (drifted storage total)', () => {
    expect(quotaStatus('pro', 'storageBytes', -500)).toMatchObject({ used: 0, ratio: 0, atLimit: false })
    expect(quotaStatus('pro', 'aiStudies', Number.NaN)).toMatchObject({ used: 0, atLimit: false })
  })
})

describe('quotaStatus — unlimited and not-included', () => {
  it('null limit = unlimited: never near, never at limit, always allowed', () => {
    const s = quotaStatus('pro', 'opticalOrders', 1_000_000)
    expect(s).toMatchObject({ limit: null, ratio: 0, near: false, atLimit: false, over: 0, included: true })
    expect(quotaAllows(s, 1000)).toBe(true)
  })

  it('public plan is unlimited for every metered resource', () => {
    for (const r of METERED_RESOURCES) expect(quotaFor('public', r)).toBeNull()
  })

  it('a 0 quota means "not included": refused from the first unit, with its own message', () => {
    const s = quotaStatus('free', 'whatsappMessages', 0)
    expect(s).toMatchObject({ limit: 0, included: false, atLimit: true })
    expect(quotaAllows(s)).toBe(false)
    expect(quotaExceededMessage('free', 'whatsappMessages', s)).toBe(
      'Su plan Gratis no incluye mensajes de WhatsApp. Solicite una mejora de plan para usarlo.',
    )
  })
})

describe('quotaAllows — the action gate', () => {
  it('allows up to the limit, refuses the unit that would exceed it', () => {
    expect(quotaAllows(quotaStatus('pro', 'aiStudies', 59), 1)).toBe(true) // 59 → 60
    expect(quotaAllows(quotaStatus('pro', 'aiStudies', 60), 1)).toBe(false)
    expect(quotaAllows(quotaStatus('pro', 'aiStudies', 58), 3)).toBe(false) // batch 58 → 61
  })

  it('downgrade leaves the clinic over quota: shown as over, refused, nothing negative', () => {
    // Used 1,500 WhatsApp on `plus`, downgraded to `pro` (500).
    const s = quotaStatus('pro', 'whatsappMessages', 1500)
    expect(s).toMatchObject({ limit: 500, ratio: 1, atLimit: true, over: 1000 })
    expect(quotaAllows(s)).toBe(false)
    const msg = quotaExceededMessage('pro', 'whatsappMessages', s)
    expect(msg).toBe(
      'Se agotó su cuota de mensajes de WhatsApp de este mes. Sus expedientes siguen disponibles; compre un paquete o mejore su plan para continuar.',
    )
  })

  it('storage message speaks GB and is not monthly', () => {
    const s = quotaStatus('free', 'storageBytes', 3 * 1024 ** 3)
    const msg = quotaExceededMessage('free', 'storageBytes', s)
    expect(msg).toBe('No se pueden subir más archivos. Nada se borra.')
    expect(msg).not.toContain('este mes')
  })
})

describe('plan values from the DB are untrusted', () => {
  it('unknown plan falls back to free (quota and caps)', () => {
    expect(asPlan('enterprise')).toBe('free')
    expect(asPlan(undefined)).toBe('free')
    expect(asPlan(42)).toBe('free')
    expect(quotaStatus(asPlan('gold'), 'aiStudies', 0).limit).toBe(10)
  })

  it('prototype keys are not plans (pre-existing bug: `"toString" in PLAN_LIMITS` was true)', () => {
    for (const k of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf']) {
      expect(isPlan(k)).toBe(false)
      expect(asPlan(k)).toBe('free')
      // Before the fix limitFor returned a function here, which the enforcement
      // hook read as "no cap" (totalDocs >= fn is always false).
      expect(limitFor(asPlan(k), 'patients')).toBe(50)
    }
  })

  it('quotaFor also guards a plan typed as Plan but corrupted at runtime', () => {
    expect(quotaFor('nope' as never, 'aiStudies')).toBe(10)
  })

  it('every plan has every metered quota defined (null or a non-negative integer)', () => {
    for (const p of PLANS) {
      for (const r of METERED_RESOURCES) {
        const q = PLAN_QUOTAS[p][r]
        expect(q === null || (Number.isInteger(q) && q >= 0)).toBe(true)
      }
    }
  })

  it('quotas never shrink as plans go up (free → pro → clinic → plus → public)', () => {
    const order = ['free', 'pro', 'clinic', 'plus', 'public'] as const
    for (const r of METERED_RESOURCES) {
      for (let i = 1; i < order.length; i++) {
        const lo = PLAN_QUOTAS[order[i - 1]!][r]
        const hi = PLAN_QUOTAS[order[i]!][r]
        if (lo === null) expect(hi).toBeNull()
        else if (hi !== null) expect(hi).toBeGreaterThanOrEqual(lo)
      }
    }
  })
})

describe('existing caps are unchanged (doctors/patients)', () => {
  it('free: 1 doctor, 50 patients; pro unlimited patients', () => {
    expect(limitFor('free', 'doctors')).toBe(1)
    expect(limitFor('free', 'patients')).toBe(50)
    expect(limitFor('pro', 'patients')).toBeNull()
    expect(usage('free', 'patients', 40)).toMatchObject({ near: true, atLimit: false })
    expect(usage('free', 'patients', 50)).toMatchObject({ atLimit: true })
  })
})

describe('usage period — month in the clinic timezone', () => {
  const DR = 'America/Santo_Domingo' // UTC−4, no DST

  it('23:30 on the last day of the month (local) still counts for that month', () => {
    // 2026-11-30 23:30 AST = 2026-12-01 03:30 UTC
    const d = new Date('2026-12-01T03:30:00Z')
    expect(monthKey(d, 'UTC')).toBe('2026-12') // the naive UTC key would be wrong
    expect(usagePeriod('aiStudies', d, DR)).toBe('2026-11')
  })

  it('00:00 local on the 1st rolls to the new month', () => {
    expect(usagePeriod('whatsappMessages', new Date('2026-12-01T04:00:00Z'), DR)).toBe('2026-12')
    expect(usagePeriod('whatsappMessages', new Date('2026-12-01T03:59:59Z'), DR)).toBe('2026-11')
  })

  it('year rollover: Dec 31 23:30 local is still December of the old year', () => {
    expect(usagePeriod('opticalOrders', new Date('2027-01-01T03:30:00Z'), DR)).toBe('2026-12')
    expect(usagePeriod('opticalOrders', new Date('2027-01-01T04:00:00Z'), DR)).toBe('2027-01')
  })

  it('Feb 28 23:30 in a non-leap year, and Feb 29 in a leap year', () => {
    expect(usagePeriod('aiStudies', new Date('2027-03-01T03:30:00Z'), DR)).toBe('2027-02')
    expect(usagePeriod('aiStudies', new Date('2028-03-01T03:30:00Z'), DR)).toBe('2028-02')
  })

  it('a DST timezone (New York) on the month boundary', () => {
    // 2026-10-31 23:30 EDT (UTC−4) = 2026-11-01 03:30 UTC
    expect(usagePeriod('aiStudies', new Date('2026-11-01T03:30:00Z'), 'America/New_York')).toBe('2026-10')
  })

  it('storage is a running total: same key forever', () => {
    expect(usagePeriod('storageBytes', new Date('2026-01-01T00:00:00Z'), DR)).toBe('total')
    expect(usagePeriod('storageBytes', new Date('2030-07-15T00:00:00Z'), DR)).toBe('total')
  })

  it('period label in Spanish', () => {
    expect(periodLabel('2026-11')).toBe('noviembre de 2026')
    expect(periodLabel('total')).toBe('total')
  })
})

describe('display helpers', () => {
  it('formatBytes', () => {
    expect(formatBytes(2 * 1024 ** 3)).toBe('2 GB')
    expect(formatBytes(1.5 * 1024 ** 3)).toBe('1.5 GB')
    expect(formatBytes(350 * 1024 ** 2)).toBe('350 MB')
    expect(formatBytes(-1)).toBe('0 MB')
  })

  it('quotaLine for plan cards', () => {
    expect(quotaLine('free', 'whatsappMessages')).toBe('Sin mensajes de WhatsApp')
    expect(quotaLine('pro', 'aiStudies')).toBe('60 estudios con IA al mes')
    expect(quotaLine('clinic', 'whatsappMessages')).toBe('1,000 mensajes de WhatsApp al mes')
    expect(quotaLine('pro', 'opticalOrders')).toBe('Órdenes de óptica ilimitadas')
    expect(quotaLine('plus', 'storageBytes')).toBe('200 GB de almacenamiento')
    expect(quotaLine('public', 'storageBytes')).toBe('Almacenamiento ilimitado')
  })
})
