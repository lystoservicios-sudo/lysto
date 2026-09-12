import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConnectedProfessionalOnboarding } from '@/components/pro/connected-professional-onboarding'
import type { OnboardingContext } from '@/lib/professional/onboarding-context'

it('keeps a server-rendered draft disabled until event handlers can preserve edits', () => {
  const initial: OnboardingContext = {
    application: {
      professionalId: '96000000-0000-4000-8000-000000000001',
      version: 1,
      status: 'form_started',
      email: 'onboarding@lysto.test',
      firstName: '',
      lastName: '',
      phone: '',
      dni: '',
      cuil: '',
      birthdate: '',
      yearsExperience: 0,
      licenseNumber: '',
      licenseEntity: '',
      hasMobility: false,
      mobilityType: '',
      bio: 'Texto persistido',
      categoryIds: [],
      zoneIds: [],
      tools: [],
      availability: []
    },
    requirements: null,
    documents: [],
    eligible: false,
    decisionReason: null,
    catalog: { categories: [], zones: [] },
    legal: null
  }
  const element = document.createElement('div')
  element.innerHTML = renderToStaticMarkup(<ConnectedProfessionalOnboarding initial={initial} />)
  expect(element.querySelector('textarea')?.closest('fieldset')?.disabled).toBe(true)
})
