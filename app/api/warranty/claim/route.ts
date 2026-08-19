import { NextResponse } from 'next/server'
import { evaluateWarrantyClaim, type WarrantyClaimInput } from '@/lib/warranty/claims'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as WarrantyClaimInput | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  try {
    const decision = evaluateWarrantyClaim(body)
    return NextResponse.json({ decision, persistence: decision.acceptedForReview ? 'Insert warranty_claims as open and notify admin.' : 'Record rejected claim with reason.' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid warranty claim' }, { status: 400 })
  }
}
