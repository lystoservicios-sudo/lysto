import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Supabase authentication configuration', () => {
  it('accepts the customer registration minimum of 6 characters', () => {
    const config = readFileSync(join(process.cwd(), 'supabase', 'config.toml'), 'utf8')

    expect(config).toMatch(/^minimum_password_length = 6$/m)
  })
})
