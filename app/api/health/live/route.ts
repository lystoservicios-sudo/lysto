import { NextResponse } from 'next/server'
import { currentRelease } from '@/lib/observability/logger'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    {
      status: 'live',
      release: currentRelease()
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
