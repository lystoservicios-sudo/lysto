import { ApiError, privateJson } from '@/lib/http/api-error'
import { isAllowedAuthOrigin } from '@/lib/auth/account-lifecycle'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { createAdminCharge, listAdminPaymentContext } from '@/lib/payments/admin-charges'

export const GET = privateRoute({ roles: ['admin'] }, async (request, session) => {
  const query = new URL(request.url).searchParams
  return privateJson(await listAdminPaymentContext(session, {
    search: query.get('search') ?? undefined,
    jobIds: query.get('jobIds')?.split(',').filter(Boolean)
  }))
})

export const POST = privateRoute({ roles: ['admin'], permission: 'finance' }, async (request, session) => {
  if (!isAllowedAuthOrigin(request.headers.get('origin'), process.env.NEXT_PUBLIC_APP_URL))
    throw new ApiError('forbidden')
  return privateJson(await createAdminCharge(session, await readPrivateJsonBody(request)))
})
