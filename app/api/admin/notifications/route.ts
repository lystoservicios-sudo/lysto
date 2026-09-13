import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import {
  listNotificationDeliveries,
  notificationPageQuery,
  retryNotificationDelivery
} from '@/lib/notifications/operations'

export const GET = privateRoute({ permission: 'operations' }, async (request, session) =>
  privateJson(await listNotificationDeliveries(session, notificationPageQuery(request)))
)
export const PATCH = privateRoute({ permission: 'operations' }, async (request, session) =>
  privateJson(await retryNotificationDelivery(session, await readPrivateJsonBody(request)))
)
