import { NextResponse } from 'next/server'
import { validatePricingRuleUpdate, type PricingRuleUpdateInput } from '@/lib/admin/pricing-admin'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as PricingRuleUpdateInput | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  const result = validatePricingRuleUpdate(body)
  if (!result.ok) return NextResponse.json({ error: 'Invalid pricing rule', details: result.errors }, { status: 400 })
  return NextResponse.json({ result, persistence: 'Upsert pricing_rules and write admin_audit_logs. Existing requests keep stored price_options.' })
}
