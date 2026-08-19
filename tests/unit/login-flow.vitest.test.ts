import { describe, expect, it } from 'vitest'

import {
  authenticateLogin,
  type LoginGateway,
  type LoginProfile
} from '../../lib/auth/login'

function createGateway(options: {
  signIn?: LoginGateway['signIn']
  profile?: LoginProfile | null
} = {}) {
  let signInCalls = 0
  let signOutCalls = 0

  const gateway: LoginGateway = {
    async signIn(credentials) {
      signInCalls += 1
      return options.signIn
        ? options.signIn(credentials)
        : { ok: true, userId: 'user-1' }
    },
    async findProfile() {
      return Object.prototype.hasOwnProperty.call(options, 'profile')
        ? options.profile ?? null
        : { role: 'customer' }
    },
    async signOut() {
      signOutCalls += 1
    }
  }

  return {
    gateway,
    signInCalls: () => signInCalls,
    signOutCalls: () => signOutCalls
  }
}

describe('login flow', () => {
  it('rejects incomplete credentials before calling Supabase', async () => {
    const fake = createGateway()

    const result = await authenticateLogin({ email: ' ', password: '' }, fake.gateway)

    expect(result).toEqual({
      ok: false,
      email: '',
      message: 'Ingresá tu email y contraseña.'
    })
    expect(fake.signInCalls()).toBe(0)
  })

  it('returns a clear message when credentials are invalid', async () => {
    const fake = createGateway({
      signIn: async () => ({ ok: false, reason: 'invalid_credentials' })
    })

    const result = await authenticateLogin(
      { email: 'ADMIN.DEMO@LYSTO.COM.AR ', password: 'incorrecta' },
      fake.gateway
    )

    expect(result).toEqual({
      ok: false,
      email: 'admin.demo@lysto.com.ar',
      message: 'El email o la contraseña no son correctos.'
    })
  })

  it('closes the session when the authenticated user has no Lysto profile', async () => {
    const fake = createGateway({ profile: null })

    const result = await authenticateLogin(
      { email: 'persona@lysto.com.ar', password: 'una-clave-segura' },
      fake.gateway
    )

    expect(result).toMatchObject({
      ok: false,
      message: 'Tu cuenta todavía no tiene un perfil habilitado en Lysto.'
    })
    expect(fake.signOutCalls()).toBe(1)
  })

  it('rejects a professional who is not approved', async () => {
    const fake = createGateway({
      profile: { role: 'professional', professionalApproved: false }
    })

    const result = await authenticateLogin(
      { email: 'tecnico@lysto.com.ar', password: 'una-clave-segura' },
      fake.gateway
    )

    expect(result).toMatchObject({
      ok: false,
      message: 'Tu perfil técnico todavía no está aprobado por Lysto.'
    })
    expect(fake.signOutCalls()).toBe(1)
  })

  it.each([
    ['customer', '/app'],
    ['professional', '/pro/dashboard'],
    ['admin', '/admin/dashboard']
  ] as const)('redirects %s to its own panel', async (role, redirectTo) => {
    const fake = createGateway({
      profile: role === 'professional'
        ? { role, professionalApproved: true }
        : { role }
    })

    const result = await authenticateLogin(
      { email: `${role}@lysto.com.ar`, password: 'una-clave-segura' },
      fake.gateway
    )

    expect(result).toEqual({ ok: true, redirectTo })
    expect(fake.signOutCalls()).toBe(0)
  })
})
