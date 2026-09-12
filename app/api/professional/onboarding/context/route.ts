import { apiErrorResponse, privateJson } from '@/lib/http/api-error'
import { ownOnboardingContext } from '@/lib/professional/onboarding-context'
export async function GET() {
  try {
    return privateJson(await ownOnboardingContext())
  } catch (error) {
    return apiErrorResponse(error)
  }
}
