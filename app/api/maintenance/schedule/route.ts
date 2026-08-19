import { NextResponse } from 'next/server'
import type { MaintenanceOption } from '@/lib/domain/types'
import { calculateDueDate, getMaintenanceTask, shouldCreateMaintenanceReminder } from '@/lib/customer/maintenance-plan'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { equipmentId?: string; option?: MaintenanceOption } | null
  if (!body?.equipmentId || !body.option) return NextResponse.json({ error: 'Invalid maintenance payload' }, { status: 400 })
  const task = getMaintenanceTask(body.option)
  return NextResponse.json({ shouldCreate: shouldCreateMaintenanceReminder(body.option), dueDate: calculateDueDate(body.option), task, status: 'ready_for_notification_event_insert' })
}
