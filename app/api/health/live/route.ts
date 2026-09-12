import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    {
      status: 'live',
      release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.LYSTO_RELEASE ?? 'local'
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
