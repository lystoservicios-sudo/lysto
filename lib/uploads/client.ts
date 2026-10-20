'use client'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { validateUpload, type UploadKind } from './validation'
export type UploadTarget = {
  kind: Exclude<UploadKind, 'request-video'>
  entityId?: string
  draftId?: string
  phase?: 'before' | 'during' | 'after' | 'document'
  documentType?: string
  scope?: 'professional-onboarding'
}
export type UploadHandle = {
  intentId: string
  bucket: string
  path: string
  token: string
  draftId: string | null
}
export type VerifiedUpload = {
  intentId: string
  attachmentId: string
  draftId: string | null
  entityId: string | null
}
const handleSchema = z.object({
  intentId: z.string().uuid(),
  bucket: z.literal('upload-quarantine'),
  path: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/),
  token: z.string().min(1),
  draftId: z.string().uuid().nullable()
})
const verifiedSchema = z.object({
  id: z.string().uuid(),
  status: z.literal('verified'),
  attachmentId: z.string().uuid(),
  draftId: z.string().uuid().nullable(),
  entityId: z.string().uuid().nullable()
})
class ExpiredUploadError extends Error {}
export type UploadExecution = { customerId?: string; signal?: AbortSignal }
async function post(path: string, body: unknown, execution: UploadExecution) {
  execution.signal?.throwIfAborted()
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(execution.customerId ? { 'X-Lysto-Customer-Id': execution.customerId } : {}) },
    body: JSON.stringify(body),
    signal: execution.signal ? AbortSignal.any([execution.signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000)
  })
  execution.signal?.throwIfAborted()
  if (response.status === 410)
    throw new ExpiredUploadError(
      'La subida venció. Volvé a guardar la foto para iniciar un nuevo intento.'
    )
  if (!response.ok)
    throw new Error('No pudimos guardar la foto. Revisá el archivo e intentá nuevamente.')
  return response.json()
}
/** Finalization is idempotent; recover only an owned, verified, unconsumed photo draft. */
export async function resumeRequestPhotoDraft(intentId: string, execution: UploadExecution = {}): Promise<string> {
  z.string().uuid().parse(intentId)
  const verified = verifiedSchema.parse(await post('/api/uploads/finalize', { intentId }, execution))
  if (verified.id !== intentId || !verified.draftId || verified.entityId !== null)
    throw new Error('No pudimos recuperar las fotos del pedido. Quitá las fotos guardadas y volvé a seleccionarlas.')
  return verified.draftId
}

export async function uploadPrivateFile(
  file: File,
  target: UploadTarget,
  onIntent?: (handle: UploadHandle | null) => void,
  resume?: UploadHandle,
  execution: UploadExecution = {}
): Promise<VerifiedUpload> {
  execution.signal?.throwIfAborted()
  if (execution.customerId) z.string().uuid().parse(execution.customerId)
  const { scope, ...declaration } = target
  if (scope && target.kind !== 'professional-document')
    throw new Error('El archivo no pertenece a una postulación.')
  const base =
    scope === 'professional-onboarding' ? '/api/professional/onboarding/documents' : '/api/uploads'
  const valid = validateUpload({ kind: target.kind, mimeType: file.type, sizeBytes: file.size })
  if (!valid.valid) throw new Error(valid.reason)
  let handle: UploadHandle
  if (resume) handle = handleSchema.parse(resume)
  else {
    const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    execution.signal?.throwIfAborted()
    const sha256 = Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('')
    handle = handleSchema.parse(
      await post(base + '/sign', {
        ...declaration,
        mimeType: file.type,
        sizeBytes: file.size,
        sha256
      }, execution)
    )
    execution.signal?.throwIfAborted()
    onIntent?.(handle)
  }
  execution.signal?.throwIfAborted()
  const { error } = await createClient()
    .storage.from(handle.bucket)
    .uploadToSignedUrl(handle.path, handle.token, file, { contentType: file.type, upsert: false })
  // The Storage SDK may finish writing quarantine bytes after abort; never finalize or
  // acknowledge them under another account. Existing expiry cleanup handles orphan intents.
  execution.signal?.throwIfAborted()
  // An immutable object may already exist when the previous response was lost.
  // The verifier must still prove that its bytes match this intent.
  if (error && !['409', '400'].includes(String(error.statusCode)))
    throw new Error('La subida no se completó. Podés reintentar la misma foto.')
  let verified: z.infer<typeof verifiedSchema>
  try {
    verified = verifiedSchema.parse(await post(base + '/finalize', { intentId: handle.intentId }, execution))
  } catch (error) {
    if (error instanceof ExpiredUploadError) onIntent?.(null)
    throw error
  }
  execution.signal?.throwIfAborted()
  if (verified.id !== handle.intentId) throw new Error('No pudimos confirmar el archivo guardado.')
  return {
    intentId: verified.id,
    attachmentId: verified.attachmentId,
    draftId: verified.draftId,
    entityId: verified.entityId
  }
}
