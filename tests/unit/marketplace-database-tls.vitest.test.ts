// @vitest-environment node
import { afterEach, expect, it } from 'vitest'
import { X509Certificate } from 'node:crypto'
import { getCACertificates, setDefaultCACertificates } from 'node:tls'
import { trustedMarketplaceDatabaseUrl } from '@/lib/payments/marketplace-database-tls'

const originalCAs = getCACertificates('default')
afterEach(() => setDefaultCACertificates(originalCAs))

it('trusts the official Supabase CA and enforces hostname verification for a pooler URL', () => {
  const input = 'postgresql://lysto_marketplace:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require'
  const output = new URL(trustedMarketplaceDatabaseUrl(input))

  expect(output.searchParams.get('sslmode')).toBe('verify-full')
  expect(output.username).toBe('lysto_marketplace')
  expect(output.password).toBe('secret')
  expect(getCACertificates('default').some((pem) =>
    new X509Certificate(pem).subject.includes('Supabase Root 2021 CA')
  )).toBe(true)
  expect(getCACertificates('default').length).toBeGreaterThan(originalCAs.length)
})

it('leaves non-Supabase test connections and the system trust store unchanged', () => {
  const input = 'postgresql://localhost:5432/test'
  const currentCAs = getCACertificates('default')
  expect(trustedMarketplaceDatabaseUrl(input)).toBe(input)
  expect(getCACertificates('default')).toEqual(currentCAs)
})
