import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { confirmationPage } from '@/lib/auth/account-response'

const token = 'a'.repeat(64)
const csrfToken = 'b'.repeat(43)

async function confirmationDocument(response: Response) {
  return new DOMParser().parseFromString(await response.text(), 'text/html')
}

afterEach(() => vi.unstubAllEnvs())

describe('customer email confirmation presentation', () => {
  it('uses the approved customer identity and local room asset in a focused main', async () => {
    const page = await confirmationDocument(confirmationPage(token, undefined, 200, csrfToken))

    expect(page.documentElement.lang).toBe('es')
    expect(page.querySelector('link[rel="stylesheet"]')?.getAttribute('href')).toBe('/auth-confirmation.css')
    expect(page.querySelector('.confirmation-brand')?.textContent).toBe('lysto.')
    expect(page.querySelector('.confirmation-brand')?.getAttribute('href')).toBe('/')
    expect(page.querySelector('.confirmation-brand')?.getAttribute('aria-label')).toBe('Lysto, volver al inicio')
    expect(page.querySelector('.confirmation-identity p')?.textContent).toBe('Tu hogar, conectado.')
    expect(page.querySelector('img')?.getAttribute('src')).toBe('/images/room-architecture.webp')
    expect(page.querySelector('img')?.getAttribute('alt')).toBe('')
    expect(page.querySelector('main')?.getAttribute('tabindex')).toBe('-1')
    expect(page.querySelector('main')?.getAttribute('aria-labelledby')).toBe('confirmation-title')
    expect(page.querySelector('h1')?.textContent).toBe('Confirmar correo')
    expect(page.querySelector('nav')).toBeNull()
    expect(page.querySelector('script, style, [style]')).toBeNull()
  })

  it('keeps the explicit protected POST form and private response protections', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lysto.test')
    const response = confirmationPage(token, undefined, 200, csrfToken)
    const page = await confirmationDocument(response)
    const form = page.querySelector('form')

    expect(response.status).toBe(200)
    expect(form?.getAttribute('action')).toBe('/auth/confirm')
    expect(form?.getAttribute('method')).toBe('post')
    expect(form?.querySelector<HTMLInputElement>('[name="token_hash"]')?.value).toBe(token)
    expect(form?.querySelector<HTMLInputElement>('[name="csrf_token"]')?.value).toBe(csrfToken)
    expect(form?.querySelector('button')?.textContent?.trim()).toBe('Confirmar correo')
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(response.headers.get('referrer-policy')).toBe('same-origin')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('set-cookie')).toBe(`lysto_confirm_csrf=${csrfToken}; Max-Age=600; Path=/auth/confirm; HttpOnly; SameSite=Strict; Secure`)
    expect(response.headers.get('content-security-policy')).toBe("default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
  })

  it.each([400, 403, 503])('gives an actionable recovery path for an error response (%s)', async (status) => {
    const response = confirmationPage('', 'El enlace venció o ya fue utilizado.', status)
    const page = await confirmationDocument(response)

    expect(response.status).toBe(status)
    expect(page.querySelector('[role="alert"]')?.textContent).toBe('El enlace venció o ya fue utilizado.')
    expect(page.querySelector('a[href="/login?confirmation=resend#reenviar-confirmacion"]')?.textContent).toBe('Solicitar un nuevo enlace')
    expect(page.querySelector('a[href="/login"]')?.textContent).toBe('Volver al ingreso')
    expect(page.querySelector('form, input[name="token_hash"]')).toBeNull()
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('renders interpolated messages as text instead of executable markup', async () => {
    const message = '<script>alert("correo")</script> & <img src=x onerror=alert(1)> \'texto\''
    const page = await confirmationDocument(confirmationPage('', message, 400))

    expect(page.querySelector('[role="alert"]')?.textContent).toBe(message)
    expect(page.querySelector('script, [onerror]')).toBeNull()
    expect(page.querySelectorAll('img')).toHaveLength(1)
  })

  it.each([
    ['<script>alert(1)</script>', csrfToken],
    [token, 'short'],
    [token, '']
  ])('never includes a confirmation form with invalid token material', async (confirmationToken, csrf) => {
    const response = confirmationPage(confirmationToken, undefined, 400, csrf)
    const page = await confirmationDocument(response)

    expect(page.querySelector('form, input[name="token_hash"], input[name="csrf_token"]')).toBeNull()
    expect(page.querySelector('script')).toBeNull()
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('provides responsive local styling, accessible controls, and reduced-motion behavior', () => {
    const path = resolve(process.cwd(), 'public/auth-confirmation.css')
    expect(existsSync(path)).toBe(true)
    const css = readFileSync(path, 'utf8')

    expect(css).toContain('#f0f5fd')
    expect(css).toContain('#0d1830')
    expect(css).toContain('#075cff')
    expect(css).toContain('min-height: 48px')
    expect(css).toContain('width: min(100% - 48px, 440px)')
    expect(css).toContain('height: 208px')
    expect(css).toContain('font-size: 48px')
    expect(css).toContain('max-width: 57%')
    expect(css).toContain('mix-blend-mode: multiply')
    expect(css).toContain(':focus-visible')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).not.toContain('@import')
    expect(css).not.toMatch(/url\(/)
  })
})
