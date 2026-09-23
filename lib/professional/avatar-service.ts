import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/http/api-error'
import { assertPublicSupabaseEnv } from '@/lib/supabase/env'
import { inspectUpload, UploadInspectionError } from '@/lib/uploads/inspection'
import { validateUpload } from '@/lib/uploads/validation'
import { requireSession } from '@/lib/auth/session'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { logEvent } from '@/lib/observability/logger'
import { onboardingIdentity, readProfessionalOnboarding } from './onboarding-service'

const maxAvatarBytes = 2 * 1024 * 1024

export async function inspectProfessionalAvatar(raw: Uint8Array, mimeType: string) {
  if (!validateUpload({ kind: 'professional-avatar', mimeType, sizeBytes: raw.byteLength }).valid)
    throw new ApiError('invalid_input')
  try {
    const inspected = await inspectUpload(raw, {
      mimeType,
      sizeBytes: raw.byteLength,
      sha256: createHash('sha256').update(raw).digest('hex'),
      outputMimeType: 'image/webp'
    })
    if (inspected.bytes.length > maxAvatarBytes) throw new ApiError('invalid_input')
    return inspected
  } catch (error) {
    if (error instanceof UploadInspectionError) throw new ApiError('invalid_input')
    throw error
  }
}

function avatarStorage() {
  const env = assertPublicSupabaseEnv()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new ApiError('service_unavailable')
  return createClient(env.url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function removeAvatarObject(service: ReturnType<typeof avatarStorage>, bucket: string, path: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await service.storage.from(bucket).remove([path])
      if (!result.error) return
    } catch { /* Retry a transient Storage failure. */ }
  }
  logEvent('error', 'professional_avatar.cleanup_failed', { bucket })
}

export async function saveProfessionalAvatar(raw: Uint8Array, mimeType: string) {
  const client = await onboardingIdentity()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user?.id) throw new ApiError('unauthorized')
  let professionalId: string
  try {
    const application = await readProfessionalOnboarding()
    if (!['form_started', 'rejected', 'form_submitted', 'under_review', 'approved'].includes(application.status))
      throw new ApiError('forbidden')
    professionalId = application.professionalId
  } catch (failure) {
    if (!(failure instanceof ApiError) || !['forbidden', 'not_found'].includes(failure.code)) throw failure
    // Legacy, infrastructure-approved professionals have no invitation dossier.
    const session = await requireSession()
    if (session.role !== 'professional' || session.userId !== data.user.id ||
      !session.professionalId || session.professionalStatus !== 'approved') throw new ApiError('forbidden')
    professionalId = session.professionalId
  }
  await enforceRateLimit('private_mutation', data.user.id)
  if (!validateUpload({ kind: 'professional-avatar', mimeType, sizeBytes: raw.byteLength }).valid)
    throw new ApiError('invalid_input')
  const service = avatarStorage()
  const quarantinePath = `${data.user.id}/${randomUUID()}`
  const outputPath = `${data.user.id}/${randomUUID()}.webp`
  let outputStored = false
  let finalizationAttempted = false
  try {
    const quarantine = await service.storage.from('upload-quarantine').upload(quarantinePath, raw, {
      contentType: mimeType, upsert: false, cacheControl: '0'
    })
    if (quarantine.error) throw new ApiError('service_unavailable')
    const downloaded = await service.storage.from('upload-quarantine').download(quarantinePath)
    if (downloaded.error || !downloaded.data || downloaded.data.size !== raw.byteLength)
      throw new ApiError('service_unavailable')
    const inspected = await inspectProfessionalAvatar(
      new Uint8Array(await downloaded.data.arrayBuffer()), mimeType
    )
    const uploaded = await service.storage.from('public-avatars').upload(outputPath, inspected.bytes, {
      contentType: 'image/webp', upsert: false, cacheControl: '300'
    })
    if (uploaded.error) throw new ApiError('service_unavailable')
    outputStored = true
    const url = service.storage.from('public-avatars').getPublicUrl(outputPath).data.publicUrl
    finalizationAttempted = true
    const result = await service.rpc('set_professional_avatar', {
      p_auth_user_id: data.user.id,
      p_professional_id: professionalId,
      p_path: outputPath,
      p_sha256: inspected.sha256,
      p_public_url: url
    })
    if (result.error) throw new ApiError('service_unavailable')
    const previous = typeof result.data === 'string' ? result.data : null
    if (previous && previous !== outputPath)
      await removeAvatarObject(service, 'public-avatars', previous)
    return { avatarUrl: url }
  } finally {
    await removeAvatarObject(service, 'upload-quarantine', quarantinePath)
    // A lost RPC response may follow a successful commit. Do not delete an
    // object that might already be the canonical profile photo.
    if (outputStored && !finalizationAttempted)
      await removeAvatarObject(service, 'public-avatars', outputPath)
  }
}
