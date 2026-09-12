import { apiErrorResponse, privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import {
  submitProfessionalApplication,
  onboardingIdentity
} from '@/lib/professional/onboarding-service'
export async function POST(request: Request) {
  try {
    await onboardingIdentity()
    return privateJson(await submitProfessionalApplication(await readPrivateJsonBody(request)))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
