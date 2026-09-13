import { afterEach, describe, expect, it, vi } from 'vitest'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'

describe('private mutation request boundary', () => {
  afterEach(() => vi.unstubAllEnvs())
  function request(body: string, origin = 'http://localhost:3100', type = 'application/json') {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3100')
    return new Request('http://localhost:3100/api/customer/profile', {
      method: 'PUT',
      headers: { origin, 'content-type': type },
      body
    })
  }
  it('accepts same-origin JSON and rejects cross-origin or plain-text mutations', async () => {
    await expect(readPrivateJsonBody(request('{"name":"Cliente"}'))).resolves.toEqual({
      name: 'Cliente'
    })
    await expect(
      readPrivateJsonBody(request('{}', 'https://attacker.invalid'))
    ).rejects.toMatchObject({ code: 'forbidden' })
    await expect(
      readPrivateJsonBody(request('{}', 'http://localhost:3100', 'text/plain'))
    ).rejects.toMatchObject({ code: 'invalid_input' })
  })
  it('bounds actual UTF-8 body bytes even without content-length', async () => {
    await expect(
      readPrivateJsonBody(request(JSON.stringify({ text: 'á'.repeat(5000) })))
    ).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(readPrivateJsonBody(request('{bad'))).rejects.toBeInstanceOf(SyntaxError)
  })
})
