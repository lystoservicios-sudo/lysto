import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

import * as loginActions from '../../app/(auth)/login/actions'

describe('login server action contract', () => {
  it('exports only async server actions at runtime', () => {
    expect(Object.keys(loginActions)).toEqual(['loginAction'])
    expect(loginActions.loginAction.constructor.name).toBe('AsyncFunction')
  })

  it('resolves the post-login profile through the AAL1-safe session context', () => {
    const source = readFileSync('app/(auth)/login/actions.ts', 'utf8')
    expect(source).toContain("rpc('get_session_context')")
    expect(source).not.toContain(".from('profiles')")
    expect(source).not.toContain(".from('professional_profiles')")
  })
  it('accepts a professional invitation token after authentication and before profile lookup', () => {
    const source = readFileSync('app/(auth)/equipo/login/actions.ts', 'utf8')
    const accept = source.indexOf("rpc('accept_professional_invitation'")
    const lookup = source.indexOf("rpc('get_session_context')")
    expect(accept).toBeGreaterThan(-1)
    expect(lookup).toBeGreaterThan(accept)
    expect(source).toContain("trustedRole !== 'professional'")
  })

  it('resumes a provisioned professional invitation after password login even without the original token', () => {
    const source = readFileSync('app/(auth)/equipo/login/actions.ts', 'utf8')
    const accept = source.indexOf("rpc('accept_professional_invitation'")
    const roleCheck = source.indexOf("trustedRole === 'professional'")
    expect(roleCheck).toBeGreaterThan(-1)
    expect(accept).toBeGreaterThan(roleCheck)
    expect(source).toContain('p_token: invitationToken')
    expect(source).not.toMatch(/if\s*\(invitationToken\)\s*\{[^}]*accept_professional_invitation/s)
  })

  it('does not label every invitation acceptance failure as an expired invitation', () => {
    const source = readFileSync('app/(auth)/equipo/login/actions.ts', 'utf8')
    expect(source).toContain("accepted.error.code === 'P0002' ? 'invalid_professional_invitation' : 'unexpected'")
  })
})
