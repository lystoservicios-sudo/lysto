import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AIR_CONDITIONING_ISSUES } from '@/lib/domain/constants'
import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'
import { createRequestDraft, requestDraftReducer } from '@/features/service-request/request-draft'
import { readRequestDraft, storePendingPayment, storeRequestDraft } from '@/features/service-request/request-flow-client'
import type { CustomerHomesSnapshot } from '@/lib/customer-homes/contracts'
import type { ServiceIssueSlug } from '@/lib/domain/types'

const mocks = vi.hoisted(() => ({ session: vi.fn(), homes: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ requirePageSession: mocks.session }))
vi.mock('@/lib/customer-homes/service', () => ({ readCustomerHomes: mocks.homes }))

import RequestAirConditioningPage from '../../app/(customer)/app/solicitar/aire-acondicionado/page'

const authority = { role: 'customer', profileId: 'current-customer', customerId: '20000000-0000-4000-8000-000000000001' }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue(authority)
  window.sessionStorage.clear()
  mocks.homes.mockResolvedValue({ homes: [], addresses: [], equipment: [] })
})
afterEach(cleanup)

const airA = '20000000-0000-4000-8000-000000000010'
const airB = '20000000-0000-4000-8000-000000000011'
function entryInventory(): CustomerHomesSnapshot {
  const equipment = { addressId: null, equipmentType: 'inverter' as const, brand: null, model: null, serialNumber: null, frigorias: '3000', version: 1, createdAt: '2026-10-14T12:00:00Z', archivedAt: null }
  return { homes: [], addresses: [], equipment: [{ ...equipment, id: airA, nickname: 'Aire A' }, { ...equipment, id: airB, nickname: 'Aire B' }] }
}
function retainOldDraft() {
  storeRequestDraft(requestDraftReducer(createRequestDraft(authority.customerId, airA), { type: 'issue', issue: 'pierde_agua' }))
}
function retainReviewDraft(issue: ServiceIssueSlug = 'pierde_agua', equipmentId = airA) {
  let draft = createRequestDraft(authority.customerId, equipmentId)
  draft = requestDraftReducer(draft, issue === 'mantenimiento' || issue === 'instalacion'
    ? { type: 'purpose', purpose: issue === 'mantenimiento' ? 'maintenance' : 'installation' }
    : { type: 'issue', issue })
  draft = requestDraftReducer(draft, { type: 'schedule', schedule: { preferredDate: '2026-12-01', preferredTimeWindow: '09:00 - 12:00', urgency: 'flexible' } })
  draft = requestDraftReducer(draft, { type: 'go-step', step: 'review' })
  storeRequestDraft(draft)
  return draft
}

describe('explicit request entry versus saved draft', () => {
  it('preserves the review draft when the same equipment shortcut remains after a reload', () => {
    const saved = retainReviewDraft()
    const props = { customerId: authority.customerId, initialData: entryInventory(), initialEquipmentId: airA }
    const first = render(<AirConditioningWizard {...props} />)
    expect(screen.getByRole('heading', { name: 'Revisá tu pedido' })).toBeTruthy()
    first.unmount()
    render(<AirConditioningWizard {...props} />)
    expect(screen.getByRole('heading', { name: 'Revisá tu pedido' })).toBeTruthy()
    expect(readRequestDraft(authority.customerId)).toEqual(saved)
    expect((screen.getByRole('button', { name: 'Pagar con Mercado Pago' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it.each(AIR_CONDITIONING_ISSUES)('restores review for the same equipment and $slug shortcut without restoring a price', ({ slug }) => {
    const saved = retainReviewDraft(slug)
    render(<AirConditioningWizard customerId={authority.customerId} initialData={entryInventory()} initialEquipmentId={airA} initialIssue={slug} />)
    expect(screen.getByRole('heading', { name: 'Revisá tu pedido' })).toBeTruthy()
    expect(readRequestDraft(authority.customerId)).toEqual(saved)
    expect((screen.getByRole('button', { name: 'Pagar con Mercado Pago' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('restores the matching issue shortcut for the selected air rather than switching to the first air', () => {
    const saved = retainReviewDraft('pierde_agua', airB)
    render(<AirConditioningWizard customerId={authority.customerId} initialData={entryInventory()} initialIssue="pierde_agua" />)
    expect(screen.getByRole('heading', { name: 'Revisá tu pedido' })).toBeTruthy()
    expect(readRequestDraft(authority.customerId)).toEqual(saved)
  })
  it('starts a new issue on the same equipment instead of restoring another service draft', () => {
    retainReviewDraft()
    render(<AirConditioningWizard customerId={authority.customerId} initialData={entryInventory()} initialEquipmentId={airA} initialIssue="no_enfria" />)
    expect(screen.getByText(/Paso 1 de 7/)).toBeTruthy()
    expect(readRequestDraft(authority.customerId)?.answersByEquipment[airA]).toMatchObject({ issue: 'no_enfria', schedule: null })
  })
  it('does not restore another actor review even when equipment and issue shortcut strings match', () => {
    retainReviewDraft()
    const otherActor = '20000000-0000-4000-8000-000000000002'
    render(<AirConditioningWizard customerId={otherActor} initialData={entryInventory()} initialEquipmentId={airA} initialIssue="pierde_agua" />)
    expect(screen.getByText(/Paso 1 de 7/)).toBeTruthy()
    expect(readRequestDraft(otherActor)?.answersByEquipment[airA]).toMatchObject({ issue: 'pierde_agua', schedule: null })
  })
  it('opens the explicitly chosen equipment rather than an unfinished draft for another air', () => {
    retainOldDraft()
    render(<AirConditioningWizard customerId={authority.customerId} initialData={entryInventory()} initialEquipmentId={airB} />)
    expect(screen.getByRole('heading', { name: 'Aire B' })).toBeTruthy()
    expect(readRequestDraft(authority.customerId)?.selectedEquipmentId).toBe(airB)
  })
  it('opens the new explicit problem rather than the old problem in a saved draft', () => {
    retainOldDraft()
    render(<AirConditioningWizard customerId={authority.customerId} initialData={entryInventory()} initialIssue="no_enfria" />)
    expect(screen.getByRole('radio', { name: /No enfría/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: /Pierde agua/ }).getAttribute('aria-checked')).toBe('false')
  })
  it('still restores an unfinished draft when no explicit shortcut is supplied', () => {
    retainOldDraft()
    render(<AirConditioningWizard customerId={authority.customerId} initialData={entryInventory()} />)
    expect(screen.getByRole('heading', { name: 'Aire A' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Pierde agua/ }).getAttribute('aria-checked')).toBe('true')
  })
  it.each(['archived', 'unknown'])('does not discard an active draft for an %s equipment shortcut', kind => {
    retainOldDraft()
    const inventory = entryInventory()
    if (kind === 'archived') inventory.equipment[1].archivedAt = '2026-10-14T12:00:00Z'
    render(<AirConditioningWizard customerId={authority.customerId} initialData={inventory}
      initialEquipmentId={kind === 'archived' ? airB : '20000000-0000-4000-8000-000000000099'} />)
    expect(screen.getByRole('heading', { name: 'Aire A' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Pierde agua/ }).getAttribute('aria-checked')).toBe('true')
  })
  it('keeps a corrupt pending-payment record blocked instead of starting another request', () => {
    retainOldDraft()
    window.sessionStorage.setItem(`lysto:pedir:payment:${authority.customerId}`, '{broken')
    render(<AirConditioningWizard customerId={authority.customerId} initialData={entryInventory()} initialEquipmentId={airB} initialIssue="no_enfria" />)
    expect(readRequestDraft(authority.customerId)?.selectedEquipmentId).toBe(airA)
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('prioritizes an uncertain prepare command over a new equipment/problem shortcut', () => {
    retainOldDraft()
    storePendingPayment(authority.customerId, { previewId: '20000000-0000-4000-8000-000000000012', commandId: '20000000-0000-4000-8000-000000000013', jobId: null, checkoutId: null })
    render(<AirConditioningWizard customerId={authority.customerId} initialData={entryInventory()} initialEquipmentId={airB} initialIssue="no_enfria" />)
    expect(readRequestDraft(authority.customerId)?.selectedEquipmentId).toBe(airA)
    expect(readRequestDraft(authority.customerId)?.answersByEquipment[airA]).toMatchObject({ issue: 'pierde_agua' })
    expect(screen.getByText(/Paso 6 de 7/)).toBeTruthy()
  })
})

describe('customer request entry from Inicio', () => {
  it.each(AIR_CONDITIONING_ISSUES)('validates and selects the $title shortcut', async ({ slug, title }) => {
    render(await RequestAirConditioningPage({ searchParams: Promise.resolve({ problema: slug }) }))

    expect(screen.getByRole('radio', { name: new RegExp(title) }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText(/Paso 1 de 7/)).toBeTruthy()
    expect(mocks.session).toHaveBeenCalledWith('customer')
    expect(mocks.homes).toHaveBeenCalledWith(authority)
  })

  it.each([
    { problema: undefined },
    { problema: '' },
    { problema: 'otro_problema' },
    { problema: 'NO_ENFRIA' },
    { problema: ['no_enfria'] },
    { problema: ['no_enfria', 'mantenimiento'] }
  ])(
    'keeps the first choice empty for an invalid or repeated parameter $problema',
    async ({ problema }) => {
      render(await RequestAirConditioningPage({ searchParams: Promise.resolve({ problema }) }))

      expect(screen.getAllByRole('radio').every((option) => option.getAttribute('aria-checked') === 'false')).toBe(true)
      expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)
    }
  )

  it('passes owned home context and actor identity without forcing an owner test price', async () => {
    const data = { homes: [], addresses: [], equipment: [] }
    mocks.homes.mockResolvedValue(data)

    const page = await RequestAirConditioningPage({ searchParams: Promise.resolve({ problema: 'mantenimiento' }) })

    expect(page.props.initialData).toBe(data)
    expect(page.props.customerId).toBe(authority.customerId)
    expect(page.props.ownerMaintenanceTestCustomer).toBeUndefined()
  })

  it('does not read home inventory without an authorized customer session', async () => {
    mocks.session.mockRejectedValue(new Error('REDIRECT:/login'))

    await expect(RequestAirConditioningPage({ searchParams: Promise.resolve({ problema: 'no_enfria' }) })).rejects.toThrow('REDIRECT:/login')
    expect(mocks.homes).not.toHaveBeenCalled()
  })
})
