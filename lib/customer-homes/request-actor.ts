import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'

/** A precondition for stale tabs/replays, never an alternative source of ownership. */
export function assertCustomerHomeRequestActor(request: Request, session: Session) {
  const expected = request.headers.get('X-Lysto-Customer-Id')
  if (!z.string().uuid().safeParse(expected).success || expected !== session.customerId)
    throw new ApiError('forbidden')
}
