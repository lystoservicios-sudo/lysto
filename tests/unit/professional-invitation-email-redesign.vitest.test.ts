import { expect, it } from 'vitest'
import { renderOutboxNotification } from '@/lib/notifications/delivery-template'

it('makes account completion the primary invitation email action', () => {
  const notice = renderOutboxNotification({ eventType: 'professional.invited',
    aggregateId: '96000000-0000-4000-8000-000000000001', audience: 'professional',
    invitationToken: 'a'.repeat(43) }, 'https://lystohogar.com')
  expect(notice.html).toContain('Terminar de crear mi cuenta')
  expect(notice.html).toContain('background:#1d4ed8')
  expect(notice.url).toContain('/pro/onboarding/')
})
