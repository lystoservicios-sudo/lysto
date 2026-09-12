import { describe, expect, it, vi } from 'vitest'

import { POST as assignProfessional } from '../../app/api/admin/assign-professional/route'
import { POST as approveProfessional } from '../../app/api/admin/approve-professional/route'
import { POST as pricingUpdate } from '../../app/api/admin/pricing/update/route'
import { POST as advanceJob } from '../../app/api/jobs/advance/route'
import { POST as updateJob } from '../../app/api/jobs/update-status/route'
import { POST as proJobAction } from '../../app/api/pro/jobs/action/route'
import { POST as evaluateOnboarding } from '../../app/api/pro/onboarding/evaluate/route'
import { POST as respondToRequest } from '../../app/api/professional/respond-request/route'
import { POST as applyWebhook } from '../../app/api/payments/webhook/apply/route'
import { POST as previewRequest } from '../../app/api/service-request/preview/route'

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
}

describe('retired admin assignment route', () => {
  it.each([
    { paid: true },
    { paid: false },
    { paid: 'true' },
    { override: true, adminProfileId: 'forged' }
  ])('never assigns from caller supplied authorization', async (payload) => {
    const response = await assignProfessional(
      jsonRequest('/api/admin/assign-professional', payload)
    )
    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({
      error: 'endpoint_retired',
      replacement: '/api/pricing/offers'
    })
  })
})

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) }
  })
}))
describe('all duplicate or unsafe legacy mutations are explicitly retired', () => {
  it.each([
    ['/api/admin/approve-professional', approveProfessional, '/api/admin/professionals/approve'],
    ['/api/admin/assign-professional', assignProfessional, '/api/pricing/offers'],
    ['/api/admin/pricing/update', pricingUpdate, '/api/pricing/policy'],
    ['/api/jobs/advance', advanceJob, '/api/pricing/job/status'],
    ['/api/jobs/update-status', updateJob, '/api/pricing/job/status'],
    ['/api/pro/jobs/action', proJobAction, '/api/pricing/job/status'],
    ['/api/pro/onboarding/evaluate', evaluateOnboarding, '/api/admin/professionals/review'],
    ['/api/professional/respond-request', respondToRequest, '/api/pricing/offers'],
    ['/api/payments/webhook/apply', applyWebhook, '/api/mercadopago/webhook'],
    ['/api/service-request/preview', previewRequest, '/api/pricing/quote']
  ] as const)(
    'returns 410 for %s without considering caller fields',
    async (path, handler, replacement) => {
      const body = {
        actorProfessionalId: 'forged',
        paid: true,
        status: 'approved',
        adminProfileId: 'forged'
      }
      const response = await handler(jsonRequest(path, body))
      expect(response.status).toBe(410)
      expect(await response.json()).toEqual({ error: 'endpoint_retired', replacement })
      expect(response.headers.get('cache-control')).toContain('no-store')
    }
  )
})
