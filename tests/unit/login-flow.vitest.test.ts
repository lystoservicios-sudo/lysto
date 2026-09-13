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
        : { role: 'customer', assuranceLevel: 'aal1' }
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
  it('keeps the existing Auth session when customer profile completion is required', async () => {
    const fake = createGateway({ signIn: async () => ({ok:true,userId:'existing-customer',accountIncomplete:true}), profile:null })
    expect(await authenticateLogin({email:'customer@lysto.test',password:'password'},fake.gateway)).toEqual({ok:true,redirectTo:'/completar-cuenta'})
    expect(fake.signOutCalls()).toBe(0)
  })
  it('accepts a local destination inside the authenticated customer panel', async () => {
    const fake = createGateway()
    expect(await authenticateLogin({ email: 'customer@lysto.test', password: 'password', next: '/app/trabajos' }, fake.gateway))
      .toEqual({ ok: true, redirectTo: '/app/trabajos' })
  })
  it.each(['https://attacker.test', '//attacker.test', '/admin/dashboard'])('rejects an unauthorized login destination %s', async next => {
    const fake = createGateway()
    expect(await authenticateLogin({ email: 'customer@lysto.test', password: 'password', next }, fake.gateway))
      .toEqual({ ok: true, redirectTo: '/app' })
  })
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
      profile: { role: 'professional', professionalApproved: false, assuranceLevel: 'aal1' }
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
    ['customer', 'aal1', '/app'],
    ['professional', 'aal1', '/seguridad?next=%2Fpro%2Fdashboard'],
    ['professional', 'aal2', '/pro/dashboard'],
    ['admin', 'aal1', '/seguridad?next=%2Fadmin%2Fdashboard'],
    ['admin', 'aal2', '/admin/dashboard']
  ] as const)('redirects %s with %s to the expected destination', async (role, assuranceLevel, redirectTo) => {
    const fake = createGateway({
      profile: role === 'professional'
        ? { role, professionalApproved: true, assuranceLevel }
        : { role, assuranceLevel }
    })

    const result = await authenticateLogin(
      { email: `${role}@lysto.com.ar`, password: 'una-clave-segura' },
      fake.gateway
    )

    expect(result).toEqual({ ok: true, redirectTo })
    expect(fake.signOutCalls()).toBe(0)
  })
})
