import { calculatePreliminaryDiagnosis } from '@/lib/diagnosis/preliminary'
import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'

export const POST = privateRoute({ roles: ['customer', 'admin'] }, async (request) => {
  return privateJson(calculatePreliminaryDiagnosis(await readPrivateJsonBody(request, 4096)))
})
