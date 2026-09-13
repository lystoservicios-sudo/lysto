import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { safeCustomerNext } from '@/lib/auth/customer-access'
import { resolvedCustomerDestination } from '@/lib/auth/customer-session'

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const token_hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  let destination = '/login?notice=invalid-link'
  if (token_hash && (type === 'signup' || type === 'email' || type === 'recovery')) {
    try {
      const supabase = await createServerSupabaseClient()
      const { error } = await supabase.auth.verifyOtp({ token_hash, type })
      if (!error) destination = type === 'recovery' ? '/actualizar-contrasena' : await resolvedCustomerDestination(safeCustomerNext(url.searchParams.get('next')), supabase)
    } catch { destination = '/login?notice=unavailable' }
  }
  const response = NextResponse.redirect(new URL(destination, url.origin))
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
