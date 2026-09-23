// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('@/lib/professional/avatar-service', () => ({ saveProfessionalAvatar: mocks.save }))
import { POST } from '@/app/api/professional/onboarding/avatar/route'

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lysto.test')
  mocks.save.mockReset().mockResolvedValue({ avatarUrl: 'https://lysto.test/avatar.webp' })
})

function request(bytes: Uint8Array, origin = 'https://lysto.test') {
  return new Request('https://lysto.test/api/professional/onboarding/avatar', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'image/jpeg' }, body: Buffer.from(bytes)
  })
}

it('rejects cross-origin avatar upload before reading or publishing', async () => {
  expect((await POST(request(new Uint8Array([1]), 'https://attacker.test'))).status).toBe(403)
  expect(mocks.save).not.toHaveBeenCalled()
})

it('rejects an overlarge stream before publishing', async () => {
  expect((await POST(request(new Uint8Array(2 * 1024 * 1024 + 1)))).status).toBe(400)
  expect(mocks.save).not.toHaveBeenCalled()
})

it('passes a bounded body to the authenticated avatar pipeline', async () => {
  const response = await POST(request(new Uint8Array([1, 2, 3])))
  expect(response.status).toBe(200)
  expect(mocks.save).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), 'image/jpeg')
})
