import { z } from 'zod'

/** Optional for legacy consumers; focused customer flows always send this precondition.
 * Ownership still comes exclusively from the authenticated session and database.
 */
export function assertPaymentCustomerRequestActor(
  request: Request,
  actor: { role: string; customerId?: string | null }
) {
  const expected = request.headers.get('X-Lysto-Customer-Id')
  if (expected === null) return
  if (
    actor.role !== 'customer' ||
    !z.string().uuid().safeParse(expected).success ||
    expected !== actor.customerId
  ) throw new Error('payment_forbidden')
}
