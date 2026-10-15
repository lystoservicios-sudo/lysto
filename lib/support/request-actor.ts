import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
/** Stale-tab precondition only. Authority always comes from the fresh session. */
export function assertSupportRequestActor(request: Request, session: Session) {
  const expected = request.headers.get('X-Lysto-Customer-Id')
  if (session.role !== 'customer' && expected === null) return
  if (session.role !== 'customer' || !z.string().uuid().safeParse(expected).success || expected !== session.customerId) throw new ApiError('forbidden')
}
