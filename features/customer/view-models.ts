import type {
  AddressAccessDetails,
  JobStatus,
  MaintenanceOption,
  PaymentStatus,
  RequestStatus,
  ServiceIssueSlug,
  UrgencyLevel
} from '@/lib/domain/types'

export type CustomerUiTone = 'brand' | 'success' | 'warning' | 'danger' | 'benefit' | 'neutral'
export type CustomerDataState = 'loading' | 'ready' | 'empty' | 'error'

export type CustomerStatusViewModel = {
  label: string
  tone: CustomerUiTone
}

export type CustomerRequestViewModel = {
  id: string
  issue: ServiceIssueSlug
  issueLabel: string
  status: RequestStatus
  statusView: CustomerStatusViewModel
  urgency: UrgencyLevel
  address: string
  preferredWindow: string
  createdAt: string
  preliminaryDiagnosis: string
  preliminaryPrice: number | null
  mediaCount: number
  nextStep: string
  assignedProfessionalName?: string
}

export type CustomerJobViewModel = {
  id: string
  requestId: string
  status: JobStatus
  statusView: CustomerStatusViewModel
  issueLabel: string
  address: string
  scheduledAt: string
  timeWindow: string
  professionalName?: string
  equipmentName?: string
  amount: number | null
  nextStep: string
  canReview: boolean
  preliminaryDiagnosis?: string
  professionalDiagnosis?: string
  preliminaryAmount?: number | null
  finalAmount?: number | null
  priceChangeReason?: string
  professionalSpecialty?: string
  professionalRating?: number
  professionalLicense?: string
  professionalVerified?: boolean
  trackingStatus?: string
  completedAt?: string
  alreadyReviewed?: boolean
}

export type CustomerEquipmentViewModel = {
  id: string
  nickname: string
  kind: string
  brand: string
  model?: string
  address: string
  imageUrl?: string
  imageAlt?: string
  lastServiceAt?: string
  nextMaintenanceAt?: string
  maintenanceOption: MaintenanceOption
  serviceCount: number
  statusView?: CustomerStatusViewModel
  roomLabel?: string
  capacityLabel?: string
  serialNumber?: string
  installedAt?: string
  serviceHistory?: readonly CustomerEquipmentServiceViewModel[]
}

export type CustomerEquipmentServiceViewModel = {
  id: string
  jobId?: string
  performedAt: string
  serviceType: string
  result: string
  professionalName?: string
  receiptAvailable: boolean
}

export type CustomerMaintenanceViewModel = {
  id: string
  equipmentId: string
  equipmentName: string
  recommendation: string
  dueAt?: string
  urgency: 'overdue' | 'soon' | 'planned' | 'none'
  actionState: 'available' | 'deferred' | 'disabled'
}

export type CustomerWarrantyViewModel = {
  id: string
  jobId: string
  equipmentId: string
  equipmentName: string
  status: 'active' | 'claim_open' | 'resolved' | 'rejected' | 'expired'
  statusView: CustomerStatusViewModel
  coverageEndsAt?: string
  safeSummary: string
  nextStep?: string
  serviceLabel?: string
  professionalName?: string
  completedAt?: string
  claimOpenedAt?: string
  timeline?: readonly CustomerCaseTimelineItem[]
}

export type CustomerCaseTimelineItem = {
  id: string
  label: string
  description?: string
  occurredAt?: string
  state: 'completed' | 'current' | 'pending'
}

export type CustomerQualityFollowupViewModel = {
  id: string
  equipmentId: string
  equipmentName: string
  kind: string
  summary: string
  statusView: CustomerStatusViewModel
  nextStep: string
  updatedAt: string
  actionState: 'available' | 'deferred' | 'disabled'
}

export type CustomerProfessionalRecognitionViewModel = {
  id: string
  professionalName: string
  specialty: string
  recognitionLabel: string
  summary: string
  rating: number
  acceptanceRate: number
  completedServices: number
  verified: boolean
}

export type CustomerPaymentViewModel = {
  id: string
  jobId: string
  status: PaymentStatus
  statusView: CustomerStatusViewModel
  amount: number
  createdAt: string
  methodLabel?: string
  receiptAvailable: boolean
}

export type CustomerAddressViewModel = {
  id: string
  label: string
  street: string
  number: string
  floor?: string
  apartment?: string
  city: string
  province: string
  access: AddressAccessDetails
}

export type CustomerProfileViewModel = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  notificationPreference: 'email' | 'whatsapp' | 'both'
}

export function findCustomerRecordById<T extends { id: string }>(records: readonly T[], id: string): T | null {
  return records.find((record) => record.id === id) ?? null
}
