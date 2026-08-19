import type { SetAllCookies } from '@supabase/ssr'
import { describe, expect, it } from 'vitest'
import { applySupabaseCookies } from '../../lib/supabase/server.ts'

const cookiesToSet = [
  { name: 'sb-access-token', value: 'access-token', options: { httpOnly: true, path: '/' } },
  { name: 'sb-refresh-token', value: 'refresh-token', options: { sameSite: 'lax' as const } }
] satisfies Parameters<SetAllCookies>[0]

describe('applySupabaseCookies', () => {
  it('applies every cookie through the provided setter', () => {
    const applied: Parameters<SetAllCookies>[0] = []

    applySupabaseCookies(cookiesToSet, (cookie) => applied.push(cookie))

    expect(applied).toEqual(cookiesToSet)
  })

  it('ignores the known Next.js read-only cookie error', () => {
    const readonlyError = new Error(
      'Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options'
    )

    expect(() => applySupabaseCookies(cookiesToSet, () => { throw readonlyError })).not.toThrow()
  })

  it('rethrows unexpected cookie setter errors', () => {
    const unexpectedError = new Error('Cookie storage unavailable')

    expect(() => applySupabaseCookies(cookiesToSet, () => { throw unexpectedError })).toThrow(unexpectedError)
  })
})
