import { z } from 'zod'
import { privateRoute } from '@/lib/http/route-handler'
import { ApiError, privateJson } from '@/lib/http/api-error'
import { readCustomerPaymentResult } from '@/lib/customer-more/payments'

export const runtime = 'nodejs'
export const GET = privateRoute({ roles: ['customer'] }, async (request, session) => {
  const checkoutId = z.string().uuid().parse(new URL(request.url).searchParams.get('checkoutId'))
  const result = await readCustomerPaymentResult(session, checkoutId)
  if (!result) throw new ApiError('not_found')
  return privateJson(result)
})
