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
