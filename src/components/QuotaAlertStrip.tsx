import Link from 'next/link'
import type { QuotaAlert } from '@/lib/usage'

/**
 * Owner-only notice at 80 % / 100 % of a monthly quota (spec §2 «aviso amarillo en
 * el panel»). Amber, never red: a quota is not a clinical alert.
 */
export function QuotaAlertStrip({ alert }: { alert: QuotaAlert }) {
  return (
    <div
      className="border-b border-[#f3e3c3] bg-[#faf3e6] px-4 py-2 text-[13px] text-[#78350f] md:px-5"
      data-quota-alert={alert.level}
    >
      {alert.message}{' '}
      <Link href="/dashboard/plan#uso" className="font-semibold text-[#78350f] underline underline-offset-2">
        Ver uso
      </Link>
    </div>
  )
}
