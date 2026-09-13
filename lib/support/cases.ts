export type SupportCaseSeverity = 'low' | 'medium' | 'high' | 'critical'
export type SupportCaseStatus =
  | 'open'
  | 'in_review'
  | 'waiting_customer'
  | 'waiting_professional'
  | 'resolved'
  | 'rejected'
export type SupportCaseAction =
  | 'start_review'
  | 'wait_customer'
  | 'wait_professional'
  | 'customer_replied'
  | 'professional_replied'
  | 'resolve'
  | 'reject'
  | 'reopen'

export type SupportCaseInput = {
  jobId?: string
  customerId?: string
  professionalId?: string
  source: 'customer' | 'professional' | 'admin'
  category: 'delay' | 'payment' | 'quality' | 'safety' | 'warranty' | 'other'
  description: string
  hasSafetyRisk?: boolean
  paymentBlocked?: boolean
  customerAtHomeWaiting?: boolean
}

export function classifySupportCase(input: SupportCaseInput): {
  status: SupportCaseStatus
  severity: SupportCaseSeverity
  slaMinutes: number
  tags: string[]
} {
  if (!input.description.trim()) throw new Error('support_case_description_required')
  const tags: string[] = [input.category]
  let severity: SupportCaseSeverity = 'medium'
  if (input.category === 'safety' || input.hasSafetyRisk) severity = 'critical'
  else if (input.paymentBlocked || input.category === 'payment') severity = 'high'
  else if (input.customerAtHomeWaiting || input.category === 'delay') severity = 'high'
  else if (input.category === 'quality' || input.category === 'warranty') severity = 'medium'
  else severity = 'low'
  const slaMinutes =
    severity === 'critical' ? 10 : severity === 'high' ? 30 : severity === 'medium' ? 120 : 1440
  if (input.paymentBlocked) tags.push('payment_blocked')
  if (input.customerAtHomeWaiting) tags.push('customer_waiting')
  if (input.hasSafetyRisk) tags.push('safety_risk')
  return { status: 'open', severity, slaMinutes, tags }
}

const transitions: Record<
  SupportCaseStatus,
  Partial<Record<SupportCaseAction, SupportCaseStatus>>
> = {
  open: { start_review: 'in_review', reject: 'rejected' },
  in_review: {
    wait_customer: 'waiting_customer',
    wait_professional: 'waiting_professional',
    resolve: 'resolved',
    reject: 'rejected'
  },
  waiting_customer: { customer_replied: 'in_review', resolve: 'resolved' },
  waiting_professional: { professional_replied: 'in_review', resolve: 'resolved' },
  resolved: { reopen: 'in_review' },
  rejected: { reopen: 'in_review' }
}

export function supportCaseTransition(status: SupportCaseStatus, action: SupportCaseAction) {
  const next = transitions[status][action]
  if (!next) throw new Error('support_case_transition_invalid')
  return next
}
