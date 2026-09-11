import { NextResponse } from 'next/server'

export async function POST(_request: Request) {
  void _request
  return NextResponse.json({ error: 'endpoint_retired', replacement: '/api/pricing/offers' }, { status: 410 })
}
