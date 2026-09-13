import type { JobStatus, PaymentStatus, ProfessionalStatus, RequestStatus } from './types.ts'

type TransitionMap<T extends string> = Record<T, readonly T[]>

export const requestTransitions: TransitionMap<RequestStatus> = {
  draft: ['diagnosis_completed', 'cancelled', 'expired'],
  diagnosis_completed: ['address_completed', 'cancelled', 'expired'],
  address_completed: ['schedule_completed', 'cancelled', 'expired'],
  schedule_completed: ['price_selected', 'cancelled', 'expired'],
  price_selected: ['pending_assignment', 'cancelled', 'expired'],
  pending_payment: ['payment_approved', 'cancelled', 'expired'],
  payment_approved: ['cancelled'],
  matching: ['pending_assignment', 'pending_professional_acceptance', 'cancelled'],
  pending_assignment: ['pending_professional_acceptance', 'assigned', 'cancelled'],
  pending_professional_acceptance: ['assigned', 'pending_assignment', 'cancelled'],
  assigned: ['cancelled'],
  cancelled: [],
  expired: []
}

export const jobTransitions: TransitionMap<JobStatus> = {
  pending_assignment: ['pending_professional_acceptance', 'cancelled_by_admin'],
  pending_professional_acceptance: ['confirmed', 'pending_assignment', 'cancelled_by_professional', 'cancelled_by_admin'],
  confirmed: ['technician_on_way', 'cancelled_by_customer', 'cancelled_by_professional', 'cancelled_by_admin'],
  technician_on_way: ['arrived', 'cancelled_by_admin'],
  arrived: ['onsite_diagnosis', 'cancelled_by_admin'],
  onsite_diagnosis: ['waiting_customer_approval', 'in_progress', 'cancelled_by_admin'],
  waiting_customer_approval: ['in_progress', 'cancelled_by_customer', 'cancelled_by_admin'],
  in_progress: ['completed_pending_customer_confirmation', 'disputed', 'cancelled_by_admin'],
  completed_pending_customer_confirmation: ['completed', 'disputed'],
  completed: ['warranty_claim'],
  cancelled_by_customer: [],
  cancelled_by_professional: [],
  cancelled_by_admin: [],
  disputed: ['completed', 'warranty_claim', 'cancelled_by_admin'],
  warranty_claim: ['confirmed', 'technician_on_way', 'completed', 'disputed']
}

export const professionalTransitions: TransitionMap<ProfessionalStatus> = {
  invited: ['form_started', 'inactive'],
  form_started: ['form_submitted', 'inactive'],
  form_submitted: ['under_review', 'inactive'],
  under_review: ['approved', 'rejected', 'inactive'],
  approved: ['suspended', 'inactive'],
  rejected: ['under_review', 'inactive'],
  suspended: ['approved', 'inactive'],
  inactive: ['invited']
}

export const paymentTransitions: TransitionMap<PaymentStatus> = {
  pending: ['authorized', 'approved', 'rejected', 'cancelled', 'failed'],
  authorized: ['captured', 'cancelled', 'failed'],
  approved: ['refunded', 'partially_refunded', 'failed'],
  rejected: [],
  cancelled: [],
  refunded: [],
  partially_refunded: ['refunded', 'failed'],
  captured: ['refunded', 'partially_refunded', 'failed'],
  failed: ['pending']
}

export function canTransition<T extends string>(map: TransitionMap<T>, from: T, to: T): boolean {
  return map[from]?.includes(to) ?? false
}

export function assertTransition<T extends string>(map: TransitionMap<T>, from: T, to: T, entity = 'entity'): void {
  if (!canTransition(map, from, to)) throw new Error(`Invalid ${entity} transition: ${from} -> ${to}`)
}

export function nextStates<T extends string>(map: TransitionMap<T>, from: T): readonly T[] {
  return map[from] ?? []
}
