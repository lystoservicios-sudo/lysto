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

function createThenableSupabase(
  result: QueryResult,
  onSelect?: (columns: string | undefined) => void
): Parameters<typeof createSupabaseLystoRepository>[0] {
  const query = {
    eq() {
      return query
    },
    select(columns?: string) {
      onSelect?.(columns)
      return query
    },
    maybeSingle() {
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

describe('Supabase repository mappers', () => {
  it('maps snake_case profile fields', () => {
    expect(mapProfile({
      id: 'profile-1',
      auth_user_id: 'auth-1',
      role: 'customer',
      email: 'customer@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace'
    })).toEqual({
      id: 'profile-1',
      authUserId: 'auth-1',
      role: 'customer',
      email: 'customer@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace'
    })
  })

  it('rejects nullable names that contradict the generated schema', () => {
    expect(() => mapProfile({
      id: 'profile-1',
      auth_user_id: 'auth-1',
      role: 'customer',
      email: 'customer@example.com',
      first_name: null,
      last_name: null
    })).toThrow('mapProfile:first_name must be a string')
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
      selected_price_option_id: null,
      service_issue_types: { slug: 'no_enfria' }
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

  it('reads the issue slug from the generated relationship shape', () => {
    const baseRequest = {
      id: 'request-1',
      customer_id: 'customer-1',
      status: 'diagnosis_completed' as const,
      selected_price_option_id: null
    }

    expect(mapServiceRequest({
      ...baseRequest,
      service_issue_types: { slug: 'hace_ruido' }
    }).issueSlug).toBe('hace_ruido')
  })

  it('rejects a request without its required issue relationship', () => {
    expect(() => mapServiceRequest({
      id: 'request-1',
      customer_id: 'customer-1',
      status: 'diagnosis_completed',
      selected_price_option_id: null,
      service_issue_types: null
    })).toThrow('mapServiceRequest:service_issue_types must be an object')
  })

  it('rejects a nullable professional score that contradicts the generated schema', () => {
    expect(() => mapProfessional({
      id: 'professional-1',
      profile_id: 'profile-1',
      status: 'under_review',
      internal_score: null
    })).toThrow('mapProfessional:internal_score must be a number')
  })
})

describe('Supabase repository query results', () => {
  it('does not expose unsafe generic mutation methods', () => {
    const repository = createSupabaseLystoRepository(createThenableSupabase({
      data: null,
      error: null
    }))

    expect(repository).not.toHaveProperty('saveServiceRequest')
    expect(repository).not.toHaveProperty('saveJob')
    expect(repository).not.toHaveProperty('savePayment')
    expect(repository).not.toHaveProperty('saveProfessional')
  })

  it('unwraps a successful getJob result', async () => {
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

    await expect(repository.getJob('job-1')).resolves.toEqual({
      id: 'job-1',
      requestId: 'request-1',
      customerId: 'customer-1',
      professionalId: undefined,
      status: 'pending_assignment'
    })
  })

  it('reports a thenable query error with its repository context', async () => {
    const repository = createSupabaseLystoRepository(createThenableSupabase({
      data: null,
      error: { message: 'database unavailable' }
    }))

    await expect(repository.getJob('job-1')).rejects.toThrow('getJob:database unavailable')
  })

  it('returns null for a not-found getJob result', async () => {
    const repository = createSupabaseLystoRepository(createThenableSupabase({
      data: null,
      error: null
    }))

    await expect(repository.getJob('job-1')).resolves.toBeNull()
  })

  it('reads payments without selecting the private provider identifier', async () => {
    let selectedColumns: string | undefined
    const repository = createSupabaseLystoRepository(createThenableSupabase({
      data: {
        id: 'payment-1',
        request_id: 'request-1',
        provider: 'mercadopago',
        status: 'approved',
        amount: 1250
      },
      error: null
    }, (columns) => {
      selectedColumns = columns
    }))

    await expect(repository.getPayment('payment-1')).resolves.toEqual({
      id: 'payment-1',
      requestId: 'request-1',
      provider: 'mercadopago',
      providerPaymentId: undefined,
      status: 'approved',
      amount: 1250
    })
    expect(selectedColumns).toBe('id,request_id,provider,status,amount')
  })
})
