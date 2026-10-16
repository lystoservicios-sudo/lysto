import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/http/api-error'

const mocks = vi.hoisted(() => ({ context: vi.fn(), create: vi.fn(), user: vi.fn(), rpc: vi.fn(), refresh: vi.fn() }))
vi.mock('@/lib/professional/onboarding-context', () => ({ ownOnboardingContext: mocks.context }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: mocks.create }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
import Page from '@/app/(professional-onboarding)/pro/onboarding/page'
import { InvitationEntry } from '@/components/pro/invitation-entry'

const professional = '96000000-0000-4000-8000-000000000001'
const profile = '96000000-0000-4000-8000-000000000002'
const session = '96000000-0000-4000-8000-000000000003'
const identity = { id: '96000000-0000-4000-8000-000000000004', email_confirmed_at: '2026-10-01T00:00:00Z', app_metadata: { app_role: 'professional' } }
const context = { role: 'professional', professional_id: professional, profile_id: profile, session_id: session, session_active: true, professional_status: 'suspended' }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.context.mockRejectedValue(new ApiError('forbidden'))
  mocks.create.mockResolvedValue({ auth: { getUser: mocks.user }, rpc: mocks.rpc })
  mocks.user.mockResolvedValue({ data: { user: identity }, error: null })
  mocks.rpc.mockResolvedValue({ data: context, error: null })
})
afterEach(cleanup)

it.each([
  ['suspended', 'Tu cuenta está suspendida'], ['inactive', 'Tu cuenta está inactiva']
])('renders the authenticated %s status when the private application is no longer readable', async (status, title) => {
  mocks.rpc.mockResolvedValue({ data: { ...context, professional_status: status }, error: null })
  render(await Page())
  expect(screen.getByRole('heading', { name: title })).toBeTruthy()
  expect(screen.queryByLabelText('Correo electrónico')).toBeNull()
  expect(screen.queryByText('Vincular Mercado Pago')).toBeNull()
  expect(screen.queryByText('Guardar y continuar')).toBeNull()
  expect(screen.getByRole('link', { name: 'Necesito ayuda' }).getAttribute('href')).toBe('/contacto')
  expect(mocks.rpc).toHaveBeenCalledOnce()
  expect(mocks.rpc).toHaveBeenCalledWith('get_session_context')
  expect(document.body.textContent).not.toContain(professional)
})

it.each([
  { ...context, session_active: false },
  { ...context, session_id: null },
  { ...context, profile_id: null },
  { ...context, professional_id: null },
  { ...context, role: 'customer' },
  { ...context, professional_status: 'approved' }
])('does not turn invalid, inactive-session or nonrestricted data into a blocked-account state: %j', async (data) => {
  mocks.rpc.mockResolvedValue({ data, error: null })
  expect((await Page()).type).toBe(InvitationEntry)
})

it.each([
  null,
  { ...identity, email_confirmed_at: null },
  { ...identity, app_metadata: { app_role: 'customer' }, user_metadata: { app_role: 'professional' } }
])('requires a verified identity and trusted professional role before checking the restricted state', async (user) => {
  mocks.user.mockResolvedValue({ data: { user }, error: null })
  expect((await Page()).type).toBe(InvitationEntry)
  expect(mocks.rpc).not.toHaveBeenCalled()
})

it('fails closed when the limited session context cannot be checked', async () => {
  mocks.rpc.mockResolvedValue({ data: context, error: { code: '42501' } })
  expect((await Page()).type).toBe(InvitationEntry)
})

it('does not query limited account state for an unauthenticated request', async () => {
  mocks.context.mockRejectedValue(new ApiError('unauthorized'))
  expect((await Page()).type).toBe(InvitationEntry)
  expect(mocks.create).not.toHaveBeenCalled()
})

it('keeps provider unavailability as a retryable error, not a fake suspended account', async () => {
  mocks.context.mockRejectedValue(new ApiError('service_unavailable'))
  render(await Page())
  expect(screen.getByRole('heading', { name: 'No pudimos cargar tu postulación' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Volver a intentar' })).toBeTruthy()
  expect(mocks.create).not.toHaveBeenCalled()
})
