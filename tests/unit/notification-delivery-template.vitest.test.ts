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
    expect(message.subject).toBe('Terminá de crear tu cuenta profesional en Lysto')
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
  it('renders a rich confirmed visit without exposing direct contact data', () => {
    const message = renderOutboxNotification(
      {
        eventType: 'visit.confirmed',
        aggregateId: id,
        audience: 'customer',
        scheduleVersion: 3,
        startsAt: '2026-09-18T13:00:00.000Z',
        endsAt: '2026-09-18T15:00:00.000Z',
        timezone: 'America/Argentina/Buenos_Aires',
        serviceName: 'Aire <acondicionado>',
        professionalName: 'Martín R.',
        addressLabel: 'Av. Siempre Viva 742, Buenos Aires'
      },
      origin
    )
    expect(message.version).toBe('transactional-v2')
    expect(message.subject).toBe('Tu visita con Lysto está confirmada')
    expect(message.text).toContain('18 de septiembre de 2026')
    expect(message.text).toContain('10:00–12:00')
    expect(message.text).toContain('Aire <acondicionado>')
    expect(message.html).toContain('Aire &lt;acondicionado&gt;')
    expect(message.text).toContain('Martín R.')
    expect(message.text).toContain('Av. Siempre Viva 742, Buenos Aires')
    expect(message.html).toContain(`${origin}/app/trabajos/${id}#agenda`)
    expect(message.html).toContain(`${origin}/app/trabajos/${id}#reprogramacion`)
    expect(message.html).toContain(`${origin}/app/trabajos/${id}#contacto`)
    expect(message.html).not.toMatch(/tel:|<script|onerror=/i)
  })
  it('renders an optional authenticated review request', () => {
    const message = renderOutboxNotification(
      { eventType: 'review.requested', aggregateId: id, audience: 'customer' },
      origin
    )
    expect(message.version).toBe('transactional-v2')
    expect(message.subject).toBe('¿Cómo salió tu servicio?')
    expect(message.url).toBe(`${origin}/app/trabajos/${id}/review`)
    expect(message.text).toMatch(/opcional/i)
    expect(message.text).toMatch(/no cambia.*pago/i)
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
