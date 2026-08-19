export type UploadKind = 'request-photo' | 'request-video' | 'professional-document' | 'job-photo' | 'job-document'

export type UploadValidationInput = {
  kind: UploadKind
  mimeType: string
  sizeBytes: number
}

const maxSizes: Record<UploadKind, number> = {
  'request-photo': 10 * 1024 * 1024,
  'request-video': 50 * 1024 * 1024,
  'professional-document': 10 * 1024 * 1024,
  'job-photo': 10 * 1024 * 1024,
  'job-document': 20 * 1024 * 1024
}

const allowedMimeTypes: Record<UploadKind, string[]> = {
  'request-photo': ['image/jpeg', 'image/png', 'image/webp'],
  'request-video': ['video/mp4', 'video/quicktime'],
  'professional-document': ['image/jpeg', 'image/png', 'application/pdf'],
  'job-photo': ['image/jpeg', 'image/png', 'image/webp'],
  'job-document': ['application/pdf', 'image/jpeg', 'image/png']
}

export function validateUpload(input: UploadValidationInput): { valid: true } | { valid: false; reason: string } {
  if (!allowedMimeTypes[input.kind].includes(input.mimeType)) return { valid: false, reason: `Tipo de archivo no permitido: ${input.mimeType}` }
  if (input.sizeBytes <= 0) return { valid: false, reason: 'El archivo está vacío' }
  if (input.sizeBytes > maxSizes[input.kind]) return { valid: false, reason: 'El archivo supera el tamaño máximo permitido' }
  return { valid: true }
}

export function buildStoragePath(params: { ownerId: string; entityId: string; filename: string; prefix: 'requests' | 'jobs' | 'professionals' }): string {
  const safeFilename = params.filename.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  return `${params.prefix}/${params.ownerId}/${params.entityId}/${Date.now()}-${safeFilename}`
}
