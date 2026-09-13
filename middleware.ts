import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type SetAllCookies } from '@supabase/ssr'
import { assertPublicSupabaseEnv } from '@/lib/supabase/env'
import { safeCustomerNext } from '@/lib/auth/customer-access'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-lysto-path', pathname)
  let response = NextResponse.next({ request: { headers: requestHeaders } })
  const customerRoute = pathname === '/app' || pathname.startsWith('/app/')
  try {
    const env = assertPublicSupabaseEnv()
    const supabase = createServerClient(env.url, env.anonKey, { cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies: Parameters<SetAllCookies>[0]) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value))
        requestHeaders.set('cookie', request.cookies.toString())
        response = NextResponse.next({ request: { headers: requestHeaders } })
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      }
    } })
    const { data: { user } } = await supabase.auth.getUser()
    if (customerRoute && !user) {
      const target = new URL('/login', request.url)
      target.searchParams.set('next', safeCustomerNext(pathname))
      const redirectResponse = NextResponse.redirect(target)
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
      redirectResponse.headers.set('Cache-Control', 'private, no-store')
      return redirectResponse
    }
  } catch {
    if (customerRoute) return NextResponse.redirect(new URL('/login?notice=unavailable', request.url))
  }
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export const config = { matcher: ['/app/:path*', '/pro/:path*', '/admin/:path*', '/login', '/registro', '/completar-perfil', '/actualizar-contrasena', '/equipo/login', '/auth/:path*'] }
