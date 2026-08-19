import { describe, expect, it } from 'vitest'

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

describe('admin assignment route', () => {
  it('rejects a string paid flag instead of coercing it', async () => {
    const response = await assignProfessional(jsonRequest('/api/admin/assign-professional', {
      requestId: 'request-1',
      paid: 'true',
      override: false
    }))

    expect(response.status).toBe(400)
  })

  it('ignores a selected professional during automatic assignment', async () => {
    const response = await assignProfessional(jsonRequest('/api/admin/assign-professional', {
      requestId: 'request-1',
      paid: true,
      selectedProfessionalId: 'pro_003'
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.assignedProfessionalId).toBe('pro_001')
    expect(body.ranking).toBeInstanceOf(Array)
  })

  it.each([
    { adminProfileId: 'admin-1' },
    { selectedProfessionalId: 'pro_003' }
  ])('requires both admin and selected professional for manual assignment', async (manualFields) => {
    const response = await assignProfessional(jsonRequest('/api/admin/assign-professional', {
      requestId: 'request-1',
      paid: true,
      override: true,
      ...manualFields
    }))

    expect(response.status).toBe(400)
  })

  it('uses errors and ranking for domain failures', async () => {
    const response = await assignProfessional(jsonRequest('/api/admin/assign-professional', {
      requestId: 'request-1',
      paid: false,
      override: false
    }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.errors).toContain('payment_approved_required')
    expect(body.ranking).toBeInstanceOf(Array)
    expect(body.details).toBeUndefined()
  })
})

describe('quality case route', () => {
  it('rejects a quality case whose reason and description are empty', async () => {
    const response = await openQualityCase(jsonRequest('/api/quality/open-case', {
      jobId: 'job-1',
      reason: '   ',
      description: '  '
    }))

    expect(response.status).toBe(400)
  })

  it('combines trimmed reason and description for classification', async () => {
    const response = await openQualityCase(jsonRequest('/api/quality/open-case', {
      jobId: '  job-1  ',
      reason: 'poor repair',
      description: '  the issue remains  '
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.classification).toMatchObject({
      status: 'open',
      severity: 'medium',
      slaMinutes: 120,
      tags: ['quality']
    })
  })
})

describe('professional response route', () => {
  it('rejects whitespace-only professional identifiers', async () => {
    const response = await respondToRequest(jsonRequest('/api/professional/respond-request', {
      actorProfessionalId: '   ',
      assignedProfessionalId: '   ',
      response: 'accepted'
    }))

    expect(response.status).toBe(400)
  })

  it('maps accepted to the domain response and returns next statuses', async () => {
    const response = await respondToRequest(jsonRequest('/api/professional/respond-request', {
      actorProfessionalId: '  pro_001 ',
      assignedProfessionalId: 'pro_001',
      response: 'accepted'
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      accepted: true,
      nextRequestStatus: 'assigned',
      nextJobStatus: 'confirmed'
    })
  })

  it('uses errors for domain rejection failures', async () => {
    const response = await respondToRequest(jsonRequest('/api/professional/respond-request', {
      actorProfessionalId: 'pro_001',
      assignedProfessionalId: 'pro_001',
      response: 'rejected',
      rejectionReason: '   '
    }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.errors).toContain('reject_reason_required')
    expect(body.details).toBeUndefined()
  })
})
