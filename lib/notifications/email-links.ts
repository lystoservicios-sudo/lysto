import { z } from 'zod'

const jobIdSchema = z.string().uuid()

export function notificationOrigin(value: string): string {
  const url = new URL(value)
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)))
  )
    throw new Error('invalid_notification_origin')
  return url.origin
}

export function emailJobLinks(baseUrl: string, rawJobId: string) {
  const origin = notificationOrigin(baseUrl)
  const jobId = jobIdSchema.parse(rawJobId)
  const detail = new URL(`/app/trabajos/${jobId}`, origin).href
  return {
    detail,
    directions: `${detail}#agenda`,
    reschedule: `${detail}#reprogramacion`,
    contact: `${detail}#contacto`,
    review: new URL(`/app/trabajos/${jobId}/review`, origin).href
  }
}
