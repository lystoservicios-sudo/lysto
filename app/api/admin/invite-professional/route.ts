import { NextResponse } from 'next/server'
import { buildInvitationPublicPath, validateProfessionalInvitation } from '@/lib/admin/invitations'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; phone?: string; specialtySlug?: string; expiresInDays?: number } | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  const input = { email: body.email ?? '', phone: body.phone, specialtySlug: body.specialtySlug ?? 'aire_acondicionado', expiresInDays: body.expiresInDays ?? 14 }
  const errors = validateProfessionalInvitation(input)
  if (errors.length) return NextResponse.json({ errors }, { status: 400 })
  const tokenPreview = crypto.randomUUID().replaceAll('-', '')
  return NextResponse.json({
    invitationCreated: true,
    status: 'mocked_until_email_provider_is_configured',
    shouldPersist: ['professional_invitations.email', 'professional_invitations.phone', 'professional_invitations.token_hash', 'professional_invitations.expires_at'],
    tokenPreview,
    publicPath: buildInvitationPublicPath(tokenPreview)
  })
}
