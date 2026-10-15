import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), profile: vi.fn(), preferences: vi.fn(), sessions: vi.fn(), privacy: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ requirePageSession: mocks.session }))
vi.mock('@/lib/customer-assets/service', () => ({ readCustomerProfile: mocks.profile }))
vi.mock('@/lib/customer-account/service', () => ({ readCustomerPreferences: mocks.preferences, listCustomerAccountSessions: mocks.sessions, readCustomerPrivacy: mocks.privacy }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import ProfilePage from '@/app/(customer)/app/perfil/page'
import PreferencesPage from '@/app/(customer)/app/preferencias/page'
import SecurityPage from '@/app/(customer)/app/seguridad/page'
import PasswordPage from '@/app/(customer)/app/seguridad/contrasena/page'
import SessionsPage from '@/app/(customer)/app/seguridad/sesiones/page'
import PrivacyPage from '@/app/(customer)/app/seguridad/privacidad/page'
const id = '60000000-0000-4000-8000-000000000001'
afterEach(() => { cleanup(); vi.clearAllMocks() })
describe('More subpages use authenticated real loaders', () => {
  it('loads personal data through the existing profile service', async () => {
    mocks.session.mockResolvedValue({ customerId: id })
    mocks.profile.mockResolvedValue({ id, firstName: 'Ana', lastName: 'Pérez', phone: '1123456789', email: 'ana@example.com', notificationPreference: 'email', version: 3 })
    render(await ProfilePage())
    expect(mocks.session).toHaveBeenCalledWith('customer')
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Ana')
  })
  it('loads persisted preferences, not defaults masquerading as saved', async () => {
    mocks.session.mockResolvedValue({ customerId: id })
    mocks.preferences.mockResolvedValue({ preferences: { version: 4, emailMaintenance: false, emailSupportUpdates: true, marketingEmail: false, reduceMotion: true }, essentialEmail: true })
    render(await PreferencesPage())
    expect((screen.getByLabelText('Reducir movimiento') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Recordatorios de mantenimiento') as HTMLInputElement).checked).toBe(false)
  })
  it('connects security index with password, sessions and data management', async () => {
    mocks.session.mockResolvedValue({ customerId: id })
    render(await SecurityPage())
    for (const path of ['contrasena', 'sesiones', 'privacidad']) expect(document.querySelector(`a[href="/app/seguridad/${path}"]`)).toBeTruthy()
  })
  it('loads a real session list and privacy request status before rendering', async () => {
    mocks.session.mockResolvedValue({ customerId: id })
    mocks.sessions.mockResolvedValue({ sessions: [{ id, current: true, device: 'Este dispositivo', createdAt: '2026-10-14T12:00:00Z', lastSeenAt: null }] })
    mocks.privacy.mockResolvedValue({ request: { id, supportCaseId: id, status: 'requested', createdAt: '2026-10-14T12:00:00Z' }, pending: { jobs: 0, payments: 0 } })
    const { unmount } = render(await SessionsPage())
    expect(screen.getByText(/Este dispositivo.*Sesión actual/)).toBeTruthy(); unmount()
    render(await PrivacyPage())
    expect(screen.getByRole('link', { name: 'Seguir mi solicitud' }).getAttribute('href')).toBe(`/app/ayuda/consultas/${id}`)
  })
  it('provides working password form under the customer boundary', async () => {
    mocks.session.mockResolvedValue({ customerId: id })
    render(await PasswordPage())
    expect(screen.getByLabelText('Contraseña actual')).toBeTruthy()
    expect(mocks.session).toHaveBeenCalledWith('customer')
  })
})
