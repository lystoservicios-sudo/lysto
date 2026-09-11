import { NextResponse } from 'next/server'
// The old preview used a separate, obsolete tariff table.
export async function POST() {
  return NextResponse.json({ error: 'Este cálculo fue reemplazado. Usá la calculadora de presupuestos.', endpoint: '/api/pricing/quote' }, { status: 410 })
}
