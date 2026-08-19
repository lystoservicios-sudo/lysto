import { describe, expect, it } from 'vitest'

import * as loginActions from '../../app/(auth)/login/actions'

describe('login server action contract', () => {
  it('exports only async server actions at runtime', () => {
    expect(Object.keys(loginActions)).toEqual(['loginAction'])
    expect(loginActions.loginAction.constructor.name).toBe('AsyncFunction')
  })
})
