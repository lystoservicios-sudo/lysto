import { ApiError } from '@/lib/http/api-error'
import { privateRoute } from '@/lib/http/route-handler'
import { readCustomerPaymentRecord } from '@/lib/customer-more/payments'
import { paymentRecordText } from '@/lib/customer-more/payments-model'

export const runtime = 'nodejs'
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return privateRoute({ roles: ['customer'] }, async (_request, session) => {
    const { id } = await context.params
    const checkoutId = new URL(request.url).searchParams.get('checkoutId')
    if (!checkoutId) throw new ApiError('not_found')
    const record = await readCustomerPaymentRecord(session, id, checkoutId)
    if (!record) throw new ApiError('not_found')
    return new Response(paymentRecordText(record), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="lysto-pago-${record.checkoutId}.txt"`,
        'X-Content-Type-Options': 'nosniff'
      }
    })
  })(request)
}
