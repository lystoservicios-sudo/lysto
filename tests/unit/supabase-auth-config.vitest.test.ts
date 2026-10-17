import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Supabase authentication configuration', () => {
  it('accepts the customer registration minimum of 6 characters', () => {
    const config = readFileSync(join(process.cwd(), 'supabase', 'config.toml'), 'utf8')

    expect(config).toMatch(/^minimum_password_length = 6$/m)
  })

  it.each([
    ['confirmation.html', 'email-security.jpg'],
    ['recovery.html', 'email-security.jpg'],
    ['email-change.html', 'email-security.jpg']
  ])('uses the branded security email shell in %s', (file, illustration) => {
    const template = readFileSync(join(process.cwd(), 'supabase', 'templates', file), 'utf8')
    expect(template).toContain('{{ .SiteURL }}/images/email/lysto-logo.png')
    expect(template).toContain(`{{ .SiteURL }}/images/email/${illustration}`)
    expect(template).toContain('max-width:640px')
    expect(template).toContain('role="presentation"')
  })
})
