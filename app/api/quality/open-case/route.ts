import { NextResponse } from 'next/server'
import { z } from 'zod'
import { classifySupportCase, type SupportCaseInput } from '../../../../lib/support/cases'

const qualityCaseSchema = z.object({
  jobId: z.string().trim().min(1),
  reason: z.string().trim().optional(),
  description: z.string().trim().optional()
}).strict().superRefine((body, context) => {
  if (!body.reason && !body.description) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['description'], message: 'reason or description is required' })
  }
})

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null)
  const parsed = qualityCaseSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid quality case payload', errors: parsed.error.issues.map((issue) => issue.message) }, { status: 400 })
  }
  const body = parsed.data

  const description = [body.reason, body.description].filter(Boolean).join(': ')
  const supportCase: SupportCaseInput = {
    jobId: body.jobId,
    source: 'customer',
    category: 'quality',
    description
  }
  const classification = classifySupportCase(supportCase)
  return NextResponse.json({ opened: true, classification, status: 'ready_for_quality_event_insert_and_admin_notification' })
}
