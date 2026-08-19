import { NextResponse } from 'next/server'
import { buildStoragePath, validateUpload, type UploadKind } from '@/lib/uploads/validation'

const validKinds = new Set<UploadKind>(['request-photo', 'request-video', 'professional-document', 'job-photo', 'job-document'])

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { kind?: UploadKind; ownerId?: string; entityId?: string; filename?: string; mimeType?: string; sizeBytes?: number } | null
  if (!body?.kind || !validKinds.has(body.kind) || !body.ownerId || !body.entityId || !body.filename || !body.mimeType || !body.sizeBytes) {
    return NextResponse.json({ error: 'Invalid upload payload' }, { status: 400 })
  }
  const validation = validateUpload({ kind: body.kind, mimeType: body.mimeType, sizeBytes: body.sizeBytes })
  if (!validation.valid) return NextResponse.json({ error: validation.reason }, { status: 400 })
  const prefix = body.kind.startsWith('professional') ? 'professionals' : body.kind.startsWith('job') ? 'jobs' : 'requests'
  const path = buildStoragePath({ ownerId: body.ownerId, entityId: body.entityId, filename: body.filename, prefix })
  return NextResponse.json({
    signedUrl: null,
    path,
    status: 'requires_authenticated_supabase_server_client',
    security: 'bucket must remain private; read via signed URLs/server-side only'
  })
}
