// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { uploadPrivateFile } from '@/lib/uploads/client'
const { upload } = vi.hoisted(() => ({ upload: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: upload }) } }) }))
const intentId = '75000000-0000-4000-8000-000000000001'
const draftId = '75000000-0000-4000-8000-000000000002'
const handle = { intentId, draftId, bucket: 'upload-quarantine', path: `${draftId}/${intentId}`, token: 'a-private-upload-token' }
const file = new File(['image bytes'], '../../cliente.jpg', { type: 'image/jpeg' })
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })
describe('private upload acknowledgement and retries', () => {
  it('sends the hash without a filename and waits for server verification', async () => {
    const requests = vi.fn().mockResolvedValueOnce(json(handle)).mockResolvedValueOnce(json({ id: intentId, status: 'verified', attachmentId: intentId, draftId, entityId: null }))
    vi.stubGlobal('fetch', requests); upload.mockResolvedValue({ error: null })
    const saved = vi.fn()
    const result = await uploadPrivateFile(file, { kind: 'request-photo' }, saved)
    expect(result.attachmentId).toBe(intentId)
    expect(saved).toHaveBeenCalledWith(handle)
    const declaration = JSON.parse(requests.mock.calls[0][1].body)
    expect(declaration.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(declaration.filename).toBeUndefined()
    expect(declaration.ownerId).toBeUndefined()
    expect(requests.mock.calls[1][0]).toBe('/api/uploads/finalize')
  })
  it('does not announce success when inspection fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(handle)).mockResolvedValueOnce(json({ error: 'Contenido inválido' }, 400)))
    upload.mockResolvedValue({ error: null })
    await expect(uploadPrivateFile(file, { kind: 'request-photo' })).rejects.toThrow()
  })
  it('reuses a saved intent after an upload response was lost', async () => {
    const requests = vi.fn().mockResolvedValueOnce(json({ id: intentId, status: 'verified', attachmentId: intentId, draftId, entityId: null }))
    vi.stubGlobal('fetch', requests); upload.mockResolvedValue({ error: { statusCode: '409' } })
    const result = await uploadPrivateFile(file, { kind: 'request-photo' }, undefined, handle)
    expect(result.attachmentId).toBe(intentId)
    expect(requests).toHaveBeenCalledTimes(1)
    expect(requests.mock.calls[0][0]).toBe('/api/uploads/finalize')
  })
  it('rejects PDFs before calling the network', async () => {
    const requests = vi.fn(); vi.stubGlobal('fetch', requests)
    await expect(uploadPrivateFile(new File(['pdf'], 'document.pdf', { type: 'application/pdf' }), { kind: 'professional-document', entityId: intentId })).rejects.toThrow()
    expect(requests).not.toHaveBeenCalled()
  })
  it('clears an expired handle so the next retry can create a fresh intent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ code: 'upload_expired' },410)))
    upload.mockResolvedValue({ error: { statusCode: '409' } })
    const saved = vi.fn()
    await expect(uploadPrivateFile(file, { kind: 'request-photo' }, saved, handle)).rejects.toThrow()
    expect(saved).toHaveBeenCalledWith(null)
  })
})
