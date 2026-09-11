export type UserRole = 'customer' | 'professional' | 'admin'

// Match persisted columns; expiration is a timestamp condition, not a new enum.
export type ServiceQuoteStatus = 'needs_review' | 'ready' | 'accepted'
export type JobExtraStatus = 'proposed' | 'accepted' | 'rejected'
export type QualityCaseStatus = 'open' | 'in_review' | 'resolved' | 'rejected'
export type WarrantyClaimStatus = 'open' | 'approved' | 'rejected' | 'completed'

/** Money authority is the checkout/observation, separately from legacy payments. */
export type MarketplaceCheckoutStatus =
  | 'creating' | 'ready' | 'pending' | 'in_process' | 'approved' | 'rejected'
  | 'cancelled' | 'refunded' | 'partially_refunded' | 'charged_back' | 'review' | 'expired'

export type ServiceIssueSlug =
  | 'no_enfria'
  | 'pierde_agua'
  | 'hace_ruido'
  | 'no_enciende'
  | 'no_funciona_calor'
  | 'instalacion'
  | 'mantenimiento'

export type TimeSince = 'today' | 'days' | 'weeks' | 'months'
export type PropertyType = 'house' | 'apartment' | 'commercial' | 'office'
export type UrgencyLevel = 'flexible' | 'priority'

export type RequestStatus =
  | 'draft'
  | 'diagnosis_completed'
  | 'address_completed'
  | 'schedule_completed'
  | 'price_selected'
  | 'pending_payment'
  | 'payment_approved'
  | 'matching'
  | 'pending_assignment'
  | 'pending_professional_acceptance'
  | 'assigned'
  | 'cancelled'
  | 'expired'

export type JobStatus =
  | 'pending_assignment'
  | 'pending_professional_acceptance'
  | 'confirmed'
  | 'technician_on_way'
  | 'arrived'
  | 'onsite_diagnosis'
  | 'waiting_customer_approval'
  | 'in_progress'
  | 'completed_pending_customer_confirmation'
  | 'completed'
  | 'cancelled_by_customer'
  | 'cancelled_by_professional'
  | 'cancelled_by_admin'
  | 'disputed'
  | 'warranty_claim'

export type ProfessionalStatus =
  | 'invited'
  | 'form_started'
  | 'form_submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'inactive'

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded'
  | 'captured'
  | 'failed'

export type MaintenanceOption =
  | 'none'
  | 'filters_30_days'
  | 'filters_60_days'
  | 'filters_90_days'
  | 'deep_cleaning_6_months'
  | 'deep_cleaning_annual'
  | 'gas_review_30_days'
  | 'outdoor_unit_review'
  | 'electrical_review'
  | 'pending_part_replacement'
  | 'second_visit_recommended'

export type AddressAccessDetails = {
  hasElevator?: boolean
  hasParking?: boolean
  stairsRequired?: boolean
  outdoorUnitAtHeight?: boolean
  outdoorUnitOnBalcony?: boolean
  difficultAccess?: boolean
}
