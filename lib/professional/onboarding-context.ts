import 'server-only'
import { z } from 'zod'
import { ApiError } from '@/lib/http/api-error'
import { getRegistrationPolicy } from '@/lib/auth/account-policy'
import { onboardingIdentity, readProfessionalReview } from './onboarding-service'
import type { Session } from '@/lib/auth/session'

const catalogSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().optional()
})
export async function professionalCatalog(client: Session['client']) {
  const [categories, zones] = await Promise.all([
    client
      .from('service_categories')
      .select('id,name,slug')
      .eq('active', true)
      .order('name')
      .limit(500),
    client.from('service_zones').select('id,name').eq('active', true).order('name').limit(500)
  ])
  if (categories.error || zones.error) throw new ApiError('service_unavailable')
  return {
    categories: z.array(catalogSchema).parse(categories.data),
    zones: z.array(catalogSchema).parse(zones.data)
  }
}
type RegistrationContext = Awaited<ReturnType<typeof readProfessionalReview>> & {
  catalog: Awaited<ReturnType<typeof professionalCatalog>>
  legal: Awaited<ReturnType<typeof getRegistrationPolicy>>
  canChangePassword?: boolean
}

export async function ownOnboardingContext(): Promise<RegistrationContext> {
  const client = await onboardingIdentity()
  const review = await readProfessionalReview(client)
  let canChangePassword = false
  try {
    const permission = await client.rpc('professional_password_change_ready')
    canChangePassword = !permission.error && permission.data === true
  } catch {
    // An optional account action must never be authorized from an unavailable check.
  }
  return {
    ...review,
    canChangePassword,
    catalog: await professionalCatalog(client),
    legal: await getRegistrationPolicy()
  }
}
export type OnboardingContext = Awaited<ReturnType<typeof ownOnboardingContext>>
