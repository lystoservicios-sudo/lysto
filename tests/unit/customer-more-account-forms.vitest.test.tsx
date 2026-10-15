import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerPreferencesForm, CustomerProfileEditor, CustomerPasswordForm, CustomerSessionList, CustomerPrivacyForm } from '@/components/customer/more/account-forms'

const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
const customerId = '60000000-0000-4000-8000-000000000001'
const preferences = { version: 1, emailMaintenance: true, emailSupportUpdates: true, marketingEmail: false, reduceMotion: false }
const profile = { id: customerId, firstName: 'Ana', lastName: 'Pérez', phone: '1123456789', email: 'ana@example.com', notificationPreference: 'email' as const, version: 1 }
let fetcher: ReturnType<typeof vi.fn>
beforeEach(() => { refresh.mockReset(); fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('More account forms with actual transport contracts', () => {
  it('persists preferences with the displayed version and actor, not just local state', async () => {
    fetcher.mockResolvedValue(Response.json({ preferences: { ...preferences, reduceMotion: true, version: 2 }, essentialEmail: true }))
    render(<CustomerPreferencesForm initialValue={preferences} customerId={customerId} />)
    fireEvent.click(screen.getByLabelText('Reducir movimiento'))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Preferencias guardadas'))
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe('/api/customer/preferences')
    expect(options.headers['X-Lysto-Customer-Id']).toBe(customerId)
    expect(JSON.parse(options.body)).toEqual({ ...preferences, reduceMotion: true })
  })
  it('keeps unsaved settings after a failed save and does not announce success', async () => {
    fetcher.mockResolvedValue(Response.json({ error: 'Los datos cambiaron.' }, { status: 409 }))
    render(<CustomerPreferencesForm initialValue={preferences} customerId={customerId} />)
    fireEvent.click(screen.getByLabelText('Reducir movimiento'))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Los datos cambiaron'))
    expect((screen.getByLabelText('Reducir movimiento') as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByText('Preferencias guardadas.')).toBeNull()
  })
  it('discards profile edits without an API write and preserves confirmed email', () => {
    render(<CustomerProfileEditor profile={profile} customerId={customerId} />)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Otra' } })
    fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }))
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Ana')
    expect(fetcher).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Cambiar correo' }).getAttribute('href')).toBe('/app/perfil/correo')
  })
  it('never submits a mismatched new password', () => {
    render(<CustomerPasswordForm customerId={customerId} />)
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'actual123' } })
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'nueva123' } })
    fireEvent.change(screen.getByLabelText('Repetir nueva contraseña'), { target: { value: 'distinta123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('revokes only the selected other session and refreshes canonical list', async () => {
    fetcher.mockResolvedValue(Response.json({ revoked: true }))
    render(<CustomerSessionList customerId={customerId} sessions={[
      { id: customerId, current: true, device: 'Este dispositivo', createdAt: '2026-10-14T12:00:00Z', lastSeenAt: '2026-10-14T12:00:00Z' },
      { id: '60000000-0000-4000-8000-000000000002', current: false, device: 'Otro dispositivo', createdAt: '2026-10-13T12:00:00Z', lastSeenAt: null }
    ]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión en Otro dispositivo' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ action: 'revoke', sessionId: '60000000-0000-4000-8000-000000000002' })
    expect(screen.queryByRole('button', { name: 'Cerrar sesión en Este dispositivo' })).toBeNull()
  })
  it('requires explicit deletion confirmation and current password, then tracks real case', async () => {
    const caseId = '60000000-0000-4000-8000-000000000003'
    fetcher.mockResolvedValue(Response.json({ request: { id: caseId, status: 'requested', createdAt: '2026-10-15T00:00:00Z', supportCaseId: caseId }, pending: { jobs: 1, payments: 0 } }))
    render(<CustomerPrivacyForm customerId={customerId} initialValue={{ request: null, pending: { jobs: 1, payments: 0 } }} />)
    const submit = screen.getByRole('button', { name: 'Solicitar eliminación de cuenta' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Escribí ELIMINAR para confirmar'), { target: { value: 'ELIMINAR' } })
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'actual123' } })
    fireEvent.click(submit)
    await waitFor(() => expect(screen.getByRole('link', { name: 'Seguir mi solicitud' }).getAttribute('href')).toBe(`/app/ayuda/consultas/${caseId}`))
    const body = JSON.parse(fetcher.mock.calls[0][1].body)
    expect(body.confirmation).toBe('ELIMINAR')
    expect(body.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/)
  })
})
