import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Missing OAuth code' }, { status: 400 })
  // Contract only. Real token exchange must happen server-side after Mercado Pago app credentials are configured.
  return NextResponse.json({ connected: false, status: 'pending_real_mercadopago_oauth_credentials' })
}
