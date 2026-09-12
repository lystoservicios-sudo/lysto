import { z } from 'zod'
import { privateRoute } from '@/lib/http/route-handler'
import { ApiError, privateJson } from '@/lib/http/api-error'

const schema = z
  .object({ professionalId: z.string().uuid(), reason: z.string().trim().min(10).max(1000) })
  .strict()

export const POST = privateRoute(
  { roles: ['admin'], permission: 'operations' },
  async (request, session) => {
    const input = schema.parse(await request.json())
    const { data, error } = await session.client.rpc('suspend_professional', {
      p_professional_id: input.professionalId,
      p_reason: input.reason
    })
    if (error) {
      if (error.code === '42501') throw new ApiError('forbidden')
      if (error.code === 'P0002') throw new ApiError('not_found')
      if (error.code === '22023') throw new ApiError('invalid_input')
      throw new ApiError('service_unavailable')
    }
    return privateJson(data)
  }
)
