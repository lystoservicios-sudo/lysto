import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), review: vi.fn(), catalog: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ requirePageSession: mocks.session }))
vi.mock('@/lib/professional/onboarding-service', () => ({ readProfessionalReview: mocks.review }))
vi.mock('@/lib/professional/onboarding-context', () => ({ professionalCatalog: mocks.catalog }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  }
}))
import Page from '@/app/(admin)/admin/profesionales/[id]/page'
const id = '96000000-0000-4000-8000-000000000001'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue({ permissions: ['operations'], client: {} })
  mocks.catalog.mockResolvedValue({ categories: [], zones: [] })
  mocks.review.mockResolvedValue({ application: { professionalId: id, status: 'under_review' } })
})
describe('actual professional review route', () => {
  it('uses the requested persistent dossier and current operations session', async () => {
    const result = await Page({ params: Promise.resolve({ id }) })
    expect(mocks.review).toHaveBeenCalledWith({}, id)
    expect(result.props.initial.application.professionalId).toBe(id)
  })
  it('denies finance before reading a dossier', async () => {
    mocks.session.mockResolvedValue({ permissions: ['finance'], client: {} })
    await expect(Page({ params: Promise.resolve({ id }) })).rejects.toThrow('NOT_FOUND')
    expect(mocks.review).not.toHaveBeenCalled()
  })
  it('rejects demo and malformed identifiers before reading records', async () => {
    await expect(Page({ params: Promise.resolve({ id: 'pro_002' }) })).rejects.toThrow('NOT_FOUND')
    expect(mocks.review).not.toHaveBeenCalled()
  })
})
