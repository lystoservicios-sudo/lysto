import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PUT, POST } from '@/app/api/customer/homes/route'
import { createHomeSchema, saveHomeSchema } from '@/lib/customer-homes/contracts'

const state = vi.hoisted(() => ({ role: 'customer', rpc: vi.fn() }))
vi.mock('@/lib/auth/session', async importActual => {
  const actual = await importActual<typeof import('@/lib/auth/session')>()
  return { ...actual, requireSession: async () => ({ role: state.role, profileId: '00000000-0000-4000-8000-000000000001', customerId: '00000000-0000-4000-8000-000000000002', client: { rpc: state.rpc } }) }
})
vi.mock('@/lib/observability/logger', () => ({ logEvent: vi.fn() }))
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
function largeLayout() {
  const floors = Array.from({ length: 12 }, (_, fi) => ({ id: id(1000 + fi), name: `Planta ${fi + 1}`, order: fi,
    rooms: Array.from({ length: 60 }, (_, ri) => ({ id: id(10000 + fi * 60 + ri), name: 'á'.repeat(80), kind: 'bedroom' as const, variant: 'principal', x: ri % 10 * 4.15, z: Math.floor(ri / 10) * 4.15, width: 4, depth: 4, rotation: 0 as const, windows: 'large' as const }))
  }))
  return { name: 'Hogar amplio', addressId: id(20), kind: 'house' as const, building: null, features: { balcony: false, terrace: false, windows: 'large' as const }, floors,
    placements: Array.from({ length: 500 }, (_, i) => ({ equipmentId: id(20000 + i), roomId: floors[Math.floor(i / 60)].rooms[i % 60].id, wall: 'north' as const, offset: .5, height: 2 })) }
}
function request(method: 'POST' | 'PUT', body: string) {
  return new Request('http://localhost:3100/api/customer/homes', { method, headers: { origin: 'http://localhost:3100', 'content-type': 'application/json' }, body })
}
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3100')
  vi.stubEnv('RATE_LIMIT_HASH_KEY', '')
  state.role = 'customer'
  state.rpc.mockReset().mockResolvedValue({ data: { saved: true }, error: null })
})
afterEach(() => vi.unstubAllEnvs())
describe('Hogar aggregate HTTP byte budget', () => {
  it('saves a schema-valid 12-floor layout with 500 placements larger than 128 KiB', async () => {
    const value = { ...largeLayout(), id: id(1), expectedVersion: 1 }
    expect(saveHomeSchema.safeParse(value).success).toBe(true)
    const body = JSON.stringify(value)
    expect(Buffer.byteLength(body)).toBeGreaterThan(128 * 1024)
    expect(Buffer.byteLength(body)).toBeLessThan(512 * 1024)
    const response = await PUT(request('PUT', body))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(state.rpc).toHaveBeenCalledWith('write_customer_home', expect.objectContaining({ p_operation: 'save', p_id: id(1), p_expected_version: 1, p_data: expect.objectContaining({ floors: expect.any(Array), placements: expect.any(Array) }) }))
    expect(state.rpc.mock.calls[0][1].p_data.placements).toHaveLength(500)
  })
  it('creates a schema-valid 12-floor layout larger than 128 KiB through the same bound reader', async () => {
    const value = { ...largeLayout(), placements: [], idempotencyKey: id(2) }
    expect(createHomeSchema.safeParse(value).success).toBe(true)
    const body = JSON.stringify(value)
    expect(Buffer.byteLength(body)).toBeGreaterThan(128 * 1024)
    const response = await POST(request('POST', body))
    expect(response.status).toBe(201)
    expect(state.rpc.mock.calls[0][1].p_data.floors).toHaveLength(12)
  })
  it.each(['POST','PUT'] as const)('rejects %s actual streamed bytes above 512 KiB before RPC', async method => {
    const value = method === 'PUT' ? { ...largeLayout(), id: id(1), expectedVersion: 1 } : { ...largeLayout(), placements: [], idempotencyKey: id(2) }
    const body = JSON.stringify(value) + ' '.repeat(512 * 1024)
    const response = await (method === 'PUT' ? PUT : POST)(request(method, body))
    expect(response.status).toBe(400)
    expect((await response.json()).code).toBe('invalid_input')
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it('rejects another role before reading even a large malformed body', async () => {
    state.role = 'professional'
    const value = request('PUT', '{broken' + ' '.repeat(512 * 1024))
    const reader = vi.spyOn(value.body!, 'getReader')
    const response = await PUT(value)
    expect(response.status).toBe(403)
    expect(reader).not.toHaveBeenCalled()
    expect(state.rpc).not.toHaveBeenCalled()
  })
})
