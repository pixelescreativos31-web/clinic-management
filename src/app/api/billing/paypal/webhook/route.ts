// PayPal webhook (spec §3). PayPal signs every delivery; `handleWebhook` verifies
// it with PayPal before trusting it, stores it by event id (applied once) and
// answers 500 only when PayPal should retry.

import { getPayload } from 'payload'
import config from '@payload-config'
import { handleWebhook } from '@/lib/billing/service'

export async function POST(req: Request) {
  const raw = await req.text()
  const payload = await getPayload({ config: await config })
  const result = await handleWebhook(payload, req.headers, raw)
  return Response.json({ outcome: result.outcome }, { status: result.status })
}
