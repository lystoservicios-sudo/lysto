import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type SetAllCookies } from '@supabase/ssr'
import { assertPublicSupabaseEnv } from '@/lib/supabase/env'
import { requiredRoleForPath } from '@/lib/auth/session-routing'
import { ApiError, apiErrorResponse, privateResponse } from '@/lib/http/api-error'

const sessionlessApis = new Set([
  '/api/mercadopago/webhook', '/api/payments/webhook/apply', '/api/service-request/preview',
  '/api/admin/assign-professional', '/api/jobs/advance', '/api/jobs/update-status'
])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === '/comprobante' || pathname.startsWith('/comprobante/')) {
    const response = privateResponse(NextResponse.next({ request }))
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return response
  }
  const privatePage = requiredRoleForPath(pathname) !== null || pathname === '/seguridad'
  const api = pathname.startsWith('/api/')
  if (!privatePage && !api) return NextResponse.next()
  let response = privateResponse(NextResponse.next({ request }))
  if (sessionlessApis.has(pathname)) return response
  try {
    const env = assertPublicSupabaseEnv()
    const pending = new Map<string, Parameters<SetAllCookies>[0][number]>()
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value)
            pending.set(cookie.name, cookie)
          }
          response = privateResponse(NextResponse.next({ request }))
          for (const { name, value, options } of pending.values()) response.cookies.set(name, value, options)
        }
      }
    })
    // Refresh cookies for both the downstream server render and the browser.
    // Layouts and each API still resolve current profile/permissions themselves.
    await supabase.auth.getUser()
    return response
  } catch { return apiErrorResponse(new ApiError('session_unavailable')) }
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
