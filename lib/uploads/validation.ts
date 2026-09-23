export type UploadKind =
  | 'request-photo'
  | 'request-video'
  | 'professional-document'
  | 'professional-avatar'
  | 'job-photo'
  | 'job-document'
  | 'equipment-photo'

export type UploadValidationInput = {
  kind: UploadKind
  mimeType: string
  sizeBytes: number
}

const maxSizes: Record<UploadKind, number> = {
  'equipment-photo': 10 * 1024 * 1024,
  'request-photo': 10 * 1024 * 1024,
  'request-video': 50 * 1024 * 1024,
  'professional-document': 10 * 1024 * 1024,
  'professional-avatar': 2 * 1024 * 1024,
  'job-photo': 10 * 1024 * 1024,
  'job-document': 20 * 1024 * 1024
}

const allowedMimeTypes: Record<UploadKind, string[]> = {
  'equipment-photo': ['image/jpeg', 'image/png', 'image/webp'],
  'request-photo': ['image/jpeg', 'image/png', 'image/webp'],
  'request-video': [],
  'professional-document': ['image/jpeg', 'image/png', 'image/webp'],
  'professional-avatar': ['image/jpeg', 'image/png', 'image/webp'],
  'job-photo': ['image/jpeg', 'image/png', 'image/webp'],
  'job-document': ['image/jpeg', 'image/png', 'image/webp']
}

export function validateUpload(
  input: UploadValidationInput
): { valid: true } | { valid: false; reason: string } {
  if (
    !Object.hasOwn(allowedMimeTypes, input.kind) ||
    !allowedMimeTypes[input.kind].includes(input.mimeType)
  )
    return { valid: false, reason: `Tipo de archivo no permitido: ${input.mimeType}` }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0)
    return { valid: false, reason: 'El archivo está vacío o su tamaño no es válido' }
  if (input.sizeBytes > maxSizes[input.kind])
    return { valid: false, reason: 'El archivo supera el tamaño máximo permitido' }
  return { valid: true }
}
