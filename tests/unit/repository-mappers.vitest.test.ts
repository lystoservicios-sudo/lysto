import { describe, expect, it } from 'vitest'
import {
  createSupabaseLystoRepository,
  mapJob,
  mapPayment,
  mapProfessional,
  mapProfile,
  mapServiceRequest
} from '../../lib/data-access/supabase/repository.ts'

type QueryResult = { data: unknown; error: { message: string } | null }

function createThenableSupabase(result: QueryResult): Parameters<typeof createSupabaseLystoRepository>[0] {
  const query = {
    upsert() {
      return query
    },
    select() {
      return query
    },
    single() {
      return query
    },
    then<TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return Promise.resolve(result).then(onfulfilled, onrejected)
    }
  }

  return { from: () => query } as unknown as Parameters<typeof createSupabaseLystoRepository>[0]
}

const jobRecord = {
  id: 'job-1',
  requestId: 'request-1',
  customerId: 'customer-1',
  status: 'pending_assignment' as const
}

describe('Supabase repository mappers', () => {
  it('maps snake_case profile fields and nullable names', () => {
    expect(mapProfile({
      id: 'profile-1',
      auth_user_id: 'auth-1',
      role: 'customer',
      email: 'customer@example.com',
      first_name: null,
      last_name: null
    })).toEqual({
      id: 'profile-1',
      authUserId: 'auth-1',
      role: 'customer',
      email: 'customer@example.com',
      firstName: '',
      lastName: ''
    })
  })

  it('rejects a profile without an auth user id', () => {
    expect(() => mapProfile({
      id: 'profile-1',
      auth_user_id: null,
      role: 'customer',
      email: 'customer@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace'
    })).toThrow('mapProfile:auth_user_id must be a string')
  })

  it('maps nullable repository fields to undefined', () => {
    expect(mapServiceRequest({
      id: 'request-1',
      customer_id: 'customer-1',
      status: 'draft',
      issue_slug: 'no_enfria',
      selected_price_option_id: null,
      service_issue_types: null
    })).toEqual({
      id: 'request-1',
      customerId: 'customer-1',
      status: 'draft',
      issueSlug: 'no_enfria',
      selectedPriceOptionId: undefined
    })

    expect(mapJob({
      id: 'job-1',
      request_id: 'request-1',
      customer_id: 'customer-1',
      professional_id: null,
      status: 'pending_assignment'
    })).toEqual({
      id: 'job-1',
      requestId: 'request-1',
      customerId: 'customer-1',
      professionalId: undefined,
      status: 'pending_assignment'
    })

    expect(mapPayment({
      id: 'payment-1',
      request_id: 'request-1',
      provider: 'mercadopago',
      provider_payment_id: null,
      status: 'pending',
      amount: 1250
    })).toEqual({
      id: 'payment-1',
      requestId: 'request-1',
      provider: 'mercadopago',
      providerPaymentId: undefined,
      status: 'pending',
      amount: 1250
    })
  })

  it.each([
    ['1250.50', 1250.5],
    [1250.5, 1250.5]
  ])('maps payment amount %p to a number', (amount, expected) => {
    expect(mapPayment({
      id: 'payment-1',
      request_id: 'request-1',
      provider: 'mercadopago',
      provider_payment_id: 'mp-1',
      status: 'approved',
      amount
    }).amount).toBe(expected)
  })

  it('rejects a payment without a request id', () => {
    expect(() => mapPayment({
      id: 'payment-1',
      request_id: null,
      provider: 'mercadopago',
      provider_payment_id: null,
      status: 'pending',
      amount: 1250
    })).toThrow('mapPayment:request_id must be a string')
  })

  it('prefers a direct issue slug and falls back to the related issue', () => {
    const baseRequest = {
      id: 'request-1',
      customer_id: 'customer-1',
      status: 'diagnosis_completed' as const,
      selected_price_option_id: null
    }

    expect(mapServiceRequest({
      ...baseRequest,
      issue_slug: 'no_enfria',
      service_issue_types: { slug: 'hace_ruido' }
    }).issueSlug).toBe('no_enfria')

    expect(mapServiceRequest({
      ...baseRequest,
      issue_slug: null,
      service_issue_types: { slug: 'hace_ruido' }
    }).issueSlug).toBe('hace_ruido')
  })

  it('maps a nullable professional score to zero', () => {
    expect(mapProfessional({
      id: 'professional-1',
      profile_id: 'profile-1',
      status: 'under_review',
      internal_score: null
    })).toEqual({
      id: 'professional-1',
      profileId: 'profile-1',
      status: 'under_review',
      score: 0
    })
  })
})

describe('Supabase repository query results', () => {
  it('unwraps a successful thenable result', async () => {
    const repository = createSupabaseLystoRepository(createThenableSupabase({
      data: {
        id: 'job-1',
        request_id: 'request-1',
        customer_id: 'customer-1',
        professional_id: null,
        status: 'pending_assignment'
      },
      error: null
    }))

    await expect(repository.saveJob(jobRecord)).resolves.toEqual(jobRecord)
  })

  it('reports a thenable query error with its repository context', async () => {
    const repository = createSupabaseLystoRepository(createThenableSupabase({
      data: null,
      error: { message: 'database unavailable' }
    }))

    await expect(repository.saveJob(jobRecord)).rejects.toThrow('saveJob:database unavailable')
  })

  it('reports a not-found thenable result with its repository context', async () => {
    const repository = createSupabaseLystoRepository(createThenableSupabase({
      data: null,
      error: null
    }))

    await expect(repository.saveJob(jobRecord)).rejects.toThrow('saveJob:not_found')
  })
})
