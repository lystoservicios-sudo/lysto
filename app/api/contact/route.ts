import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { submitContactInquiry } from '@/lib/marketing/contact'

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ ok: false, message: 'Volvé a abrir el formulario desde Lysto.' }, { status: 403 })
  if (!request.headers.get('content-type')?.includes('application/json')) return NextResponse.json({ ok: false, message: 'El formato de la consulta no es válido.' }, { status: 415 })
  if (Number(request.headers.get('content-length') ?? 0) > 12000) return NextResponse.json({ ok: false, message: 'El mensaje es demasiado largo.' }, { status: 413 })
  let payload: unknown
  try {
    const body = await request.text()
    if (body.length > 12000) return NextResponse.json({ ok: false, message: 'El mensaje es demasiado largo.' }, { status: 413 })
    payload = JSON.parse(body)
  } catch { return NextResponse.json({ ok: false, message: 'Revisá el formulario e intentá nuevamente.' }, { status: 400 }) }
  const result = await submitContactInquiry(payload, async value => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('contact_unavailable')
    const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, error } = await client.rpc('submit_marketing_inquiry', { payload: value })
    if (error) throw new Error('contact_unavailable')
    return { ok: data === 'ok', reason: data === 'rate_limit' ? 'rate_limit' : undefined }
  })
  return NextResponse.json(result, { status: result.ok ? 200 : result.status, headers: { 'Cache-Control': 'no-store' } })
}
