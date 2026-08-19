import type { AddressAccessDetails, PropertyType, ServiceIssueSlug, TimeSince, UrgencyLevel } from '../domain/types.ts'
import { AIR_CONDITIONING_ISSUES, TIME_WINDOWS } from '../domain/constants.ts'

export type CustomerRequestFormInput = {
  issue?: ServiceIssueSlug
  timeSince?: TimeSince
  photosCount?: number
  videosCount?: number
  address?: {
    street?: string
    number?: string
    floor?: string
    apartment?: string
    city?: string
    province?: string
    propertyType?: PropertyType
    access?: Partial<AddressAccessDetails>
  }
  schedule?: {
    dateChoice?: 'today' | 'tomorrow' | 'custom'
    customDate?: string
    timeWindow?: string
  }
  selectedOption?: UrgencyLevel
}

export type FormValidationResult = {
  ok: boolean
  errors: string[]
  normalized?: Required<CustomerRequestFormInput> & {
    address: Required<NonNullable<CustomerRequestFormInput['address']>> & { access: AddressAccessDetails }
    schedule: Required<NonNullable<CustomerRequestFormInput['schedule']>>
  }
}

const validIssues = new Set<string>(AIR_CONDITIONING_ISSUES.map((issue) => issue.slug))
const validTimeSince = new Set<string>(['today', 'days', 'weeks', 'months'])
const validPropertyTypes = new Set<string>(['house', 'apartment', 'commercial', 'office'])
const validDateChoices = new Set<string>(['today', 'tomorrow', 'custom'])
const validOptions = new Set<string>(['flexible', 'priority'])

function clean(value?: string): string { return (value ?? '').trim() }

export function validateCustomerRequestForm(input: CustomerRequestFormInput): FormValidationResult {
  const errors: string[] = []
  if (!input.issue || !validIssues.has(input.issue)) errors.push('issue_required')
  if (!input.timeSince || !validTimeSince.has(input.timeSince)) errors.push('time_since_required')

  const photosCount = input.photosCount ?? 0
  const videosCount = input.videosCount ?? 0
  if (photosCount < 0 || photosCount > 5) errors.push('photos_count_invalid')
  if (videosCount < 0 || videosCount > 1) errors.push('videos_count_invalid')

  const address = input.address ?? {}
  if (!clean(address.street)) errors.push('street_required')
  if (!clean(address.number)) errors.push('number_required')
  if (!clean(address.city)) errors.push('city_required')
  if (!clean(address.province)) errors.push('province_required')
  if (!address.propertyType || !validPropertyTypes.has(address.propertyType)) errors.push('property_type_required')

  const schedule = input.schedule ?? {}
  if (!schedule.dateChoice || !validDateChoices.has(schedule.dateChoice)) errors.push('date_choice_required')
  if (schedule.dateChoice === 'custom' && !clean(schedule.customDate)) errors.push('custom_date_required')
  if (!schedule.timeWindow || !TIME_WINDOWS.includes(schedule.timeWindow)) errors.push('time_window_required')
  if (!input.selectedOption || !validOptions.has(input.selectedOption)) errors.push('price_option_required')

  if (errors.length) return { ok: false, errors }

  return {
    ok: true,
    errors: [],
    normalized: {
      issue: input.issue!,
      timeSince: input.timeSince!,
      photosCount,
      videosCount,
      selectedOption: input.selectedOption!,
      address: {
        street: clean(address.street),
        number: clean(address.number),
        floor: clean(address.floor),
        apartment: clean(address.apartment),
        city: clean(address.city),
        province: clean(address.province),
        propertyType: address.propertyType!,
        access: {
          hasElevator: Boolean(address.access?.hasElevator),
          hasParking: Boolean(address.access?.hasParking),
          stairsRequired: Boolean(address.access?.stairsRequired),
          outdoorUnitAtHeight: Boolean(address.access?.outdoorUnitAtHeight),
          outdoorUnitOnBalcony: Boolean(address.access?.outdoorUnitOnBalcony),
          difficultAccess: Boolean(address.access?.difficultAccess)
        }
      },
      schedule: {
        dateChoice: schedule.dateChoice!,
        customDate: clean(schedule.customDate),
        timeWindow: schedule.timeWindow!
      }
    }
  }
}

export function customerFormCompletionPercent(input: CustomerRequestFormInput): number {
  const checks = [
    Boolean(input.issue),
    Boolean(input.timeSince),
    Boolean(clean(input.address?.street) && clean(input.address?.number)),
    Boolean(input.address?.propertyType),
    Boolean(input.schedule?.dateChoice && input.schedule?.timeWindow),
    Boolean(input.selectedOption)
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}
