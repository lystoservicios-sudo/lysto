import 'server-only'
import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { isAllowedAuthOrigin } from '@/lib/auth/account-lifecycle'
import { ApiError } from '@/lib/http/api-error'
import { assertPublicSupabaseEnv } from '@/lib/supabase/env'
import { inspectUpload, UploadInspectionError } from './inspection'
import { validateUpload } from './validation'

export const uploadDeclaration = z.object({
  kind: z.enum(['request-photo','professional-document','job-photo','job-document']),
  mimeType: z.enum(['image/jpeg','image/png','image/webp']), sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), entityId: z.string().uuid().optional(), draftId: z.string().uuid().optional(),
  phase: z.enum(['before','during','after','document']).optional(), documentType: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/).optional()
}).strict()
export const uploadReference = z.object({ intentId: z.string().uuid() }).strict()
const intentSchema = z.object({
  id: z.string().uuid(), status: z.enum(['pending','verified','cleaning','cleaned']), kind: uploadDeclaration.shape.kind,
  ownerProfileId: z.string().uuid(), entityId: z.string().uuid().nullable(), draftId: z.string().uuid().nullable(),
  expectedMimeType: uploadDeclaration.shape.mimeType, expectedSizeBytes: z.number().int().positive().max(20 * 1024 * 1024), expectedSha256: uploadDeclaration.shape.sha256,
  quarantineBucket: z.literal('upload-quarantine'), quarantinePath: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/),
  outputBucket: z.enum(['request-media','professional-documents','job-evidence']), outputPath: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/(?:photo\/|before\/|during\/|after\/|document\/)?[a-f0-9-]{36}\.(?:jpg|webp)$/),
  outputMimeType: z.enum(['image/jpeg','image/webp']), expiresAt: z.string().refine(value => Number.isFinite(Date.parse(value))),
  attachmentId: z.string().uuid().nullable()
})
type Intent = z.infer<typeof intentSchema>
// Runtime-validated RPC boundary while migrations own the JSON result shape.
type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }> }
async function rpc(client: RpcClient, name: string, args: Record<string, unknown>): Promise<Intent> {
  const result = await client.rpc(name, args)
  if (result.error) {
    if (result.error.code === '42501') throw new ApiError('not_found')
    if (['22023','22P02','23514'].includes(result.error.code ?? '')) throw new ApiError('invalid_input')
    throw new ApiError('service_unavailable')
  }
  const parsed = intentSchema.safeParse(result.data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  return parsed.data
}
function serviceStorage(): SupabaseClient {
  const env = assertPublicSupabaseEnv()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new ApiError('service_unavailable')
  return createClient(env.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([AbortSignal.timeout(30_000), ...(init?.signal ? [init.signal] : [])]) }) }
  })
}
export async function readUploadBody(request: Request): Promise<unknown> {
  if (!isAllowedAuthOrigin(request.headers.get('origin'), process.env.NEXT_PUBLIC_APP_URL)) throw new ApiError('forbidden')
  if (!request.headers.get('content-type')?.split(';')[0].trim().match(/^application\/json$/i)) throw new ApiError('invalid_input')
  const reader = request.body?.getReader()
  if (!reader) throw new ApiError('invalid_input')
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 4096) { await reader.cancel(); throw new ApiError('invalid_input') }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
export async function signUpload(session: Session, body: unknown) {
  const input = uploadDeclaration.parse(body)
  if (!validateUpload({ kind: input.kind, mimeType: input.mimeType, sizeBytes: input.sizeBytes }).valid) throw new ApiError('invalid_input')
  const intent = await rpc(session.client, 'create_upload_intent', {
    p_kind: input.kind, p_mime_type: input.mimeType, p_size_bytes: input.sizeBytes, p_sha256: input.sha256,
    p_entity_id: input.entityId ?? null, p_draft_id: input.draftId ?? null, p_phase: input.phase ?? null, p_document_type: input.documentType ?? null
  })
  const { data, error } = await session.client.storage.from(intent.quarantineBucket).createSignedUploadUrl(intent.quarantinePath, { upsert: false })
  if (error || !data) throw new ApiError('service_unavailable')
  return { intentId: intent.id, draftId: intent.draftId, bucket: intent.quarantineBucket, path: data.path, token: data.token, finalizeBefore: intent.expiresAt }
}
function receipt(intent: Intent) {
  if (intent.status !== 'verified' || !intent.attachmentId) throw new ApiError('not_found')
  return { id: intent.id, status: 'verified' as const, attachmentId: intent.attachmentId, draftId: intent.draftId, entityId: intent.entityId, bucket: intent.outputBucket, path: intent.outputPath }
}
export async function finalizeUpload(session: Session, body: unknown) {
  const { intentId } = uploadReference.parse(body)
  const intent = await rpc(session.client, 'get_upload_intent', { p_intent_id: intentId })
  if (intent.ownerProfileId !== session.profileId) throw new ApiError('not_found')
  if (intent.status === 'verified') return receipt(intent)
  if (Date.parse(intent.expiresAt) <= Date.now()) throw new ApiError('upload_expired')
  if (intent.status !== 'pending') throw new ApiError('invalid_input')
  const service = serviceStorage()
  const downloaded = await service.storage.from(intent.quarantineBucket).download(intent.quarantinePath)
  if (downloaded.error || !downloaded.data) throw new ApiError('invalid_input')
  if (downloaded.data.size !== intent.expectedSizeBytes) throw new ApiError('invalid_input')
  let inspected: Awaited<ReturnType<typeof inspectUpload>>
  try {
    inspected = await inspectUpload(new Uint8Array(await downloaded.data.arrayBuffer()), { mimeType: intent.expectedMimeType, sizeBytes: intent.expectedSizeBytes, sha256: intent.expectedSha256, outputMimeType: intent.outputMimeType })
  } catch (error) { if (error instanceof UploadInspectionError) throw new ApiError('invalid_input'); throw error }
  const maxOutput = (intent.kind === 'job-document' ? 20 : 10) * 1024 * 1024
  if (inspected.bytes.length > maxOutput) throw new ApiError('invalid_input')
  const stored = await service.storage.from(intent.outputBucket).upload(intent.outputPath, inspected.bytes, { contentType: inspected.mimeType, upsert: false, cacheControl: '0' })
  if (stored.error) {
    // Concurrent finalization or a lost response can leave the immutable derivative.
    const existing = await service.storage.from(intent.outputBucket).download(intent.outputPath)
    if (existing.error || !existing.data || existing.data.size !== inspected.bytes.length || createHash('sha256').update(Buffer.from(await existing.data.arrayBuffer())).digest('hex') !== inspected.sha256) throw new ApiError('service_unavailable')
  }
  const verified = await rpc(service, 'finalize_verified_upload', {
    p_intent_id: intent.id, p_actor_auth_user_id: session.userId, p_actual_mime_type: intent.expectedMimeType,
    p_actual_size_bytes: intent.expectedSizeBytes, p_actual_sha256: intent.expectedSha256,
    p_output_size_bytes: inspected.bytes.length, p_output_sha256: inspected.sha256
  })
  return receipt(verified)
}
export async function readUpload(session: Session, body: unknown) {
  const { intentId } = uploadReference.parse(body)
  const intent = await rpc(session.client, 'get_upload_intent', { p_intent_id: intentId })
  receipt(intent)
  const filename = `foto-${intent.id}.${intent.outputMimeType === 'image/jpeg' ? 'jpg' : 'webp'}`
  // Storage SELECT would let a browser choose an arbitrary expiry. The session
  // RPC above authorizes this exact object; only the server may mint read links.
  const { data, error } = await serviceStorage().storage.from(intent.outputBucket).createSignedUrl(intent.outputPath, 60, { download: filename })
  if (error || !data) throw new ApiError('not_found')
  return { url: data.signedUrl, expiresIn: 60, filename }
}
