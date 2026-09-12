import { createHmac } from 'node:crypto'
import type { FixtureAccount } from './fixtures'

// Test-only TOTP generator. Production verification belongs exclusively to Auth.
export function fixtureTotp(secret: string, time = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0,
    value = 0
  const bytes: number[] = []
  for (const char of secret.toUpperCase().replace(/=+$/, '')) {
    const digit = alphabet.indexOf(char)
    if (digit < 0) throw Error('Invalid test TOTP secret')
    value = (value << 5) | digit
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >>> bits) & 255)
    }
  }
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 30000)))
  const digest = createHmac('sha1', Buffer.from(bytes)).update(counter).digest()
  const offset = digest[digest.length - 1] & 15
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0')
}
export async function enrollFixtureMfa(account: FixtureAccount) {
  const enrolled = await account.client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Disposable Lysto test'
  })
  if (enrolled.error || !enrolled.data || enrolled.data.type !== 'totp')
    throw Error(
      `Unable to enroll disposable MFA factor: ${enrolled.error?.code ?? 'unexpected_factor'}`
    )
  const verified = await account.client.auth.mfa.challengeAndVerify({
    factorId: enrolled.data.id,
    code: fixtureTotp(enrolled.data.totp.secret)
  })
  if (verified.error || !verified.data) throw Error('Unable to verify disposable MFA factor')
  account.accessToken = verified.data.access_token
  account.refreshToken = verified.data.refresh_token
  return { factorId: enrolled.data.id }
}
