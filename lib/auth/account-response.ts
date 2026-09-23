import 'server-only'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { authOrigin, isAllowedAuthOrigin } from './account-lifecycle'

const confirmationCsrfCookie = 'lysto_confirm_csrf'

export function accountResponse(response: Response) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Referrer-Policy', 'same-origin')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  return response
}
export function accountRedirect(
  path:
    | '/login'
    | '/app'
    | '/pro/onboarding'
    | '/completar-cuenta'
    | '/login?reset=success'
    | '/login?logout=success'
) {
  return accountResponse(
    NextResponse.redirect(new URL(path, authOrigin(process.env.NEXT_PUBLIC_APP_URL)), 303)
  )
}
export function newConfirmationCsrfToken() {
  return randomBytes(32).toString('base64url')
}
export function checkAccountOrigin(request: Request, csrfToken?: string) {
  const origin = request.headers.get('origin')
  if (isAllowedAuthOrigin(origin, process.env.NEXT_PUBLIC_APP_URL)) return true
  if (origin !== null && origin !== 'null') return false
  if (!csrfToken || !validAccountToken(csrfToken)) return false
  const cookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === confirmationCsrfCookie)?.[1]
  if (!cookie || !validAccountToken(cookie)) return false
  const supplied = Buffer.from(csrfToken)
  const expected = Buffer.from(cookie)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
export function validAccountToken(token: string) {
  return /^[a-zA-Z0-9_-]{20,512}$/.test(token)
}
export function confirmationPage(
  token: string,
  message = 'Confirmá tu correo para activar tu cuenta.',
  status = 200,
  csrfToken = ''
) {
  const safeToken = validAccountToken(token) ? token : ''
  const safeCsrfToken = validAccountToken(csrfToken) ? csrfToken : ''
  // Token alphabet is validated before interpolation. No caller-supplied HTML or redirect is accepted.
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirmar correo — Lysto</title></head><body><main><h1>Confirmar correo</h1><p>${message}</p>${safeToken && safeCsrfToken ? `<form action="/auth/confirm" method="post"><input type="hidden" name="token_hash" value="${safeToken}"><input type="hidden" name="csrf_token" value="${safeCsrfToken}"><button type="submit">Confirmar correo</button></form>` : '<a href="/login">Volver al ingreso</a>'}</main></body></html>`
  const response = accountResponse(
    new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  )
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
  )
  if (safeToken && safeCsrfToken) {
    const secure = authOrigin(process.env.NEXT_PUBLIC_APP_URL).startsWith('https://') ? '; Secure' : ''
    response.headers.set(
      'Set-Cookie',
      `${confirmationCsrfCookie}=${safeCsrfToken}; Max-Age=600; Path=/auth/confirm; HttpOnly; SameSite=Strict${secure}`
    )
  }
  return response
}
