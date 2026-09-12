import { z } from 'zod'
import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { listEquipmentPhotos } from '@/lib/customer-assets/service'

export const GET = privateRoute({ roles: ['customer'] }, async (request, session) => {
  const input = z
    .object({
      equipmentId: z.string().uuid(),
      cursor: z.string().optional(),
      pageSize: z.coerce.number().optional()
    })
    .strict()
    .parse(Object.fromEntries(new URL(request.url).searchParams))
  const { equipmentId, ...page } = input
  return privateJson(await listEquipmentPhotos(session, equipmentId, page))
})
