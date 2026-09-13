import { z } from 'zod'
import { privateRoute } from '@/lib/http/route-handler'
import { ApiError, privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { authOrigin } from '@/lib/auth/account-lifecycle'

const inputSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict()
export const POST = privateRoute({ roles: ['customer'] }, async (request, session) => {
  const input = inputSchema.parse(await readPrivateJsonBody(request))
  const { error } = await session.client.auth.updateUser(
    { email: input.email },
    {
      emailRedirectTo: `${authOrigin(process.env.NEXT_PUBLIC_APP_URL)}/auth/change-email`
    }
  )
  if (
    error &&
    !['email_exists', 'user_already_exists', 'over_email_send_rate_limit'].includes(
      error.code ?? ''
    )
  )
    throw new ApiError('service_unavailable')
  return privateJson(
    {
      message:
        'Si el cambio puede realizarse, recibirás un enlace en el correo actual y otro en el nuevo. Confirmá ambos para completar el cambio.'
    },
    { status: 202 }
  )
})
