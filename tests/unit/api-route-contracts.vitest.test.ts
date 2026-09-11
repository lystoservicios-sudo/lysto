import { describe, expect, it, vi } from 'vitest'

import { POST as assignProfessional } from '../../app/api/admin/assign-professional/route'
import { POST as respondToRequest } from '../../app/api/professional/respond-request/route'
import { POST as openQualityCase } from '../../app/api/quality/open-case/route'

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
}

describe('retired admin assignment route', () => {
  it.each([{ paid: true }, { paid: false }, { paid: 'true' }, { override: true, adminProfileId: 'forged' }])('never assigns from caller supplied authorization', async payload => {
    const response = await assignProfessional(jsonRequest('/api/admin/assign-professional', payload))
    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({ error: 'endpoint_retired', replacement: '/api/pricing/offers' })
  })
})

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) }))
describe('closed prototype mutation routes', () => {
  it.each([
    ['/api/quality/open-case', openQualityCase, { jobId: 'job-1', reason: 'poor repair', description: 'the issue remains' }],
    ['/api/professional/respond-request', respondToRequest, { actorProfessionalId: 'pro_001', assignedProfessionalId: 'pro_001', response: 'accepted' }],
    ['/api/professional/respond-request', respondToRequest, { actorProfessionalId: 'forged', assignedProfessionalId: 'forged', response: 'rejected' }]
  ] as const)('requires a verified identity for %s instead of trusting actor fields', async (path, handler, body) => {
    const response = await handler(jsonRequest(path, body))
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'unauthorized' })
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
})
