export type SupportCaseSeverity = 'low' | 'medium' | 'high' | 'critical'
export type SupportCaseStatus = 'open' | 'in_review' | 'waiting_customer' | 'waiting_professional' | 'resolved' | 'rejected'

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

export function classifySupportCase(input: SupportCaseInput): { status: SupportCaseStatus; severity: SupportCaseSeverity; slaMinutes: number; tags: string[] } {
  if (!input.description.trim()) throw new Error('support_case_description_required')
  const tags: string[] = [input.category]
  let severity: SupportCaseSeverity = 'medium'
  if (input.category === 'safety' || input.hasSafetyRisk) severity = 'critical'
  else if (input.paymentBlocked || input.category === 'payment') severity = 'high'
  else if (input.customerAtHomeWaiting || input.category === 'delay') severity = 'high'
  else if (input.category === 'quality' || input.category === 'warranty') severity = 'medium'
  else severity = 'low'
  const slaMinutes = severity === 'critical' ? 10 : severity === 'high' ? 30 : severity === 'medium' ? 120 : 1440
  if (input.paymentBlocked) tags.push('payment_blocked')
  if (input.customerAtHomeWaiting) tags.push('customer_waiting')
  if (input.hasSafetyRisk) tags.push('safety_risk')
  return { status: 'open', severity, slaMinutes, tags }
}
