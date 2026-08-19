import { NextResponse } from 'next/server'
import { buildNotificationTemplate, type NotificationTemplateInput } from '@/lib/notifications/templates'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as NotificationTemplateInput | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  const template = buildNotificationTemplate(body)
  return NextResponse.json({ template, persistence: 'Insert notification_events/notifications and enqueue email/WhatsApp provider when configured.' })
}
