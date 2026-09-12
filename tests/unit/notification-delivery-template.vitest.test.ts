import { describe, expect, it } from 'vitest'
import { renderOutboxNotification } from '@/lib/notifications/delivery-template'

const id = 'a1000000-0000-4000-8000-000000000001'
const token = 'A'.repeat(43)
const origin = 'https://app.lysto.test'
describe('versioned transactional notification templates', () => {
  it('builds a private invitation from the stored token and the configured origin', () => {
    const message = renderOutboxNotification(
      {
        eventType: 'professional.invited',
        aggregateId: id,
        audience: 'professional',
        invitationToken: token
      },
      origin
    )
    expect(message.version).toBe('transactional-v1')
    expect(message.url).toBe(`${origin}/pro/onboarding/${token}`)
    expect(message.subject).toBe('Tu invitación a Lysto')
    expect(message.text).toContain(message.url)
    expect(message.html).toContain(`href="${message.url}"`)
  })
  it('never accepts caller-controlled URLs, HTML, subjects or recipients', () => {
    expect(() =>
      renderOutboxNotification(
        {
          eventType: 'quote.ready',
          aggregateId: id,
          audience: 'customer',
          url: 'https://evil.test',
          html: '<script>alert(1)</script>'
        },
        origin
      )
    ).toThrow()
    expect(() =>
      renderOutboxNotification(
        {
          eventType: 'professional.invited',
          aggregateId: id,
          audience: 'professional',
          invitationToken: '../foreign'
        },
        origin
      )
    ).toThrow()
  })
  it('rejects unknown events and audiences that cannot open the destination', () => {
    expect(() =>
      renderOutboxNotification(
        { eventType: 'arbitrary.email', aggregateId: id, audience: 'customer' },
        origin
      )
    ).toThrow()
    expect(() =>
      renderOutboxNotification(
        { eventType: 'professional.application.submitted', aggregateId: id, audience: 'customer' },
        origin
      )
    ).toThrow()
  })
  it('links reviewed quotes to the authenticated customer panel', () => {
    const message = renderOutboxNotification(
      { eventType: 'quote.ready', aggregateId: id, audience: 'customer' },
      origin
    )
    expect(message.url).toBe(`${origin}/app/presupuestos`)
    expect(message.text).not.toContain('pago aprobado')
  })
  it('keeps operational notices inside the administrative dossier', () => {
    expect(
      renderOutboxNotification(
        {
          eventType: 'professional.application.submitted',
          aggregateId: id,
          audience: 'operations'
        },
        origin
      ).url
    ).toBe(`${origin}/admin/profesionales/${id}`)
    expect(
      renderOutboxNotification(
        { eventType: 'professional.suspended', aggregateId: id, audience: 'operations' },
        origin
      ).text
    ).not.toContain('A'.repeat(43))
  })
  it.each([
    'https://user:secret@app.lysto.test',
    'https://app.lysto.test/other',
    'javascript:alert(1)',
    'http://remote.test',
    'https://app.lysto.test?next=https://evil.test'
  ])('rejects an unsafe application origin %s', (baseUrl) => {
    expect(() =>
      renderOutboxNotification(
        { eventType: 'quote.ready', aggregateId: id, audience: 'customer' },
        baseUrl
      )
    ).toThrow()
  })
})
