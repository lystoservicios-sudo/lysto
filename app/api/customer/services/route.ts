import { z } from 'zod'
import { loadCustomerServices } from '@/lib/customer/services-model'
import { privateJson } from '@/lib/http/api-error'
import { privateRoute } from '@/lib/http/route-handler'

const querySchema = z.object({
  filter: z.enum(['all', 'in_progress', 'scheduled', 'finished']).optional(),
  serviceCursor: z.string().min(1).max(1024).optional(),
  quoteCursor: z.string().min(1).max(1024).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  source: z.enum(['services', 'quotes']).optional()
}).strict()

export const GET = privateRoute({ roles: ['customer'] }, async (request, session) => {
  const input = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams))
  return privateJson(await loadCustomerServices(session, input))
})
