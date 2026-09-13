import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { safeCustomerNext } from '@/lib/auth/customer-access'
import { resolvedCustomerDestination } from '@/lib/auth/customer-session'

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get('code')
  let destination = '/login?notice=invalid-link'
  if (url.searchParams.has('error')) destination = '/login?notice=oauth-error'
  else if (code) {
    try {
      const supabase = await createServerSupabaseClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) destination = url.searchParams.get('flow') === 'recovery'
        ? '/restablecer'
        : await resolvedCustomerDestination(safeCustomerNext(url.searchParams.get('next')), supabase)
    } catch { destination = '/login?notice=unavailable' }
  }
  const response = NextResponse.redirect(new URL(destination, url.origin))
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
