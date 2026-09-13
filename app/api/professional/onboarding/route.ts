import { apiErrorResponse, privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import {
  readProfessionalOnboarding,
  saveProfessionalOnboarding,
  onboardingIdentity
} from '@/lib/professional/onboarding-service'

export async function GET() {
  try {
    return privateJson(await readProfessionalOnboarding())
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    await onboardingIdentity()
    return privateJson(await saveProfessionalOnboarding(await readPrivateJsonBody(request)))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
