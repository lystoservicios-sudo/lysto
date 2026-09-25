import { apiErrorResponse, privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { saveProfessionalAddress } from '@/lib/professional/onboarding-service'

export async function POST(request: Request) {
  try { return privateJson(await saveProfessionalAddress(await readPrivateJsonBody(request))) }
  catch (error) { return apiErrorResponse(error) }
}
