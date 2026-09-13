import { notFound } from 'next/navigation'
import { ConnectedNotificationDeliveries } from '@/components/admin/connected-notification-deliveries'
import { requirePageSession } from '@/lib/auth/session'
import { listNotificationDeliveries } from '@/lib/notifications/operations'

export default async function Page() {
  const session = await requirePageSession('admin')
  if (!session.permissions.some((value) => value === 'operations' || value === 'owner')) notFound()
  return <ConnectedNotificationDeliveries initial={await listNotificationDeliveries(session)} />
}
