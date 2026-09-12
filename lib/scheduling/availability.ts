import { TIME_WINDOWS } from '../domain/constants.ts'

export type TimeWindow = (typeof TIME_WINDOWS)[number]
export type DateChoice = 'today' | 'tomorrow' | 'custom'

export type ScheduleInput = {
  dateChoice: DateChoice
  customDate?: string
  timeWindow: string
  now?: Date
}

export type NormalizedSchedule = {
  scheduledDate: string
  timeWindow: TimeWindow
  isSameDay: boolean
}

export const SCHEDULING_TIMEZONE = 'America/Argentina/Buenos_Aires' as const

export type VisitInterval = {
  startsAt: string
  endsAt: string
  bufferMinutes?: number
}

export type WeeklyAvailability = {
  weekday: number
  startTime: string
  endTime: string
}

type BuiltVisitInterval = VisitInterval & {
  localDate: string
  timezone: typeof SCHEDULING_TIMEZONE
}

function parseLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('invalid_local_datetime')
  const [, year, month, day] = match.map(Number)
  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  )
    throw new Error('invalid_local_datetime')
  return candidate
}

function minutesOfDay(value: string) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value)
  if (!match) throw new Error('invalid_local_datetime')
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) throw new Error('invalid_local_datetime')
  return hours * 60 + minutes
}

/** Argentina uses UTC-03 and has had no clock changes since 2009. */
export function buildVisitInterval(input: {
  localDate: string
  localTime: string
  durationMinutes: number
}): BuiltVisitInterval {
  parseLocalDate(input.localDate)
  minutesOfDay(input.localTime)
  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < 30 ||
    input.durationMinutes > 480
  )
    throw new Error('invalid_duration')
  const startsAt = new Date(`${input.localDate}T${input.localTime}:00-03:00`)
  if (Number.isNaN(startsAt.getTime())) throw new Error('invalid_local_datetime')
  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000)
  return {
    localDate: input.localDate,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    timezone: SCHEDULING_TIMEZONE
  }
}

export function assertFutureVisit(startsAt: string, now = new Date()) {
  const instant = Date.parse(startsAt)
  if (!Number.isFinite(instant) || instant < now.getTime()) throw new Error('visit_in_past')
}

export function intervalsConflict(first: VisitInterval, second: VisitInterval) {
  const firstStart = Date.parse(first.startsAt) - (first.bufferMinutes ?? 0) * 60_000
  const firstEnd = Date.parse(first.endsAt) + (first.bufferMinutes ?? 0) * 60_000
  const secondStart = Date.parse(second.startsAt) - (second.bufferMinutes ?? 0) * 60_000
  const secondEnd = Date.parse(second.endsAt) + (second.bufferMinutes ?? 0) * 60_000
  if (![firstStart, firstEnd, secondStart, secondEnd].every(Number.isFinite))
    throw new Error('invalid_interval')
  return firstStart < secondEnd && secondStart < firstEnd
}

function localDateTimeParts(instant: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHEDULING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(instant))
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    minutes: Number(value('hour')) * 60 + Number(value('minute'))
  }
}

export function isWithinWeeklyAvailability(
  visit: BuiltVisitInterval,
  availability: WeeklyAvailability[]
) {
  const starts = localDateTimeParts(visit.startsAt)
  const ends = localDateTimeParts(visit.endsAt)
  if (starts.date !== visit.localDate || ends.date !== visit.localDate) return false
  const weekday = parseLocalDate(visit.localDate).getUTCDay()
  return availability.some(
    (window) =>
      window.weekday === weekday &&
      starts.minutes >= minutesOfDay(window.startTime) &&
      ends.minutes <= minutesOfDay(window.endTime)
  )
}

const TIME_WINDOW_SET = new Set<string>(TIME_WINDOWS)

export function isValidTimeWindow(value: string): value is TimeWindow {
  return TIME_WINDOW_SET.has(value)
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export function normalizeSchedule(input: ScheduleInput): NormalizedSchedule {
  const now = input.now ?? new Date()
  if (!isValidTimeWindow(input.timeWindow)) {
    throw new Error('Franja horaria inválida')
  }

  let scheduledDate: string
  if (input.dateChoice === 'today') scheduledDate = toISODate(now)
  else if (input.dateChoice === 'tomorrow') scheduledDate = toISODate(addDays(now, 1))
  else {
    if (!input.customDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.customDate)) {
      throw new Error('Fecha personalizada inválida')
    }
    scheduledDate = input.customDate
  }

  const today = toISODate(now)
  if (scheduledDate < today) throw new Error('No se puede agendar en una fecha pasada')

  return {
    scheduledDate,
    timeWindow: input.timeWindow,
    isSameDay: scheduledDate === today
  }
}

export function deriveUrgencyFromSchedule(schedule: NormalizedSchedule): 'flexible' | 'priority' {
  return schedule.isSameDay ? 'priority' : 'flexible'
}
