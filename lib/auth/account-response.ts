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

function escapedAccountText(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function accountPage(title: string, message: string, actions: string, status: number) {
  const safeTitle = escapedAccountText(title)
  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${safeTitle} — Lysto</title>
    <link rel="stylesheet" href="/auth-confirmation.css">
  </head>
  <body>
    <main class="confirmation-page" tabindex="-1" aria-labelledby="confirmation-title">
      <header class="confirmation-banner">
        <div class="confirmation-banner-inner">
          <div class="confirmation-identity">
            <a class="confirmation-brand" href="/" aria-label="Lysto, volver al inicio">lysto<span>.</span></a>
            <p>Tu hogar, conectado.</p>
          </div>
          <img src="/images/room-architecture.webp" alt="" width="240" height="236" decoding="async">
        </div>
      </header>
      <section class="confirmation-panel">
        <h1 id="confirmation-title">${safeTitle}</h1>
        <p class="confirmation-message${status >= 400 ? ' confirmation-message-error' : ''}"${status >= 400 ? ' role="alert"' : ''}>${escapedAccountText(message)}</p>
        <div class="confirmation-actions">${actions}</div>
        <p class="confirmation-trust">Tus datos, siempre protegidos.</p>
      </section>
    </main>
  </body>
</html>`
  const response = accountResponse(
    new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  )
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
  )
  return response
}

export function passwordRecoveryPage(message: string, status: number, primary: 'recovery' | 'login' = 'recovery') {
  return accountPage(
    'Cambiar contraseña',
    message,
    primary === 'login'
      ? '<a class="confirmation-button" href="/login">Iniciar sesión</a>'
      : '<a class="confirmation-button" href="/recuperar">Solicitar un nuevo enlace</a><a class="confirmation-link" href="/login">Volver al ingreso</a>',
    status
  )
}

export function confirmationPage(
  token: string,
  message = 'Confirmá tu correo para activar tu cuenta.',
  status = 200,
  csrfToken = ''
) {
  const safeToken = validAccountToken(token) ? token : ''
  const safeCsrfToken = validAccountToken(csrfToken) ? csrfToken : ''
  // Only validated token alphabets enter the static form. Messages are always escaped.
  const actions = safeToken && safeCsrfToken
    ? `<form action="/auth/confirm" method="post"><input type="hidden" name="token_hash" value="${safeToken}"><input type="hidden" name="csrf_token" value="${safeCsrfToken}"><button class="confirmation-button" type="submit">Confirmar correo</button></form><a class="confirmation-link" href="/login">Volver al ingreso</a>`
    : '<a class="confirmation-button" href="/login?confirmation=resend#reenviar-confirmacion">Solicitar un nuevo enlace</a><a class="confirmation-link" href="/login">Volver al ingreso</a>'
  const response = accountPage(
    'Confirmar correo',
    message,
    actions,
    status
  )
  if (safeToken && safeCsrfToken) {
    const secure = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://') ? '; Secure' : ''
    response.headers.set(
      'Set-Cookie',
      `${confirmationCsrfCookie}=${safeCsrfToken}; Max-Age=600; Path=/auth/confirm; HttpOnly; SameSite=Strict${secure}`
    )
  }
  return response
}
