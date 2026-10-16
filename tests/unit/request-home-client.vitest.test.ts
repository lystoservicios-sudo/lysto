import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearRequestHomeCommand, homeSaveInput, locationCommandWasSuperseded, readRequestHomeCommand, replayRequestHomeCommand, sameRequestHomeCommand, storeRequestHomeCommand, type RequestHomeCommand } from '@/features/service-request/request-home-client'
import type { CustomerHome } from '@/lib/customer-homes/contracts'
import type { CustomerAssetAddress } from '@/lib/customer-assets/contracts'

const actor = '40000000-0000-4000-8000-000000000001'
const home: CustomerHome = { id: '40000000-0000-4000-8000-000000000002', addressId: '40000000-0000-4000-8000-000000000003', name: 'Casa', kind: 'house', version: 2, building: null, features: { balcony: false, terrace: false, windows: 'small' }, floors: [{ id: '40000000-0000-4000-8000-000000000004', name: 'Planta principal', order: 0, rooms: [] }], placements: [] }
const address: CustomerAssetAddress = { id: home.addressId, version: 3, label: 'Casa', street: 'San Martín', number: '120', city: 'Buenos Aires', province: 'CABA', floor: null, apartment: null, postalCode: null, reference: null, propertyType: 'house', access: {}, isDefault: false, createdAt: '2026-10-14T12:00:00Z', archivedAt: null }
function addressCommand(overrides: Partial<CustomerAssetAddress> = {}) {
  const { createdAt, archivedAt, version, ...input } = { ...address, ...overrides }
  void createdAt; void archivedAt; void version
  return { kind: 'save-address' as const, input: { ...input, expectedVersion: 2 } }
}
beforeEach(() => { window.sessionStorage.clear(); vi.unstubAllGlobals() })
describe('request location durable recovery', () => {
  it('matches pending command field order canonically without ignoring changed names or versions', () => {
    const command = { kind: 'save-home' as const, input: homeSaveInput(home) }
    const reordered = { ...command, input: Object.fromEntries(Object.entries(command.input).reverse()) as typeof command.input }
    expect(sameRequestHomeCommand(command, reordered)).toBe(true)
    expect(sameRequestHomeCommand(command, { ...command, input: { ...command.input, name: 'Otro hogar' } })).toBe(false)
    expect(sameRequestHomeCommand(command, { ...command, input: { ...command.input, expectedVersion: 3 } })).toBe(false)
    expect(sameRequestHomeCommand(null, command)).toBe(false)
    expect(sameRequestHomeCommand({} as RequestHomeCommand, command)).toBe(false)
  })
  it('never ignores a changed creation identity when comparing persisted recovery commands', () => {
    const { id, expectedVersion, ...input } = homeSaveInput(home)
    void id; void expectedVersion
    const command = { kind: 'create-home' as const, input: { ...input, idempotencyKey: actor } }
    expect(sameRequestHomeCommand(command, { ...command, input: { ...command.input, idempotencyKey: home.id } })).toBe(false)
    expect(sameRequestHomeCommand(command, { kind: 'save-home', input: homeSaveInput(home) })).toBe(false)
  })
  it('preserves floor array order when comparing an exact pending home command', () => {
    const floors = [home.floors[0], { ...home.floors[0], id: actor, name: 'Otra planta', order: 1 }]
    const command = { kind: 'save-home' as const, input: homeSaveInput({ ...home, floors }) }
    expect(sameRequestHomeCommand(command, { ...command, input: { ...command.input, floors: [...floors].reverse() } })).toBe(false)
  })
  it('proves a superseded PUT from a newer canonical version without asserting its desired state persisted', () => {
    const command = { kind: 'save-home' as const, input: homeSaveInput(home) }
    const snapshot = { homes: [{ ...home, name: 'Una edición diferente', version: 3 }], addresses: [], equipment: [] }
    expect(locationCommandWasSuperseded(command, snapshot)).toBe(true)
    expect(command.input.name).toBe('Casa')
  })
  it.each([1, 2, 2.5, NaN])('does not resolve a home PUT at invalid or unadvanced canonical version %s', version => {
    expect(locationCommandWasSuperseded({ kind: 'save-home', input: homeSaveInput(home) }, { homes: [{ ...home, version }], addresses: [], equipment: [] })).toBe(false)
  })
  it('requires the exact active address target to have a newer version', () => {
    const command = addressCommand()
    expect(locationCommandWasSuperseded(command, { homes: [], addresses: [address], equipment: [] })).toBe(true)
    expect(locationCommandWasSuperseded(command, { homes: [], addresses: [{ ...address, version: 2 }], equipment: [] })).toBe(false)
    expect(locationCommandWasSuperseded(command, { homes: [], addresses: [{ ...address, archivedAt: '2026-10-14T13:00:00Z' }], equipment: [] })).toBe(false)
    expect(locationCommandWasSuperseded(command, { homes: [], addresses: [{ ...address, id: actor }], equipment: [] })).toBe(false)
  })
  it('never treats a POST creation or missing home target as a superseded versioned PUT', () => {
    const { id, expectedVersion, ...input } = homeSaveInput(home)
    void id; void expectedVersion
    expect(locationCommandWasSuperseded({ kind: 'create-home', input: { ...input, idempotencyKey: actor } }, { homes: [{ ...home, version: 3 }], addresses: [], equipment: [] })).toBe(false)
    expect(locationCommandWasSuperseded({ kind: 'save-home', input: homeSaveInput(home) }, { homes: [], addresses: [], equipment: [] })).toBe(false)
  })
  it('stores a versioned exact home command per actor without adding extra canonical aliases', () => {
    const command = { kind: 'save-home' as const, input: homeSaveInput({ ...home, addressIds: [home.addressId] }) }
    storeRequestHomeCommand(actor, command)
    expect(readRequestHomeCommand(actor)).toEqual({ command, error: '' })
    expect(readRequestHomeCommand('40000000-0000-4000-8000-000000000005').command).toBeNull()
    clearRequestHomeCommand(actor)
    expect(readRequestHomeCommand(actor).command).toBeNull()
  })
  it('does not repeat a PUT after an ambiguous response if its exact snapshot already persisted', async () => {
    const saved = { ...home, version: 3 }
    const methods: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => { methods.push(options?.method ?? 'GET'); return new Response(JSON.stringify({ homes: [saved], addresses: [], equipment: [] }), { status: 200 }) }))
    expect(await replayRequestHomeCommand(actor, { kind: 'save-home', input: homeSaveInput(home) }, true)).toEqual({ home: saved })
    expect(methods).toEqual(['GET'])
  })
  it('rejects conflicting newer geometry rather than silently overwriting it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ homes: [{ ...home, name: 'Otra edición', version: 3 }], addresses: [], equipment: [] }), { status: 200 })))
    await expect(replayRequestHomeCommand(actor, { kind: 'save-home', input: homeSaveInput(home) }, true)).rejects.toThrow('La ubicación cambió')
  })
  it('recognizes the same saved home despite reordered object keys inside features and rooms', async () => {
    const room: CustomerHome['floors'][number]['rooms'][number] = { id: '40000000-0000-4000-8000-000000000008', name: 'Living', kind: 'living', variant: 'family', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'small' }
    const desired = { ...home, floors: [{ ...home.floors[0], rooms: [room] }] }
    const saved = { ...desired, version: 3, features: Object.fromEntries(Object.entries(home.features).reverse()), floors: [{ ...desired.floors[0], rooms: [Object.fromEntries(Object.entries(room).reverse())] }] }
    const methods: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => { methods.push(options?.method ?? 'GET'); return new Response(JSON.stringify({ homes: [saved], addresses: [], equipment: [] }), { status: 200 }) }))
    await expect(replayRequestHomeCommand(actor, { kind: 'save-home', input: homeSaveInput(desired) }, true)).resolves.toEqual({ home: saved })
    expect(methods).toEqual(['GET'])
  })
  it('does not ignore changed room geometry or normalize away array order when recovering a home save', async () => {
    const room: CustomerHome['floors'][number]['rooms'][number] = { id: '40000000-0000-4000-8000-000000000008', name: 'Living', kind: 'living', variant: 'family', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'small' }
    const other = { ...room, id: '40000000-0000-4000-8000-000000000009', name: 'Otro living', x: 4 }
    const desired = { ...home, floors: [{ ...home.floors[0], rooms: [room, other] }] }
    for (const rooms of [[other, room], [{ ...room, depth: 3 }, other]]) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ homes: [{ ...desired, version: 3, floors: [{ ...desired.floors[0], rooms }] }], addresses: [], equipment: [] }), { status: 200 })))
      await expect(replayRequestHomeCommand(actor, { kind: 'save-home', input: homeSaveInput(desired) }, true)).rejects.toThrow('La ubicación cambió')
    }
  })
  it.each(['floor', 'apartment', 'postalCode', 'reference'] as const)('recognizes an acknowledged address save when empty %s persisted as null', async field => {
    const methods: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => { methods.push(options?.method ?? 'GET'); return new Response(JSON.stringify({ homes: [], addresses: [address], equipment: [] }), { status: 200 }) }))
    await expect(replayRequestHomeCommand(actor, addressCommand({ [field]: '' }), true)).resolves.toEqual({})
    expect(methods).toEqual(['GET'])
  })
  it.each(['floor', 'apartment', 'postalCode', 'reference'] as const)('rejects an actual newer %s value rather than falsely acknowledging a cleared field', async field => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ homes: [], addresses: [{ ...address, [field]: 'Otro valor' }], equipment: [] }), { status: 200 })))
    await expect(replayRequestHomeCommand(actor, addressCommand({ [field]: '' }), true)).rejects.toThrow('La dirección cambió')
  })
  it('compares optional address fields omitted by the command as cleared rather than ignoring them', async () => {
    const command = addressCommand()
    delete command.input.reference
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ homes: [], addresses: [{ ...address, reference: 'Portón rojo' }], equipment: [] }), { status: 200 })))
    await expect(replayRequestHomeCommand(actor, command, true)).rejects.toThrow('La dirección cambió')
  })
  it('recognizes the same trimmed text and unordered access flags without losing false values', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ homes: [], addresses: [{ ...address, floor: '2', access: { hasParking: false, hasElevator: true } }], equipment: [] }), { status: 200 })))
    await expect(replayRequestHomeCommand(actor, addressCommand({ label: ' Casa ', floor: ' 2 ', access: { hasElevator: true, hasParking: false } }), true)).resolves.toEqual({})
  })
  it('rejects a changed access flag when recovering an address save', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ homes: [], addresses: [{ ...address, access: { hasParking: true } }], equipment: [] }), { status: 200 })))
    await expect(replayRequestHomeCommand(actor, addressCommand({ access: { hasParking: false } }), true)).rejects.toThrow('La dirección cambió')
  })
  it('returns real idempotent create IDs and sends the original actor header', async () => {
    const responses: RequestInit[] = []
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => { responses.push(options!); return new Response(JSON.stringify({ home }), { status: 201 }) }))
    const { expectedVersion: removedVersion, id: removedId, ...configuration } = homeSaveInput(home)
    expect(removedVersion).toBe(2); expect(removedId).toBe(home.id)
    const input = { ...configuration, idempotencyKey: '40000000-0000-4000-8000-000000000007' }
    const result = await replayRequestHomeCommand(actor, { kind: 'create-home', input })
    expect(result.home?.id).toBe(home.id)
    expect((responses[0].headers as Record<string, string>)['X-Lysto-Customer-Id']).toBe(actor)
    expect(JSON.parse(responses[0].body as string)).toEqual(input)
  })
  it('renews only the signed proof before replaying an uncertain idempotent home creation', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input), body = JSON.parse(String(options?.body)) as Record<string, unknown>
      calls.push({ url, body })
      if (url === '/api/location/renew') return new Response(JSON.stringify({ proof: 'renewed-proof' }), { status: 200 })
      return new Response(JSON.stringify({ home }), { status: 201 })
    }))
    const { expectedVersion, id, addressId, ...configuration } = homeSaveInput(home)
    void expectedVersion; void id; void addressId
    const newAddress = { label: 'Casa', street: 'San Martín', number: '120', city: 'Buenos Aires', province: 'CABA', propertyType: 'house' as const, access: {}, isDefault: false, locationProof: 'expired-proof' }
    const command = { kind: 'create-home' as const, input: { ...configuration, addressId: null, newAddress, idempotencyKey: '40000000-0000-4000-8000-000000000007' } }
    await expect(replayRequestHomeCommand(actor, command, true)).resolves.toEqual({ home })
    expect(calls.map(call => call.url)).toEqual(['/api/location/renew', '/api/customer/homes'])
    expect((calls[1].body.newAddress as Record<string, unknown>).locationProof).toBe('renewed-proof')
    expect(command.input.newAddress.locationProof).toBe('expired-proof')
  })
  it('renews a selected address before retrying an uncertain versioned address save', async () => {
    const calls: { url: string; body?: Record<string, unknown> }[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input), body = options?.body ? JSON.parse(String(options.body)) as Record<string, unknown> : undefined
      calls.push({ url, body })
      if ((options?.method ?? 'GET') === 'GET') return new Response(JSON.stringify({ homes: [], addresses: [{ ...address, version: 2 }], equipment: [] }), { status: 200 })
      if (url === '/api/location/renew') return new Response(JSON.stringify({ proof: 'renewed-proof' }), { status: 200 })
      return new Response(JSON.stringify({ address: { ...address, version: 3 } }), { status: 200 })
    }))
    const command = addressCommand() as ReturnType<typeof addressCommand> & { input: ReturnType<typeof addressCommand>['input'] & { locationProof: string } }
    command.input.locationProof = 'expired-proof'
    await expect(replayRequestHomeCommand(actor, command, true)).resolves.toEqual({ address: { ...address, version: 3 } })
    expect(calls.map(call => call.url)).toEqual(['/api/customer/homes', '/api/location/renew', '/api/customer/addresses'])
    expect(calls[2].body?.locationProof).toBe('renewed-proof')
    expect(command.input.locationProof).toBe('expired-proof')
  })
  it('blocks corrupted pending location storage instead of creating a second record', () => {
    window.sessionStorage.setItem(`lysto:pedir:location:${actor}`, '{}')
    expect(readRequestHomeCommand(actor).error).toContain('No pudimos recuperar')
  })
})
