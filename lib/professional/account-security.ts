import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
  confirmPassword: z.string().min(12).max(128)
}).strict().refine((input) => input.newPassword === input.confirmPassword)

export async function changeProfessionalPassword(client: Session['client'], raw: unknown) {
  const input = changePasswordSchema.parse(raw)
  const { data, error } = await client.auth.getUser()
  if (error || !data.user || data.user.app_metadata.app_role !== 'professional')
    throw new ApiError('unauthorized')
  const ready = await client.rpc('professional_password_change_ready')
  if (ready.error) throw new ApiError('service_unavailable')
  if (ready.data !== true) throw new ApiError('forbidden')
  const updated = await client.auth.updateUser({
    password: input.newPassword,
    current_password: input.currentPassword
  })
  if (updated.error) {
    if (updated.error.code === 'weak_password') throw new ApiError('invalid_input')
    throw new ApiError('unauthorized')
  }
  return { changed: true as const }
}
