import { NextResponse } from 'next/server'

// Removed: this endpoint only simulated mutations from caller supplied state.
export async function POST(_request: Request) {
  void _request
  return NextResponse.json({ error: 'endpoint_retired', replacement: '/api/mercadopago/webhook' }, { status: 410 })
}
