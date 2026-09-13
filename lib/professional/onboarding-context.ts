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
export async function ownOnboardingContext() {
  const client = await onboardingIdentity()
  const review = await readProfessionalReview(client)
  return {
    ...review,
    catalog: await professionalCatalog(client),
    legal: await getRegistrationPolicy()
  }
}
export type OnboardingContext = Awaited<ReturnType<typeof ownOnboardingContext>>
