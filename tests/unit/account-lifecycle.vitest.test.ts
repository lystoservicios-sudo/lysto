import { describe, expect, it } from 'vitest'
import { authOrigin, isAllowedAuthOrigin, registerCustomer, recoverAccount, validRecoveryPassword, validateRegistration, type RegistrationInput, type RegistrationPolicy } from '../../lib/auth/account-lifecycle'

const policy: RegistrationPolicy = { termsVersion: 'test-only-terms-v1', privacyVersion: 'test-only-privacy-v1', termsUrl: '/test/terms', privacyUrl: '/test/privacy', testOnly: true }
const input: RegistrationInput = { email: ' Cliente@Example.com ', password: 'Clave123', repeatPassword: 'Clave123', firstName: ' Ana ', lastName: ' Pérez ', phone: '+54 11 12345678', accepted: true, termsVersion: policy.termsVersion, privacyVersion: policy.privacyVersion }

describe('customer account lifecycle', () => {
  it('accepts a complete registration and normalizes contact fields', () => {
    expect(validateRegistration(input, policy)).toMatchObject({ ok: true, data: { email: 'cliente@example.com', firstName: 'Ana', lastName: 'Pérez' } })
  })
  it.each([6, 12])('accepts a registration password with %i characters', length => {
    const password = 'a'.repeat(length)
    expect(validateRegistration({ ...input, password, repeatPassword: password }, policy).ok).toBe(true)
  })
  it.each([5, 13])('rejects a registration password with %i characters', length => {
    const password = 'a'.repeat(length)
    expect(validateRegistration({ ...input, password, repeatPassword: password }, policy).ok).toBe(false)
  })
  it.each([
    { accepted: false }, { termsVersion: 'arbitrary' }, { privacyVersion: 'arbitrary' },
    { password: 'short', repeatPassword: 'short' }, { repeatPassword: 'different' },
    { email: 'invalid' }, { firstName: '' }, { lastName: '' }, { phone: '' },
    { firstName: 'a'.repeat(101) }
  ])('rejects invalid registration %j', patch => { expect(validateRegistration({ ...input, ...patch }, policy).ok).toBe(false) })
  it('fails closed without configured legal documents', () => { expect(validateRegistration(input, null).ok).toBe(false) })
  it('accepts only the exact configured mutation origin', () => { expect(isAllowedAuthOrigin('https://app.lysto.test', 'https://app.lysto.test')).toBe(true) })
  it.each([null, 'null', 'https://evil.test', 'https://app.lysto.test.evil.test', 'https://app.lysto.test/path', 'https://user@app.lysto.test'])('rejects foreign or malformed origin %s', origin => { expect(isAllowedAuthOrigin(origin, 'https://app.lysto.test')).toBe(false) })
  it('accepts explicit loopback origin for local tests', () => { expect(authOrigin('http://127.0.0.1:3100')).toBe('http://127.0.0.1:3100') })
  it.each([undefined, 'http://public.example', 'https://app.example/path', 'https://user:pass@app.example', 'https://app.example?next=x'])('rejects unsafe app origin %s', origin => { expect(() => authOrigin(origin)).toThrow() })
  it('validates a strong matching recovery password', () => { expect(validRecoveryPassword('OtraClaveLarga123!', 'OtraClaveLarga123!')).toBe(true) })
  it('keeps the recovery password policy longer than the registration policy', () => {
    expect(validRecoveryPassword('Clave123', 'Clave123')).toBe(false)
  })
  it.each([['short', 'short'], ['a'.repeat(129), 'a'.repeat(129)], ['ClaveCorrecta123!', 'different']])('rejects unsafe recovery password', (password, confirmation) => { expect(validRecoveryPassword(password, confirmation)).toBe(false) })
  it('returns the same public registration result for new and duplicate emails', async () => {
    const fresh = await registerCustomer(input, policy, { signUp: async () => ({ error: null }) })
    const duplicate = await registerCustomer(input, policy, { signUp: async () => ({ error: { code: 'user_already_exists' } }) })
    expect(fresh).toEqual(duplicate)
    expect(fresh.status).toBe('success')
  })
  it('does not contact Auth when legal policy or input is invalid', async () => {
    let calls = 0
    const result = await registerCustomer(input, null, { signUp: async () => { calls++; return { error: null } } })
    expect(calls).toBe(0)
    expect(result.status).toBe('error')
  })
  it('does not expose an unconfirmed duplicate through the email resend cooldown', async () => {
    const fresh = await registerCustomer(input, policy, { signUp: async () => ({ error: null }) })
    const cooldown = await registerCustomer(input, policy, { signUp: async () => ({ error: { code: 'over_email_send_rate_limit' } }) })
    expect(cooldown).toEqual(fresh)
  })
  it('recovery response does not disclose whether the email exists', async () => {
    expect(await recoverAccount('ana@example.com', { reset: async () => ({ error: null }) }))
      .toEqual(await recoverAccount('ana@example.com', { reset: async () => ({ error: { code: 'user_not_found' } }) }))
  })
  it('rejects invalid recovery email before contacting Auth', async () => {
    let calls = 0
    const result = await recoverAccount('not-an-email', { reset: async () => { calls++; return { error: null } } })
    expect(calls).toBe(0)
    expect(result.status).toBe('error')
  })
})
