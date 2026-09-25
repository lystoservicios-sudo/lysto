import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ConnectedProfessionalOnboarding } from '@/components/pro/connected-professional-onboarding'
import type { OnboardingContext } from '@/lib/professional/onboarding-context'

const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('@/lib/http/private-client', () => ({ privateRequest: mocks.request, requestError: String }))
vi.mock('@/components/payments/marketplace-account', () => ({ MarketplaceAccount: () => <p>Vincular Mercado Pago</p> }))
vi.mock('@/components/customer/media-uploader', () => ({ MediaUploader: () => <p>Subir documento</p> }))
afterEach(() => { cleanup(); mocks.request.mockReset() })

const application = {
  professionalId: '96000000-0000-4000-8000-000000000001', version: 1, status: 'form_started' as const,
  email: 'ana@example.com', firstName: 'Ana', lastName: 'Pérez', phone: '', dni: '', cuil: '', address: '',
  birthdate: '', yearsExperience: 0, licenseNumber: '', licenseEntity: '', hasMobility: false,
  mobilityType: '', bio: '', categoryIds: [], zoneIds: [], tools: [], availability: []
}
const initial: OnboardingContext = {
  application, requirements: null, documents: [], eligible: false, decisionReason: null,
  catalog: { categories: [], zones: [] }, legal: null
}

it('saves the personal step before showing work settings', async () => {
  mocks.request.mockImplementation(async (url: string) => url === '/api/professional/onboarding'
    ? { ...application, phone: '1122334455', dni: '12345678', version: 2 }
    : url === '/api/professional/onboarding/address'
      ? { ...application, phone: '1122334455', dni: '12345678', address: 'Calle Falsa 123, CABA', version: 3 }
      : { ...initial, application: { ...application, phone: '1122334455', dni: '12345678', address: 'Calle Falsa 123, CABA', version: 3 } })
  render(<ConnectedProfessionalOnboarding initial={initial} />)
  expect(screen.getByText('Datos personales y domicilio')).toBeTruthy()
  expect(screen.queryByText('Herramientas disponibles')).toBeNull()
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '1122334455' } })
  fireEvent.change(screen.getByLabelText('DNI'), { target: { value: '12345678' } })
  fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Calle Falsa 123, CABA' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
  await waitFor(() => expect(screen.getByText('Actividad y disponibilidad')).toBeTruthy())
  expect(mocks.request).toHaveBeenCalledWith('/api/professional/onboarding', 'POST', expect.objectContaining({
    phone: '1122334455', dni: '12345678', expectedVersion: 1
  }))
  expect(mocks.request).toHaveBeenCalledWith('/api/professional/onboarding/address', 'POST', {
    address: 'Calle Falsa 123, CABA', expectedVersion: 2
  })
})
