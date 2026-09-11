import 'server-only'
import { NextResponse } from 'next/server'
import { authOrigin, isAllowedAuthOrigin } from './account-lifecycle'

export function accountResponse(response: Response) {
  response.headers.set('Cache-Control','private, no-store, max-age=0')
  response.headers.set('Referrer-Policy','no-referrer')
  response.headers.set('X-Robots-Tag','noindex, nofollow')
  response.headers.set('X-Content-Type-Options','nosniff')
  return response
}
export function accountRedirect(path: '/login' | '/app' | '/completar-cuenta' | '/login?reset=success' | '/login?logout=success') {
  return accountResponse(NextResponse.redirect(new URL(path,authOrigin(process.env.NEXT_PUBLIC_APP_URL)),303))
}
export function checkAccountOrigin(request: Request) { return isAllowedAuthOrigin(request.headers.get('origin'), process.env.NEXT_PUBLIC_APP_URL) }
export function validAccountToken(token: string) { return /^[a-zA-Z0-9_-]{20,512}$/.test(token) }
export function confirmationPage(token: string, message = 'Confirmá tu correo para activar tu cuenta.', status = 200) {
  const safeToken = validAccountToken(token) ? token : ''
  // Token alphabet is validated before interpolation. No caller-supplied HTML or redirect is accepted.
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirmar correo — Lysto</title></head><body><main><h1>Confirmar correo</h1><p>${message}</p>${safeToken ? `<form action="/auth/confirm" method="post"><input type="hidden" name="token_hash" value="${safeToken}"><button type="submit">Confirmar correo</button></form>` : '<a href="/login">Volver al ingreso</a>'}</main></body></html>`
  const response = accountResponse(new Response(html,{ status, headers:{'Content-Type':'text/html; charset=utf-8'} }))
  response.headers.set('Content-Security-Policy',"default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
  return response
}
