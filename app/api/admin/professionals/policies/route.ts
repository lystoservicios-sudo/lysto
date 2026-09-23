import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import {
  activateProfessionalPolicy, listProfessionalPolicies,
  previewProfessionalPolicyActivation, saveProfessionalPolicyDraft
} from '@/lib/professional/professional-policies'

export const GET = privateRoute({ roles: ['admin'], permission: 'operations' }, async (_request, session) =>
  privateJson(await listProfessionalPolicies(session)))

export const POST = privateRoute({ roles: ['admin'], permission: 'operations' }, async (request, session) => {
  const body = await readPrivateJsonBody(request)
  if (!body || typeof body !== 'object' || !('action' in body))
    return privateJson({ error: 'Acción desconocida.' }, { status: 400 })
  const { action, ...input } = body
  if (action === 'draft') return privateJson(await saveProfessionalPolicyDraft(session, input), { status: 201 })
  if (action === 'preview') return privateJson(await previewProfessionalPolicyActivation(session, input))
  if (action === 'activate') return privateJson(await activateProfessionalPolicy(session, input))
  return privateJson({ error: 'Acción desconocida.' }, { status: 400 })
})
