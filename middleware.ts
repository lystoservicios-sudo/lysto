import { NextResponse, type NextRequest } from 'next/server'

const protectedPrefixes = ['/app', '/pro', '/admin']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix))
  if (!isProtected) return NextResponse.next()
  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
