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
})
