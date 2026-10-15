// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { URLSearchParams } from 'node:url'

const fixtures = vi.hoisted(() => ({ verifyOtp: vi.fn(), rpc: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ auth: fixtures, rpc: fixtures.rpc })
}))

import { POST } from '../../app/auth/reset-password/route'

const origin = 'https://lysto.test'
const token = 'a'.repeat(64)
const password = 'Clave123'

function recoveryRequest(values: Record<string, string> = {}, requestOrigin = origin) {
  return new Request(`${origin}/auth/reset-password`, {
    method: 'POST',
    headers: { origin: requestOrigin },
    body: new URLSearchParams({ token_hash: token, password, repeatPassword: password, ...values })
  })
}

async function expectRecoveryError(response: Response, status: number, message: string, primary: 'recovery' | 'login' = 'recovery') {
  const html = await response.text()
  expect(response.status).toBe(status)
  expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
  expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
  expect(response.headers.get('referrer-policy')).toBe('same-origin')
  expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  expect(response.headers.get('content-security-policy')).toBe("default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
  expect(response.headers.get('set-cookie')).toBeNull()
  expect(html).toContain('<h1 id="confirmation-title">Cambiar contraseña</h1>')
  expect(html).toContain(`role="alert">${message}</p>`)
  expect(html).toContain('<link rel="stylesheet" href="/auth-confirmation.css">')
  if (primary === 'login') {
    expect(html).toContain('class="confirmation-button" href="/login">Iniciar sesión</a>')
    expect(html).not.toContain('href="/recuperar"')
    expect(html).not.toContain('Volver al ingreso')
  } else {
    expect(html).toContain('class="confirmation-button" href="/recuperar">Solicitar un nuevo enlace</a>')
    expect(html).toContain('href="/login">Volver al ingreso</a>')
  }
  expect(html).not.toMatch(/<(?:form|script|input)\b|\sstyle=/)
  expect(html).not.toContain(token)
  expect(html).not.toContain(password)
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NEXT_PUBLIC_APP_URL', origin)
  fixtures.verifyOtp.mockResolvedValue({ data: { user: { id: 'customer' } }, error: null })
  fixtures.rpc.mockResolvedValue({ data: true, error: null })
  fixtures.updateUser.mockResolvedValue({ error: null })
  fixtures.signOut.mockResolvedValue({ error: null })
})

afterEach(() => vi.unstubAllEnvs())

describe('password recovery error presentation', () => {
  it('presents rejected origins without contacting Auth', async () => {
    await expectRecoveryError(await POST(recoveryRequest({}, 'https://evil.test')), 403, 'Origen no permitido.')
    expect(fixtures.verifyOtp).not.toHaveBeenCalled()
  })

  it('presents invalid values without consuming a recovery token', async () => {
    await expectRecoveryError(await POST(recoveryRequest({ password: 'bad' })), 400, 'Revisá el enlace y las contraseñas. Deben coincidir y tener entre 6 y 12 caracteres.')
    expect(fixtures.verifyOtp).not.toHaveBeenCalled()
  })

  it('presents an expired token without changing the password', async () => {
    fixtures.verifyOtp.mockResolvedValue({ data: { user: null }, error: { code: 'otp_expired' } })
    await expectRecoveryError(await POST(recoveryRequest()), 400, 'El enlace venció o ya fue utilizado. Solicitá otro desde Recuperar acceso.')
    expect(fixtures.updateUser).not.toHaveBeenCalled()
  })

  it('retains the protected policy failure and local sign-out', async () => {
    fixtures.rpc.mockResolvedValue({ data: null, error: { code: 'unavailable' } })
    await expectRecoveryError(await POST(recoveryRequest()), 503, 'No pudimos verificar si tu cuenta está lista para cambiar la contraseña. Intentá nuevamente.')
    expect(fixtures.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(fixtures.updateUser).not.toHaveBeenCalled()
  })

  it('retains the professional onboarding boundary and local sign-out', async () => {
    fixtures.rpc.mockResolvedValue({ data: false, error: null })
    await expectRecoveryError(await POST(recoveryRequest()), 403, 'Primero completá el alta técnica con tu clave provisoria. Después vas a poder cambiar la contraseña.')
    expect(fixtures.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(fixtures.updateUser).not.toHaveBeenCalled()
  })

  it('presents a rejected password update and keeps local sign-out', async () => {
    fixtures.updateUser.mockResolvedValue({ error: { code: 'unavailable' } })
    await expectRecoveryError(await POST(recoveryRequest()), 400, 'No pudimos cambiar la contraseña. Solicitá otro enlace e intentá nuevamente.')
    expect(fixtures.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('accurately communicates a successful change with incomplete global sign-out', async () => {
    fixtures.signOut.mockResolvedValue({ error: { code: 'unavailable' } })
    await expectRecoveryError(await POST(recoveryRequest()), 503, 'La contraseña cambió, pero no pudimos cerrar todas las sesiones. Ingresá y cerrá las sesiones desde tu cuenta.', 'login')
    expect(fixtures.updateUser).toHaveBeenCalledWith({ password })
    expect(fixtures.signOut).toHaveBeenCalledWith({ scope: 'global' })
  })

  it('presents unexpected failures without leaking provider details', async () => {
    fixtures.verifyOtp.mockRejectedValue(new Error('private provider information'))
    const response = await POST(recoveryRequest())
    await expectRecoveryError(response, 503, 'No pudimos completar la recuperación. Solicitá otro enlace e intentá nuevamente.')
  })

  it('preserves the existing successful change, global sign-out, and redirect', async () => {
    const response = await POST(recoveryRequest())
    expect(fixtures.verifyOtp).toHaveBeenCalledWith({ token_hash: token, type: 'recovery' })
    expect(fixtures.updateUser).toHaveBeenCalledWith({ password })
    expect(fixtures.signOut).toHaveBeenCalledWith({ scope: 'global' })
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${origin}/login?reset=success`)
  })
})
