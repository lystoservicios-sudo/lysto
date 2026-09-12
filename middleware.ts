import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type SetAllCookies } from '@supabase/ssr'
import { assertPublicSupabaseEnv } from '@/lib/supabase/env'
import { requiredRoleForPath } from '@/lib/auth/session-routing'
import { ApiError, apiErrorResponse, privateResponse } from '@/lib/http/api-error'

const sessionlessApis = new Set([
  '/api/mercadopago/webhook',
  '/api/payments/webhook/apply',
  '/api/service-request/preview',
  '/api/admin/assign-professional',
  '/api/jobs/advance',
  '/api/jobs/update-status',
  '/api/admin/approve-professional',
  '/api/admin/pricing/update',
  '/api/pro/jobs/action',
  '/api/pro/onboarding/evaluate',
  '/api/professional/respond-request'
])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const correlationId =
    request.headers.get('x-correlation-id')?.match(/^[A-Za-z0-9_-]{8,80}$/)?.[0] ??
    crypto.randomUUID()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-correlation-id', correlationId)
  const nextResponse = () => NextResponse.next({ request: { headers: requestHeaders } })
  const withCorrelation = <T extends Response>(response: T): T => {
    response.headers.set('X-Correlation-Id', correlationId)
    return response
  }
  const onboarding = pathname === '/pro/onboarding' || pathname.startsWith('/pro/onboarding/')
  function onboardingHeaders<T extends Response>(response: T): T {
    if (onboarding) {
      response.headers.set('Referrer-Policy', 'no-referrer')
      response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    }
    return response
  }
  if (pathname === '/comprobante' || pathname.startsWith('/comprobante/')) {
    const response = withCorrelation(privateResponse(nextResponse()))
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
  }
  const privatePage = requiredRoleForPath(pathname) !== null || pathname === '/seguridad'
  const api = pathname.startsWith('/api/')
  if (!privatePage && !api) return withCorrelation(nextResponse())
  let response = withCorrelation(onboardingHeaders(privateResponse(nextResponse())))
  if (sessionlessApis.has(pathname)) return response
  try {
    const env = assertPublicSupabaseEnv()
    const pending = new Map<string, Parameters<SetAllCookies>[0][number]>()
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value)
            pending.set(cookie.name, cookie)
          }
          response = withCorrelation(onboardingHeaders(privateResponse(nextResponse())))
          for (const { name, value, options } of pending.values())
            response.cookies.set(name, value, options)
        }
      }
    })
    // Refresh cookies for both the downstream server render and the browser.
    // Layouts and each API still resolve current profile/permissions themselves.
    await supabase.auth.getUser()
    return response
  } catch {
    return withCorrelation(onboardingHeaders(apiErrorResponse(new ApiError('session_unavailable'))))
  }
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
