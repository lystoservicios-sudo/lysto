import { NextResponse } from 'next/server'
import { evaluateProfessionalOnboarding, type OnboardingApplication } from '@/lib/use-cases/professional-workflow'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as OnboardingApplication | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  try {
    const readiness = evaluateProfessionalOnboarding(body)
    return NextResponse.json({
      accepted: true,
      readiness,
      persistence: 'Persist professional_profiles.status only after admin review and required RLS checks.'
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 })
  }
}
