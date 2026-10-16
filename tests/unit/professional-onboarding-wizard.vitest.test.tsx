import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ConnectedProfessionalOnboarding } from '@/components/pro/connected-professional-onboarding'
import type { OnboardingContext } from '@/lib/professional/onboarding-context'
import { PrivateRequestError } from '@/lib/http/private-client'

const mocks = vi.hoisted(() => ({ request: vi.fn(), replace: vi.fn(), refresh: vi.fn(), account: { configured: true, linked: false } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('@/lib/http/private-client', async (original) => ({ ...await original<typeof import('@/lib/http/private-client')>(), privateRequest: mocks.request }))
vi.mock('@/components/pro/registration-payments', () => ({
  useRegistrationAccount: () => ({ account: mocks.account, loading: false, error: '', refresh: mocks.refresh }),
  RegistrationPayments: () => <p>Vincular Mercado Pago</p>
}))
vi.mock('@/components/customer/media-uploader', () => ({ MediaUploader: ({onFilesChange}: {onFilesChange:(files:File[])=>void}) => <button type="button" onClick={() => onFilesChange([new File(['test'], 'document.png', {type:'image/png'})])}>Elegir documento de prueba</button> }))
const category = '96000000-0000-4000-8000-000000000002'
const zone = '96000000-0000-4000-8000-000000000003'
const application = {
  professionalId: '96000000-0000-4000-8000-000000000001', version: 1, status: 'form_started' as const,
  email: 'ana@example.com', firstName: 'Ana', lastName: 'Pérez', phone: '', dni: '', cuil: '', address: '',
  birthdate: '', yearsExperience: 0, licenseNumber: '', licenseEntity: '', hasMobility: false,
  mobilityType: '', bio: '', categoryIds: [], zoneIds: [], tools: [], availability: []
}
const personal = { ...application, phone: '1122334455', dni: '12345678', cuil: '27123456789', birthdate: '1990-01-20', address: 'Calle Falsa 123, CABA' }
const initial: OnboardingContext = {
  application, requirements: null, documents: [], eligible: false, decisionReason: null,
  catalog: { categories: [{ id: category, name: 'Aire acondicionado' }], zones: [{ id: zone, name: 'Palermo' }] }, legal: null
}
function complete(): OnboardingContext {
  return { ...initial, application: { ...personal, categoryIds: [category], zoneIds: [zone], yearsExperience: 5,
    licenseNumber: '1234', licenseEntity: 'Consejo', availability: [{ weekday: 1, startTime: '09:00', endTime: '17:00' }] },
    avatarUrl: 'https://example.com/avatar.jpg',
    documents: ['identity_front', 'identity_back', 'license'].map((documentType, i) => ({
      id: `97000000-0000-4000-8000-00000000000${i}`, documentType, status: 'pending' as const, version: 1,
      expiresAt: null, reviewedBy: null, reviewedAt: null, reason: null, inSubmission: false, createdAt: '2026-09-25T00:00:00Z'
    })),
    requirements: { testOnly: false, policies: [{ categoryId: category, version: 'v1', requiredDocuments: [], expiryDocuments: [], requiredTools: [], minExperience: 0, requiresLicense: true }] },
    legal: { termsVersion: 'v1', privacyVersion: 'v1', termsUrl: 'https://example.com/terms', privacyUrl: 'https://example.com/privacy', testOnly: false }
  }
}
function transport(seed: OnboardingContext) {
  const server = structuredClone(seed)
  mocks.request.mockImplementation(async (url: string, _method?: string, body?: Record<string, unknown>) => {
    if (url === '/api/professional/onboarding') {
      const { expectedVersion, ...fields } = body!
      expect(expectedVersion).toBe(server.application.version)
      server.application = { ...server.application, ...fields, version: server.application.version + 1 }
      return { ...server.application, address: undefined }
    }
    if (url === '/api/professional/onboarding/address') {
      expect(body!.expectedVersion).toBe(server.application.version)
      server.application = { ...server.application, address: String(body!.address), version: server.application.version + 1 }
      return server.application
    }
    if (url === '/api/professional/onboarding/submit') {
      server.application = { ...server.application, status: 'form_submitted' as 'form_started', version: server.application.version + 1 }
      return server.application
    }
    return structuredClone(server)
  })
}
function fillPersonal() {
  for (const [label, value] of [['Teléfono', personal.phone], ['DNI', personal.dni], ['CUIL', personal.cuil], ['Fecha de nacimiento', personal.birthdate], ['Dirección', personal.address]]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
beforeEach(() => { mocks.account = { configured: true, linked: false }; mocks.refresh.mockResolvedValue(mocks.account); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); mocks.request.mockReset(); mocks.replace.mockReset() })

it('shows seven focused steps and saves personal data and address with successive versions', async () => {
  transport(initial)
  render(<ConnectedProfessionalOnboarding initial={initial} />)
  expect(screen.getByText('Paso 1 de 7')).toBeTruthy()
  expect(screen.getByRole('navigation', { name: 'Pasos de la postulación' })).toBeTruthy()
  fillPersonal()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Tu oficio' })).toBeTruthy())
  expect((screen.getByRole('button', { name: 'Guardar y continuar' }) as HTMLButtonElement).disabled).toBe(false)
  expect(screen.queryByRole('button', { name: /Descartar mis cambios/ })).toBeNull()
  expect(mocks.request).toHaveBeenCalledWith('/api/professional/onboarding/address', 'POST', { address: personal.address, locationProof: '', expectedVersion: 2 })
})
it('validates only the current group without requesting incomplete future groups', () => {
  render(<ConnectedProfessionalOnboarding initial={initial} />)
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
  expect(screen.getByText(/teléfono.*8 números/i)).toBeTruthy()
  expect(screen.queryByText(/Agregá al menos un horario semanal/)).toBeNull()
  expect(mocks.request).not.toHaveBeenCalled()
})
it('does not lose the confirmed version when the independent address save fails', async () => {
  transport(initial); const real = mocks.request.getMockImplementation()!; let failed = false
  mocks.request.mockImplementation(async (...args) => {
    if (args[0] === '/api/professional/onboarding/address' && !failed) { failed = true; throw new Error('No pudimos guardar el domicilio.') }
    return real(...args)
  })
  render(<ConnectedProfessionalOnboarding initial={initial} />); fillPersonal()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
  await screen.findByText('No pudimos guardar el domicilio.')
  expect((screen.getByLabelText('Dirección') as HTMLInputElement).value).toBe(personal.address)
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
  await screen.findByRole('heading', { name: 'Tu oficio' })
})
it('requires acknowledged context readback before advancing', async () => {
  transport(initial); const real = mocks.request.getMockImplementation()!
  mocks.request.mockImplementation(async (...args) => args[0] === '/api/professional/onboarding/context' ? Promise.reject(new Error('No pudimos actualizar la información.')) : real(...args))
  render(<ConnectedProfessionalOnboarding initial={initial} />); fillPersonal()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
  await screen.findByText('No pudimos actualizar la información.')
  expect(screen.getByRole('heading', { name: 'Tus datos' })).toBeTruthy()
})
it('resumes the first incomplete saved group and supports searchable selected zones', () => {
  const context = complete(); context.application.zoneIds = []
  render(<ConnectedProfessionalOnboarding initial={context} />)
  expect(screen.getByRole('heading', { name: 'Dónde trabajás' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Buscar zona'), { target: { value: 'Palermo' } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Palermo' }))
  expect(screen.getByRole('button', { name: 'Quitar Palermo' })).toBeTruthy()
})
it('keeps schedules in their own step and rejects overlapping slots', () => {
  const context = complete(); context.application.availability = []
  render(<ConnectedProfessionalOnboarding initial={context} />)
  expect(screen.getByRole('heading', { name: 'Tus horarios' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Agregar horario' }))
  fireEvent.click(screen.getByRole('button', { name: 'Agregar horario' }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
  expect(screen.getByText(/superponen|superpuestos|repetidos/i)).toBeTruthy()
  expect(mocks.request).not.toHaveBeenCalled()
})
it('shows actual review sections with precise edit links and sends versioned legal consent', async () => {
  const context = complete(); transport(context)
  render(<ConnectedProfessionalOnboarding initial={context} />)
  expect(screen.getByRole('heading', { name: 'Revisá tu postulación' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Editar Tus datos' }))
  expect(screen.getByRole('heading', { name: 'Tus datos' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Volver a revisión' }))
  await screen.findByRole('heading', { name: 'Revisá tu postulación' })
  fireEvent.click(screen.getByRole('checkbox', { name: /Leí y acepto/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Enviar postulación' }))
  await screen.findByText('Vincular Mercado Pago')
  expect(mocks.request).toHaveBeenCalledWith('/api/professional/onboarding/submit', 'POST', { expectedVersion: 1, accepted: true, termsVersion: 'v1', privacyVersion: 'v1' })
  expect(screen.queryByRole('button', { name: 'Enviar postulación' })).toBeNull()
})
it('does not confuse a submitted and connected application with approval', () => {
  const context = complete(); context.application.status = 'under_review'; mocks.account.linked = true
  render(<ConnectedProfessionalOnboarding initial={context} />)
  expect(screen.getByRole('heading', { name: 'Postulación en revisión' })).toBeTruthy()
  expect(screen.queryByText('Ya podés recibir trabajos')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Guardar y continuar' })).toBeNull()
})
it('preserves the correction reason and the existing application data', () => {
  const context = complete(); context.application.status = 'rejected'; context.decisionReason = 'La matrícula se ve cortada. Cargá una foto completa.'
  context.documents[2].status = 'rejected'; context.documents[2].reason = 'Falta la esquina superior.'
  render(<ConnectedProfessionalOnboarding initial={context} />)
  expect(screen.getByText(context.decisionReason)).toBeTruthy()
  expect(screen.getByText('Falta la esquina superior.')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Foto y documentos' })).toBeTruthy()
})
it('only renders the ready state with canonical work readiness and a verified account', () => {
  const context = complete(); context.application.status = 'approved'; context.readyForNewWork = true; mocks.account.linked = true
  render(<ConnectedProfessionalOnboarding initial={context} />)
  expect(screen.getByRole('heading', { name: 'Ya podés recibir trabajos' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Ir a mi panel' }).getAttribute('href')).toBe('/pro/dashboard')
})
it('keeps suspended applications read-only', () => {
  const context = complete(); context.application.status = 'suspended'
  render(<ConnectedProfessionalOnboarding initial={context} />)
  expect(screen.getByRole('heading', { name: 'Tu cuenta está suspendida' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Guardar y continuar' })).toBeNull()
  expect(screen.queryByText('Vincular Mercado Pago')).toBeNull()
})

it('refreshes a reviewed application into the exact correction step', async () => {
  const context = complete(); context.application.status = 'under_review'; mocks.account.linked = true
  const corrected = complete(); corrected.application.status = 'rejected'; corrected.documents[2].status = 'rejected'; corrected.decisionReason = 'Revisá la foto de matrícula.'
  mocks.request.mockResolvedValue(corrected)
  render(<ConnectedProfessionalOnboarding initial={context} />)
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }))
  await screen.findByRole('heading', { name: 'Foto y documentos' })
  expect(screen.queryByText('Vincular Mercado Pago')).toBeNull()
})
it('saves an incomplete but structurally valid draft before exiting', async () => {
  transport(initial)
  render(<ConnectedProfessionalOnboarding initial={initial} />)
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '11' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y salir' }))
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/pro/dashboard'))
  expect(mocks.request).toHaveBeenCalledWith('/api/professional/onboarding', 'POST', expect.objectContaining({ phone: '11', expectedVersion: 1 }))
})
it('removes private data and prevents another save after revoked access', async () => {
  mocks.request.mockRejectedValue(new PrivateRequestError('Tu sesión terminó.', 401))
  render(<ConnectedProfessionalOnboarding initial={initial} />); fillPersonal()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
  await screen.findByRole('heading', { name: 'Volvé a ingresar' })
  expect(screen.queryByDisplayValue('12345678')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Guardar y continuar' })).toBeNull()
})
it('copies selected day schedules without deleting unselected days', async () => {
  const context = complete(); transport(context)
  render(<ConnectedProfessionalOnboarding initial={context} />)
  fireEvent.click(screen.getByRole('button', { name: 'Editar Tus horarios' }))
  fireEvent.click(screen.getByRole('checkbox', { name: /^Mar$/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Copiar horarios' }))
  fireEvent.click(screen.getByRole('button', { name: 'Volver a revisión' }))
  await screen.findByRole('heading', { name: 'Revisá tu postulación' })
  expect(mocks.request).toHaveBeenCalledWith('/api/professional/onboarding', 'POST', expect.objectContaining({ availability: [
    { weekday: 1, startTime: '09:00', endTime: '17:00' }, { weekday: 2, startTime: '09:00', endTime: '17:00' }
  ] }))
})
it('does not overwrite new edits when a background context read finishes late', async () => {
  let resolve!: (value: OnboardingContext) => void
  mocks.request.mockImplementation(() => new Promise<OnboardingContext>((done) => { resolve = done }))
  render(<ConnectedProfessionalOnboarding initial={initial} />)
  fireEvent.focus(window)
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '1123456789' } })
  await act(async () => resolve(initial))
  expect((screen.getByLabelText('Teléfono') as HTMLInputElement).value).toBe('1123456789')
})
it('lets an approved technician complete a missing avatar without unlocking application edits', () => {
  const context = complete(); context.application.status = 'approved'; context.avatarUrl = null; context.readyForNewWork = false; context.readinessReasons = ['foto']; mocks.account.linked = true
  render(<ConnectedProfessionalOnboarding initial={context} />)
  fireEvent.click(screen.getByRole('button', { name: 'Completar foto de perfil' }))
  expect(screen.getByLabelText('Elegir foto de perfil')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Guardar y continuar' })).toBeNull()
})
it('provides real document support for approved technicians and read-only private document viewing', () => {
  const context = complete(); context.application.status = 'approved'; context.readyForNewWork = false; context.readinessReasons = ['documentos']; mocks.account.linked = true
  render(<ConnectedProfessionalOnboarding initial={context} />)
  expect(screen.getByRole('link', { name: 'Consultar revisión de documentos' }).getAttribute('href')).toBe('/contacto')
  fireEvent.click(screen.getByRole('button', { name: 'Ver mi postulación' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ver Foto y documentos' }))
  expect((screen.getByRole('button', { name: 'Ver DNI frente' }) as HTMLButtonElement).disabled).toBe(false)
  expect(screen.queryByRole('button', { name: 'Reemplazar DNI frente' })).toBeNull()
})
it('does not mistake its acknowledged save version for a concurrent edit during delayed readback', async () => {
  transport(initial); const real = mocks.request.getMockImplementation()!
  mocks.request.mockImplementation(async (...args) => {
    if (args[0] === '/api/professional/onboarding/context') await new Promise(resolve => setTimeout(resolve, 20))
    return real(...args)
  })
  render(<ConnectedProfessionalOnboarding initial={initial} />); fillPersonal()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
  await screen.findByRole('heading', { name: 'Tu oficio' })
  expect(screen.queryByRole('button', { name: /Descartar mis cambios/ })).toBeNull()
  expect((screen.getByRole('button', { name: 'Guardar y continuar' }) as HTMLButtonElement).disabled).toBe(false)
})
it('recovers an ambiguous submitted application into its payment connection step', async () => {
  const context = complete()
  mocks.request.mockImplementation(async (url: string) => {
    if (url.endsWith('/submit')) throw new Error('La respuesta se interrumpió.')
    return { ...context, application: { ...context.application, status: 'form_submitted', version: 2 } }
  })
  render(<ConnectedProfessionalOnboarding initial={context} />)
  fireEvent.click(screen.getByRole('checkbox', { name: /Leí y acepto/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Enviar postulación' }))
  await screen.findByText('La respuesta se interrumpió.')
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar información guardada' }))
  await screen.findByText('Vincular Mercado Pago')
  expect(screen.getByText('Paso 7 de 7')).toBeTruthy()
})
it('blocks exit or step changes while an avatar is selected but not yet saved', () => {
  const context = complete(); render(<ConnectedProfessionalOnboarding initial={context} />)
  fireEvent.click(screen.getByRole('button', { name: 'Editar Foto y documentos' }))
  fireEvent.change(screen.getByLabelText('Elegir foto de perfil'), { target: { files: [new File(['test'], 'avatar.png', {type:'image/png'})] } })
  expect((screen.getByRole('button', { name: 'Guardar y salir' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Volver a revisión' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText(/Guardá o quitá los archivos seleccionados/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', {name:'Quitar foto seleccionada'}))
  expect((screen.getByRole('button', { name: 'Volver a revisión' }) as HTMLButtonElement).disabled).toBe(false)
})
it('keeps a selected replacement document from being silently discarded on exit', () => {
  const context = complete(); render(<ConnectedProfessionalOnboarding initial={context} />)
  fireEvent.click(screen.getByRole('button', { name: 'Editar Foto y documentos' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reemplazar DNI frente' }))
  fireEvent.click(screen.getByRole('button', { name: 'Elegir documento de prueba' }))
  expect((screen.getByRole('button', { name: 'Guardar y salir' }) as HTMLButtonElement).disabled).toBe(true)
})
it('does not silently ignore saving while a background read is still in flight', async () => {
  transport(initial); const real = mocks.request.getMockImplementation()!; let resolve!:(value:OnboardingContext)=>void; let first=true
  mocks.request.mockImplementation(async (...args) => {
    if (args[0] === '/api/professional/onboarding/context' && first) { first=false; return new Promise<OnboardingContext>(done => {resolve=done}) }
    return real(...args)
  })
  render(<ConnectedProfessionalOnboarding initial={initial} />); fireEvent.focus(window); fillPersonal()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
  await screen.findByRole('heading', { name: 'Tu oficio' })
  await act(async () => resolve(initial))
  expect(screen.getByRole('heading', { name: 'Tu oficio' })).toBeTruthy()
})
it('lets the applicant explicitly remove a specialty that is no longer in the active catalog', async () => {
  const context = complete(); context.application.categoryIds.push('98000000-0000-4000-8000-000000000001'); transport(context)
  render(<ConnectedProfessionalOnboarding initial={context} />)
  expect(screen.getByRole('heading', {name:'Tu oficio'})).toBeTruthy()
  fireEvent.click(screen.getByRole('button', {name:'Quitar especialidad no disponible 1'}))
  fireEvent.click(screen.getByRole('button', {name:'Guardar y continuar'}))
  await screen.findByRole('heading', {name:'Dónde trabajás'})
  expect(mocks.request).toHaveBeenCalledWith('/api/professional/onboarding', 'POST', expect.objectContaining({categoryIds:[category]}))
})
it('keeps the canonical connection step if another session submits during save readback', async () => {
  transport(initial); const real = mocks.request.getMockImplementation()!
  mocks.request.mockImplementation(async (...args) => args[0] === '/api/professional/onboarding/context' ? { ...complete(), application: { ...complete().application, status:'form_submitted', version:4 } } : real(...args))
  render(<ConnectedProfessionalOnboarding initial={initial} />); fillPersonal()
  fireEvent.click(screen.getByRole('button', {name:'Guardar y continuar'}))
  await screen.findByText('Vincular Mercado Pago')
  expect(screen.getByText('Paso 7 de 7')).toBeTruthy()
})
it('renders all empty private document uploads without dereferencing a nonexistent preview', () => {
  const context = complete(); context.documents = []; context.avatarUrl = null
  render(<ConnectedProfessionalOnboarding initial={context} />)
  expect(screen.getByRole('heading', {name:'Foto y documentos'})).toBeTruthy()
  expect(screen.getAllByRole('button',{name:'Elegir documento de prueba'})).toHaveLength(3)
  expect(screen.queryByRole('link',{name:/Abrir documento privado/})).toBeNull()
})
it('exposes the presentation name separately from its optional help for accessible form navigation', () => {
  const context = complete(); context.application.licenseNumber = ''
  render(<ConnectedProfessionalOnboarding initial={context} />)
  const presentation = screen.getByRole('textbox', {name:'Presentación'})
  expect(presentation.getAttribute('aria-describedby')).toBe('registration-bio-help')
})
