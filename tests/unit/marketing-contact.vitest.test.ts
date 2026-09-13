import { describe, expect, it, vi } from 'vitest'
import { submitContactInquiry } from '@/lib/marketing/contact'

const valid = { name: 'Lucía Pérez', email: 'LUCIA@example.com ', phone: '', subject: 'servicio', message: 'Quisiera consultar por mantenimiento de mi aire.', consent: true, website: '' }
describe('contact inquiries', () => {
  it('validates required information before persisting', async () => {
    const save = vi.fn()
    const result = await submitContactInquiry({ ...valid, email: 'invalido', consent: false }, save)
    expect(result.ok).toBe(false)
    expect(save).not.toHaveBeenCalled()
  })
  it('normalizes email and only confirms after storage succeeds', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true })
    const result = await submitContactInquiry(valid, save)
    expect(result.ok).toBe(true)
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ email: 'lucia@example.com', name: 'Lucía Pérez' }))
  })
  it('does not claim success when persistence is unavailable', async () => {
    const result = await submitContactInquiry(valid, async () => { throw new Error('private database error') })
    expect(result).toEqual(expect.objectContaining({ ok: false, status: 503 }))
    expect(JSON.stringify(result)).not.toContain('private database')
  })
  it('silently discards the honeypot without persisting spam', async () => {
    const save = vi.fn()
    expect((await submitContactInquiry({ ...valid, website: 'spam.example' }, save)).ok).toBe(true)
    expect(save).not.toHaveBeenCalled()
  })
  it('returns a useful message when too many messages have been sent', async () => {
    const result = await submitContactInquiry(valid, async () => ({ ok: false, reason: 'rate_limit' }))
    expect(result).toEqual(expect.objectContaining({ ok: false, status: 429 }))
  })
})
