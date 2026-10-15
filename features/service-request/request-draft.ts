import { TIME_WINDOWS } from '@/lib/domain/constants'
import type { ServiceIssueSlug, TimeSince, UrgencyLevel } from '@/lib/domain/types'
import type { RequestEquipmentTechnology } from './request-context'

export type RequestPurpose = 'repair' | 'maintenance' | 'installation'
export type RequestRepairIssue = Exclude<ServiceIssueSlug, 'instalacion' | 'mantenimiento'> | 'unknown'
export type RequestStep = 'issue' | 'location' | 'details' | 'orientation' | 'schedule' | 'review' | 'payment'
export type RequestDetails =
  | { kind: 'repair'; description: string; timeSince?: TimeSince; frequency?: 'constant' | 'intermittent' | 'unknown'; symptomContext?: string }
  | { kind: 'maintenance'; description: string; lastMaintenance?: 'never' | 'under_6_months' | '6_to_12_months' | 'over_1_year' | 'unknown' }
  | { kind: 'installation'; description: string; installationType?: 'new' | 'relocation' | 'unknown' }
export type RequestLocationSelection = { homeId: string; addressId: string; floorId: string; roomId: string; homeVersion: number }
export type RequestSchedulePreference = { preferredDate: string; preferredTimeWindow: string; urgency: UrgencyLevel }
type RequestCommonAnswers = {
  location: RequestLocationSelection | null
  characteristics: { capacity: number | null; technology: RequestEquipmentTechnology } | null
  schedule: RequestSchedulePreference | null
  orientationAccepted: boolean
}
export type RequestEquipmentAnswers = RequestCommonAnswers & (
  | { purpose: 'repair'; issue: RequestRepairIssue | null; details: Extract<RequestDetails, { kind: 'repair' }> }
  | { purpose: 'maintenance'; issue: null; details: Extract<RequestDetails, { kind: 'maintenance' }> }
  | { purpose: 'installation'; issue: null; details: Extract<RequestDetails, { kind: 'installation' }> }
)
/** IDs and the revision only: money and payment approval belong to the server. */
export type RequestDraftQuote = { id: string; actorId: string; inputRevision: number }
export type RequestDraft = {
  actorId: string
  selectedEquipmentId: string | null
  step: RequestStep
  answersByEquipment: Record<string, RequestEquipmentAnswers>
  inputRevision: number
  quote: RequestDraftQuote | null
}
export type RequestDraftAction =
  | { type: 'actor'; actorId: string }
  | { type: 'select-equipment'; equipmentId: string | null }
  | { type: 'purpose'; purpose: RequestPurpose }
  | { type: 'issue'; issue: RequestRepairIssue }
  | { type: 'details'; details: RequestDetails }
  | { type: 'location'; location: RequestLocationSelection | null }
  | { type: 'characteristics'; characteristics: RequestEquipmentAnswers['characteristics'] }
  | { type: 'schedule'; schedule: RequestSchedulePreference | null }
  | { type: 'orientation'; accepted: boolean }
  | { type: 'quote'; quote: RequestDraftQuote | null }
  | { type: 'go-step'; step: RequestStep }

const equipmentKey = (id: string | null) => id ?? '$new'
const initialAnswers = (): RequestEquipmentAnswers => ({ purpose: 'repair', issue: null, details: { kind: 'repair', description: '' }, location: null, characteristics: null, schedule: null, orientationAccepted: false })

export function createRequestDraft(actorId: string, equipmentId: string | null = null): RequestDraft {
  return { actorId, selectedEquipmentId: equipmentId, step: 'issue', answersByEquipment: { [equipmentKey(equipmentId)]: initialAnswers() }, inputRevision: 0, quote: null }
}

export function getSelectedRequestAnswers(state: RequestDraft): RequestEquipmentAnswers {
  return state.answersByEquipment[equipmentKey(state.selectedEquipmentId)]
}

export function getRequestServiceIssue(state: RequestDraft): ServiceIssueSlug | null {
  const answers = getSelectedRequestAnswers(state)
  if (answers.purpose === 'maintenance') return 'mantenimiento'
  if (answers.purpose === 'installation') return 'instalacion'
  return answers.issue === 'unknown' ? null : answers.issue
}

function sameDetails(left: RequestDetails, right: RequestDetails): boolean {
  if (left.kind !== right.kind || left.description !== right.description) return false
  if (left.kind === 'repair' && right.kind === 'repair') return left.timeSince === right.timeSince && left.frequency === right.frequency && left.symptomContext === right.symptomContext
  if (left.kind === 'maintenance' && right.kind === 'maintenance') return left.lastMaintenance === right.lastMaintenance
  if (left.kind === 'installation' && right.kind === 'installation') return left.installationType === right.installationType
  return false
}

export function requestDraftReducer(state: RequestDraft, action: RequestDraftAction): RequestDraft {
  if (action.type === 'actor') {
    if (state.actorId === action.actorId) return state
    // Clear private answers, but never reuse a revision if an actor later returns.
    return { ...createRequestDraft(action.actorId), inputRevision: state.inputRevision + 1 }
  }
  if (action.type === 'go-step') return state.step === action.step ? state : { ...state, step: action.step }
  if (action.type === 'quote') {
    if (action.quote && (action.quote.actorId !== state.actorId || action.quote.inputRevision !== state.inputRevision)) return state
    return { ...state, quote: action.quote }
  }
  if (action.type === 'select-equipment') {
    if (action.equipmentId === state.selectedEquipmentId) return state
    const key = equipmentKey(action.equipmentId)
    return { ...state, selectedEquipmentId: action.equipmentId, step: 'issue', answersByEquipment: { ...state.answersByEquipment, [key]: state.answersByEquipment[key] ?? initialAnswers() }, quote: null, inputRevision: state.inputRevision + 1 }
  }
  const current = getSelectedRequestAnswers(state)
  let updated: RequestEquipmentAnswers
  switch (action.type) {
    case 'purpose':
      if (current.purpose === action.purpose) return state
      if (action.purpose === 'maintenance') updated = { ...current, purpose: 'maintenance', issue: null, details: { kind: 'maintenance', description: '' }, orientationAccepted: false }
      else if (action.purpose === 'installation') updated = { ...current, purpose: 'installation', issue: null, details: { kind: 'installation', description: '' }, orientationAccepted: false }
      else updated = { ...current, purpose: 'repair', issue: null, details: { kind: 'repair', description: '' }, orientationAccepted: false }
      break
    case 'issue': {
      if (current.purpose === 'repair' && current.issue === action.issue) return state
      const details: Extract<RequestDetails, { kind: 'repair' }> = current.purpose === 'repair' ? { ...current.details } : { kind: 'repair', description: '' }
      delete details.symptomContext
      updated = { ...current, purpose: 'repair', issue: action.issue, details, orientationAccepted: false }
      break
    }
    case 'details':
      if (sameDetails(current.details, action.details)) return state
      if (action.details.kind === 'repair' && current.purpose === 'repair') updated = { ...current, details: action.details, orientationAccepted: false }
      else if (action.details.kind === 'maintenance' && current.purpose === 'maintenance') updated = { ...current, details: action.details, orientationAccepted: false }
      else if (action.details.kind === 'installation' && current.purpose === 'installation') updated = { ...current, details: action.details, orientationAccepted: false }
      else throw new Error('Request details must match the selected service branch')
      break
    case 'location': updated = { ...current, location: action.location }; break
    case 'characteristics': updated = { ...current, characteristics: action.characteristics }; break
    case 'schedule': updated = { ...current, schedule: action.schedule }; break
    case 'orientation': updated = { ...current, orientationAccepted: action.accepted }; break
  }
  if (JSON.stringify(updated) === JSON.stringify(current)) return state
  return { ...state, answersByEquipment: { ...state.answersByEquipment, [equipmentKey(state.selectedEquipmentId)]: updated }, inputRevision: state.inputRevision + 1, quote: null }
}

function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Local navigation checks only; ownership, price and visit availability are revalidated server-side. */
export function getRequestStepErrors(state: RequestDraft, step: RequestStep): string[] {
  const answers = getSelectedRequestAnswers(state)
  switch (step) {
    case 'issue': return answers.purpose === 'repair' && answers.issue === null ? ['issue_required'] : []
    case 'location': {
      const location = answers.location
      return location && [location.homeId, location.addressId, location.floorId, location.roomId].every(value => value.trim()) && Number.isInteger(location.homeVersion) && location.homeVersion > 0 ? [] : ['location_required']
    }
    case 'details':
      if (answers.details.kind === 'repair') {
        const errors: string[] = []
        if (!answers.details.timeSince) errors.push('time_since_required')
        if (answers.details.symptomContext && answers.details.symptomContext.length > 80) errors.push('symptom_context_too_long')
        return errors
      }
      if (answers.details.kind === 'maintenance') return answers.details.lastMaintenance ? [] : ['maintenance_history_required']
      return answers.details.installationType ? [] : ['installation_type_required']
    case 'orientation': return answers.orientationAccepted ? [] : ['orientation_required']
    case 'schedule': {
      const errors: string[] = []
      if (!answers.schedule || !isCalendarDay(answers.schedule.preferredDate)) errors.push('preferred_date_required')
      if (!answers.schedule || !TIME_WINDOWS.includes(answers.schedule.preferredTimeWindow as typeof TIME_WINDOWS[number])) errors.push('time_window_required')
      return errors
    }
    case 'review':
    case 'payment': return []
  }
}
