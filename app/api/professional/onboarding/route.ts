import { NextResponse } from 'next/server'
import { validateProfessionalOnboarding, type ProfessionalOnboardingInput } from '@/lib/professional/onboarding'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as ProfessionalOnboardingInput | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  const validation = validateProfessionalOnboarding(body)
  if (!validation.valid) return NextResponse.json({ error: 'Onboarding incomplete', details: validation.errors, missingTools: validation.missingRequiredTools, readinessScore: validation.readinessScore }, { status: 400 })
  return NextResponse.json({ accepted: true, readinessScore: validation.readinessScore, nextStatus: 'under_review', persistence: 'Persist professional form and documents, mark under_review.' })
}
