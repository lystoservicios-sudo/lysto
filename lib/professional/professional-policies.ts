import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import { requiredAirConditioningTools } from './tool-checklist'

const documentType = z.enum(['identity', 'identity_front', 'identity_back', 'license', 'insurance', 'tax'])
const unique = <T extends z.ZodTypeAny>(item: T, minimum = 0) => z.array(item).min(minimum).max(20).refine(values => new Set(values).size === values.length)
const policyDraftFields = z.object({
  version: z.string().trim().min(1).max(100),
  requiredDocuments: unique(documentType, 1),
  expiryDocuments: unique(documentType),
  requiredTools: unique(z.enum(requiredAirConditioningTools)),
  minExperience: z.number().int().min(0).max(80),
  requiresLicense: z.boolean()
}).strict()
export const policyDraftSchema = policyDraftFields.refine(value => value.expiryDocuments.every(type => value.requiredDocuments.includes(type)))
const key = z.object({ categoryId: z.string().uuid(), version: z.string().trim().min(1).max(100) }).strict()
const draft = z.object({ categoryId: z.string().uuid(), policy: policyDraftSchema }).strict()
const activation = key.extend({ expectedImpact: z.number().int().nonnegative(), reason: z.string().trim().min(10).max(1000) }).strict()
const resultSchema = z.object({ categoryId: z.string().uuid(), version: z.string(), state: z.enum(['draft', 'active']), approvedProfessionalsAffected: z.number().optional(), legacyProfessionalsForManualReview: z.number().optional() }).strict()
const previewSchema = key.extend({ approvedProfessionalsAffected: z.number().int().nonnegative(), legacyProfessionalsForManualReview: z.number().int().nonnegative() }).strict()
const catalogSchema = z.array(z.object({
  categoryId: z.string().uuid(), categoryName: z.string(), activeVersion: z.string().nullable(),
  drafts: z.array(policyDraftFields.extend({ createdAt: z.string().datetime({ offset: true }) }))
}).strict())
export type ProfessionalPolicyCatalog = z.infer<typeof catalogSchema>
type RpcClient = { rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }> }
function policyRpc(session: Session, name: string, args?: Record<string, unknown>) {
  return (session.client as unknown as RpcClient).rpc(name, args)
}

function assertOperations(session: Session) {
  if (session.role !== 'admin' || session.assuranceLevel !== 'aal2' ||
    !session.permissions.some(value => value === 'owner' || value === 'operations'))
    throw new ApiError('forbidden')
}
function fail(error: { code?: string }) {
  if (error.code === '42501') throw new ApiError('forbidden')
  if (error.code === 'P0002') throw new ApiError('not_found')
  if (error.code === '40001' || error.code === '23505') throw new ApiError('conflict')
  if (error.code?.startsWith('22') || error.code === '23514') throw new ApiError('invalid_input')
  throw new ApiError('service_unavailable')
}
export async function listProfessionalPolicies(session: Session) {
  assertOperations(session)
  const result = await policyRpc(session, 'list_professional_policies')
  if (result.error) fail(result.error)
  return catalogSchema.parse(result.data)
}
export async function saveProfessionalPolicyDraft(session: Session, input: unknown) {
  assertOperations(session)
  const data = draft.parse(input)
  const result = await policyRpc(session, 'save_professional_policy_draft', {
    p_category_id: data.categoryId, p_policy: data.policy
  })
  if (result.error) fail(result.error)
  return resultSchema.parse(result.data)
}
export async function previewProfessionalPolicyActivation(session: Session, input: unknown) {
  assertOperations(session)
  const data = key.parse(input)
  const result = await policyRpc(session, 'preview_professional_policy_activation', {
    p_category_id: data.categoryId, p_version: data.version
  })
  if (result.error) fail(result.error)
  return previewSchema.parse(result.data)
}
export async function activateProfessionalPolicy(session: Session, input: unknown) {
  assertOperations(session)
  const data = activation.parse(input)
  const result = await policyRpc(session, 'activate_professional_policy', {
    p_category_id: data.categoryId, p_version: data.version,
    p_expected_impact: data.expectedImpact, p_reason: data.reason
  })
  if (result.error) fail(result.error)
  return resultSchema.parse(result.data)
}
