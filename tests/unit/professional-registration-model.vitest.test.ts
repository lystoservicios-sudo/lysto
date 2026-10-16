import { describe, expect, it } from 'vitest'
import type { OnboardingContext } from '@/lib/professional/onboarding-context'
import {
  initialRegistrationStep,
  latestRegistrationDocument,
  registrationDocumentStatus,
  registrationState,
  registrationSteps,
  requiredRegistrationDocuments,
  validateRegistrationStep,
  type RegistrationAccount
} from '@/lib/professional/registration-model'

const category = '96000000-0000-4000-8000-000000000002'
const zone = '96000000-0000-4000-8000-000000000003'
const today = '2026-10-15'
const account: RegistrationAccount = { configured: true, linked: true, mode: 'live' }
function context(): OnboardingContext {
  return {
    application: {
      professionalId: '96000000-0000-4000-8000-000000000001', version: 1,
      status: 'form_started', email: 'ana@example.com', firstName: 'Ana', lastName: 'Pérez',
      phone: '1122334455', dni: '12345678', cuil: '27123456789', birthdate: '1990-08-10',
      address: 'Calle Falsa 123', yearsExperience: 3, licenseNumber: 'MAT-123', licenseEntity: 'Entidad',
      hasMobility: false, mobilityType: '', bio: '', categoryIds: [category], zoneIds: [zone],
      tools: ['multimeter'], availability: [{ weekday: 1, startTime: '09:00', endTime: '17:00' }]
    },
    requirements: {
      testOnly: false, policies: [{ categoryId: category, version: '2026-1',
        requiredDocuments: ['identity_front', 'insurance'], expiryDocuments: ['insurance'],
        requiredTools: ['multimeter'], minExperience: 2, requiresLicense: true }]
    },
    documents: ['identity_front', 'identity_back', 'license', 'insurance'].map((documentType, i) => ({
      id: `96000000-0000-4000-8000-00000000001${i}`, documentType, status: 'pending' as const,
      version: 1, expiresAt: null, reviewedBy: null, reviewedAt: null, reason: null,
      inSubmission: false, createdAt: '2026-10-14T00:00:00Z'
    })),
    eligible: false, decisionReason: null, avatarUrl: 'https://example.com/avatar.webp',
    catalog: { categories: [{ id: category, name: 'Aire acondicionado' }], zones: [{ id: zone, name: 'Palermo' }] },
    legal: { termsVersion: 'v1', privacyVersion: 'v1', termsUrl: 'https://example.com/terminos',
      privacyUrl: 'https://example.com/privacidad', testOnly: false }
  }
}

describe('technician registration steps', () => {
  it('has seven distinct ordered groups without combining zones with hours', () => {
    expect(registrationSteps).toEqual(['Tus datos', 'Tu oficio', 'Dónde trabajás', 'Tus horarios', 'Foto y documentos', 'Revisá tu postulación', 'Vinculá tus cobros'])
  })

  it('accepts complete personal information and formats phone digits only for length', () => {
    const c = context()
    expect(validateRegistrationStep(0, { ...c.application, phone: '+54 (11) 2233-4455' }, c, today)).toEqual({})
  })

  it('reports every missing personal field next to its own input', () => {
    const c = context()
    const errors = validateRegistrationStep(0, { ...c.application, firstName: ' ', lastName: '', phone: '123', dni: 'ABC', cuil: '123', birthdate: '', address: '123' }, c, today)
    expect(Object.keys(errors).sort()).toEqual(['address', 'birthdate', 'cuil', 'dni', 'firstName', 'lastName', 'phone'])
  })

  it.each(['2026-10-15', '2026-10-16', '2026-02-30', 'not-a-date'])('rejects birthdate %s rather than accepting today, future or rollover dates', birthdate => {
    const c = context()
    expect(validateRegistrationStep(0, { ...c.application, birthdate }, c, today)).toHaveProperty('birthdate')
  })

  it('uses only the selected specialty policy for minimum experience and tools', () => {
    const c = context()
    c.requirements!.policies.push({ ...c.requirements!.policies[0], categoryId: zone, requiredTools: ['ladder'], minExperience: 50 })
    expect(validateRegistrationStep(1, c.application, c, today)).toEqual({})
    expect(validateRegistrationStep(1, { ...c.application, yearsExperience: 1, tools: [] }, c, today)).toMatchObject({
      yearsExperience: expect.any(String), tools: expect.any(String)
    })
  })

  it('requires modern invited license data and a selected active specialty', () => {
    const c = context()
    expect(validateRegistrationStep(1, { ...c.application, categoryIds: [], licenseNumber: '', licenseEntity: '' }, c, today)).toMatchObject({ categoryIds: expect.any(String), licenseNumber: expect.any(String), licenseEntity: expect.any(String) })
    expect(validateRegistrationStep(1, { ...c.application, categoryIds: [zone] }, c, today)).toHaveProperty('categoryIds')
    expect(validateRegistrationStep(1, { ...c.application, categoryIds: [category, category] }, c, today)).toHaveProperty('categoryIds')
  })

  it('can save a newly selected specialty before loading its persisted policy', () => {
    const c = context()
    c.requirements = null
    expect(validateRegistrationStep(1, c.application, c, today)).toEqual({})
    expect(validateRegistrationStep(5, c.application, c, today)).toHaveProperty('requirements')
  })

  it('validates active nonduplicate zones and mobility only when selected', () => {
    const c = context()
    expect(validateRegistrationStep(2, c.application, c, today)).toEqual({})
    expect(validateRegistrationStep(2, { ...c.application, zoneIds: [category] }, c, today)).toHaveProperty('zoneIds')
    expect(validateRegistrationStep(2, { ...c.application, zoneIds: [zone, zone] }, c, today)).toHaveProperty('zoneIds')
    expect(validateRegistrationStep(2, { ...c.application, hasMobility: true }, c, today)).toHaveProperty('mobilityType')
    expect(validateRegistrationStep(2, { ...c.application, hasMobility: false }, c, today)).not.toHaveProperty('mobilityType')
  })

  it.each([
    [],
    [{ weekday: 1, startTime: '17:00', endTime: '09:00' }],
    [{ weekday: 7, startTime: '09:00', endTime: '17:00' }],
    [{ weekday: 1, startTime: '29:00', endTime: '30:00' }],
    [{ weekday: 1, startTime: '09:00', endTime: '17:00' }, { weekday: 1, startTime: '16:00', endTime: '18:00' }],
    [{ weekday: 1, startTime: '09:00', endTime: '17:00' }, { weekday: 1, startTime: '09:00', endTime: '17:00' }],
    Array.from({ length: 51 }, () => ({ weekday: 1, startTime: '09:00', endTime: '17:00' }))
  ].map(availability => ({ availability })))('rejects missing, invalid, overlapping, duplicate or excessive availability %#', ({ availability }) => {
    const c = context()
    expect(validateRegistrationStep(3, { ...c.application, availability }, c, today)).toHaveProperty('availability')
  })

  it('permits adjacent hours and matching hours on different days without mutating input', () => {
    const c = context()
    const availability = [{ weekday: 1, startTime: '09:00', endTime: '12:00' }, { weekday: 1, startTime: '12:00', endTime: '17:00' }, { weekday: 2, startTime: '09:00', endTime: '12:00' }]
    const copy = JSON.stringify(availability)
    expect(validateRegistrationStep(3, { ...c.application, availability }, c, today)).toEqual({})
    expect(JSON.stringify(availability)).toBe(copy)
  })
})

describe('registration evidence and submit review', () => {
  it('unites baseline modern invitation evidence with selected policy documents only', () => {
    const c = context()
    c.requirements!.policies.push({ ...c.requirements!.policies[0], categoryId: zone, requiredDocuments: ['tax'] })
    expect(requiredRegistrationDocuments(c)).toEqual(['identity_front', 'identity_back', 'license', 'insurance'])
  })

  it('does not ask the applicant for a reviewer-only expiry date on a pending document', () => {
    const c = context()
    expect(validateRegistrationStep(4, c.application, c, today)).toEqual({})
    expect(registrationDocumentStatus(c.documents[3], today)).toBe('pending')
  })

  it('does not mistake a private identity attachment for the public profile photo', () => {
    const c = context()
    c.avatarUrl = null
    expect(validateRegistrationStep(4, c.application, c, today)).toHaveProperty('avatarUrl')
  })

  it('uses the newest upload by creation and id, not the old reviewed document version', () => {
    const c = context()
    const older = { ...c.documents[0], status: 'approved' as const, version: 10 }
    const newer = { ...older, id: '96000000-0000-4000-8000-000000000099', version: 1, status: 'rejected' as const, createdAt: '2026-10-15T00:00:00Z' }
    c.documents = [older, newer, ...c.documents.slice(1)]
    expect(latestRegistrationDocument(c, 'identity_front')).toEqual(newer)
    expect(validateRegistrationStep(4, c.application, c, today)).toHaveProperty('documents.identity_front')
    c.documents[1] = { ...newer, status: 'pending' }
    expect(validateRegistrationStep(4, c.application, c, today)).not.toHaveProperty('documents.identity_front')
  })

  it('breaks equal creation timestamp ties by id exactly like the server', () => {
    const c = context()
    const highId = { ...c.documents[0], id: '96000000-0000-4000-8000-000000000099', status: 'rejected' as const }
    c.documents.push(highId)
    expect(latestRegistrationDocument(c, 'identity_front')).toEqual(highId)
  })

  it('requires missing documents and rejects expired or malformed known validity dates', () => {
    const c = context()
    c.documents = c.documents.filter(d => d.documentType !== 'identity_front')
    c.documents[0].expiresAt = today
    c.documents[1].expiresAt = 'bad-date'
    expect(validateRegistrationStep(4, c.application, c, today)).toMatchObject({
      'documents.identity_front': expect.any(String), 'documents.identity_back': expect.any(String), 'documents.license': expect.any(String)
    })
    expect(registrationDocumentStatus(undefined, today)).toBe('missing')
    expect(registrationDocumentStatus({ ...c.documents[0], expiresAt: '2026-10-16' }, today)).toBe('pending')
  })

  it('requires reviewed validity for approved policy documents that expire', () => {
    const c = context()
    c.documents[3].status = 'approved'
    expect(validateRegistrationStep(4, c.application, c, today)).toHaveProperty('documents.insurance')
    c.documents[3].expiresAt = '2027-10-15'
    expect(validateRegistrationStep(4, c.application, c, today)).not.toHaveProperty('documents.insurance')
  })

  it('rechecks all saved data and the exact current policy and legal versions before submission', () => {
    const c = context()
    expect(validateRegistrationStep(5, c.application, c, today)).toEqual({})
    c.legal = null
    c.requirements!.policies[0].version = ''
    expect(validateRegistrationStep(5, { ...c.application, phone: '' }, c, today)).toMatchObject({ phone: expect.any(String), requirements: expect.any(String), legal: expect.any(String) })
    c.requirements = { testOnly: false, policies: [] }
    expect(validateRegistrationStep(5, c.application, c, today)).toHaveProperty('requirements')
  })
})

describe('saved progress and independent account / review states', () => {
  it.each([
    ['phone', '', 0], ['licenseNumber', '', 1], ['zoneIds', [], 2], ['availability', [], 3]
  ] as const)('resumes at the first incomplete saved group: %s', (field, value, expected) => {
    const c = context()
    c.application = { ...c.application, [field]: value }
    expect(initialRegistrationStep(c)).toBe(expected)
  })

  it('resumes missing/rejected documents at evidence and completed data at review', () => {
    const c = context()
    expect(initialRegistrationStep(c)).toBe(5)
    c.documents[0].status = 'rejected'
    expect(initialRegistrationStep(c)).toBe(4)
  })

  it.each(['form_submitted', 'under_review', 'approved'] as const)('never reopens submitted or approved data for %s', status => {
    const c = context()
    c.application = { ...c.application, status, phone: '' }
    expect(initialRegistrationStep(c)).toBe(6)
  })

  it('projects editing and correction states independently from payment linking', () => {
    const c = context()
    expect(registrationState(c, account)).toBe('editing')
    c.application.status = 'invited'
    expect(registrationState(c, null)).toBe('editing')
    c.application.status = 'rejected'
    expect(registrationState(c, account)).toBe('corrections')
  })

  it.each(['form_submitted', 'under_review'] as const)('keeps linked %s under review rather than claiming work access', status => {
    const c = context()
    c.application.status = status
    c.readyForNewWork = true
    expect(registrationState(c, account)).toBe('review')
    expect(registrationState(c, { ...account, linked: false })).toBe('linking')
  })

  it('requires canonical work readiness and a confirmed account, not just eligible or approved', () => {
    const c = context()
    c.application.status = 'approved'
    c.eligible = true
    expect(registrationState(c, account)).toBe('approved_pending')
    c.readyForNewWork = true
    expect(registrationState(c, null)).toBe('approved_pending')
    expect(registrationState(c, { configured: false, linked: null })).toBe('approved_pending')
    expect(registrationState(c, account)).toBe('ready')
  })

  it.each(['form_submitted', 'under_review', 'approved'] as const)('never marks test-mode payments complete for %s', status => {
    const c = context()
    c.application.status = status
    c.readyForNewWork = true
    expect(registrationState(c, { ...account, mode: 'test' })).toBe(status === 'approved' ? 'approved_pending' : 'linking')
  })

  it.each(['suspended', 'inactive'] as const)('cannot override %s with stale eligibility or account readiness', status => {
    const c = context()
    c.application.status = status
    c.eligible = true
    c.readyForNewWork = true
    expect(registrationState(c, account)).toBe(status)
  })

  it('fails closed when registration context is unavailable', () => {
    expect(registrationState(null, account)).toBe('unavailable')
  })
})
