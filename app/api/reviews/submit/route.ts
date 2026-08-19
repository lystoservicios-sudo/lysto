import { NextResponse } from 'next/server'
import { shouldOpenQualityCase, validateReview, type ReviewScore } from '@/lib/reviews/recalculate-rating'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as (ReviewScore & { jobId?: string; comment?: string }) | null
  if (!body?.jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
  try {
    validateReview(body)
  } catch {
    return NextResponse.json({ error: 'Invalid review score' }, { status: 400 })
  }
  const openQualityCase = shouldOpenQualityCase(body)
  // Contract: real implementation checks completed job ownership, prevents double review and updates professional score transactionally.
  return NextResponse.json({ accepted: true, openQualityCase, status: 'ready_for_transactional_persistence' })
}
