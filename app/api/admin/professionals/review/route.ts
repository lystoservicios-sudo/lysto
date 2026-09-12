import { z } from 'zod'
import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import {
  decideProfessionalApplication,
  readProfessionalReview
} from '@/lib/professional/onboarding-service'
export const GET = privateRoute(
  { roles: ['admin'], permission: 'operations' },
  async (request, session) => {
    const input = z
      .object({ professionalId: z.string().uuid() })
      .strict()
      .parse(Object.fromEntries(new URL(request.url).searchParams))
    return privateJson(await readProfessionalReview(session.client, input.professionalId))
  }
)
export const POST = privateRoute(
  { roles: ['admin'], permission: 'operations' },
  async (request, session) =>
    privateJson(await decideProfessionalApplication(session, await readPrivateJsonBody(request)))
)
