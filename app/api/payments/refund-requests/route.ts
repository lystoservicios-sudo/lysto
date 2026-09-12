import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { listFinancialExceptions, mutateFinance } from '@/lib/payments/financial-operations'

export const GET = privateRoute({ roles: ['admin'] }, async (_request, session) =>
  privateJson(await listFinancialExceptions(session))
)
export const POST = privateRoute(
  { roles: ['admin'], permission: 'finance' },
  async (request, session) =>
    privateJson(await mutateFinance(session, await readPrivateJsonBody(request)))
)
