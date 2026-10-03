import { expect, it } from 'vitest'
import { generateTemporaryProfessionalPassword } from '@/lib/professional/temporary-password'
import { renderProfessionalTemporaryInvitation } from '@/lib/notifications/delivery-template'

it('generates a seven-digit numeric temporary password', () => {
  const password = generateTemporaryProfessionalPassword()
  expect(password).toMatch(/^\d{7}$/)
})

it('sends technicians to the team login with the unique invitation destination and temporary password', () => {
  const token = 'a'.repeat(43)
  const notice = renderProfessionalTemporaryInvitation({
    email: 'tecnico@example.com',
    invitationToken: token,
    temporaryPassword: '4827163'
  }, 'https://lystohogar.com')

  expect(notice.url).toContain('/equipo/login?')
  expect(notice.url).toContain(encodeURIComponent(`/pro/onboarding/${token}`))
  expect(notice.text).toContain('tecnico@example.com')
  expect(notice.text).toContain('4827163')
})
