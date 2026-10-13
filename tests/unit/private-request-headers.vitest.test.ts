import { afterEach, describe, expect, it, vi } from 'vitest'
import { privateRequest } from '@/lib/http/private-client'

afterEach(() => vi.unstubAllGlobals())
const success = () => new Response(JSON.stringify({ saved: true }), { status: 200 })

describe('private request additional precondition headers', () => {
  it('retains the existing request behavior when no additional headers are supplied', async () => {
    const fetch = vi.fn().mockResolvedValue(success())
    vi.stubGlobal('fetch', fetch)
    expect(await privateRequest('/api/legacy', 'PUT', { name: 'Unchanged' })).toEqual({ saved: true })
    expect(fetch).toHaveBeenCalledWith('/api/legacy', expect.objectContaining({ method: 'PUT', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Unchanged' }) }))
  })
  it('sends the explicit expected actor with a GET without inventing a body', async () => {
    const fetch = vi.fn().mockResolvedValue(success())
    vi.stubGlobal('fetch', fetch)
    await privateRequest('/api/customer/homes', 'GET', undefined, { 'X-Lysto-Customer-Id': '00000000-0000-4000-8000-000000000002' })
    expect(fetch).toHaveBeenCalledWith('/api/customer/homes', expect.objectContaining({ method: 'GET', headers: { 'Content-Type': 'application/json', 'X-Lysto-Customer-Id': '00000000-0000-4000-8000-000000000002' }, body: undefined }))
  })
  it('preserves transaction errors and the exact body while including actor preconditions', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'forbidden' }), { status: 403 }))
    vi.stubGlobal('fetch', fetch)
    const body = { idempotencyKey: 'original', newAddress: { street: 'Original' } }
    await expect(privateRequest('/api/customer/homes', 'POST', body, { 'X-Lysto-Customer-Id': 'account-a' })).rejects.toMatchObject({ status: 403, code: 'forbidden' })
    expect(fetch).toHaveBeenCalledWith('/api/customer/homes', expect.objectContaining({ body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', 'X-Lysto-Customer-Id': 'account-a' } }))
  })
})
