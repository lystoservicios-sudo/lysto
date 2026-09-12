import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConnectedAdminPermissions } from '@/components/admin/connected-admin-permissions'

const account = {
  id: 'c160f1d9-c23a-4687-b3a3-13122479a55e',
  createdAt: '2026-09-11T00:00:00Z',
  firstName: 'Operador',
  lastName: 'Prueba',
  version: 4,
  permissions: ['operations' as const]
}
const initial = { items: [account], total: 1, nextCursor: null }
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
function edit() {
  fireEvent.click(screen.getByLabelText('Calidad'))
  fireEvent.change(screen.getByLabelText('Motivo del cambio'), {
    target: { value: 'Responsable de revisión de calidad' }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar permisos' }))
}
describe('permission editor', () => {
  it('retains edits on a conflict without announcing success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 409 })))
    render(<ConnectedAdminPermissions initial={initial} />)
    edit()
    expect((await screen.findByRole('alert')).textContent).toContain('Los datos cambiaron')
    expect((screen.getByLabelText('Calidad') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Motivo del cambio') as HTMLTextAreaElement).value).toBe(
      'Responsable de revisión de calidad'
    )
    expect(screen.queryByText('Permisos guardados y registrados en auditoría.')).toBeNull()
  })
  it('sends the version and reason and updates from the saved account', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            account: { ...account, version: 5, permissions: ['operations', 'quality'] }
          })
        )
      )
    vi.stubGlobal('fetch', fetcher)
    render(<ConnectedAdminPermissions initial={initial} />)
    edit()
    await screen.findByText('Permisos guardados y registrados en auditoría.')
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      adminProfileId: account.id,
      expectedVersion: 4,
      permissions: ['operations', 'quality'],
      reason: 'Responsable de revisión de calidad'
    })
    expect(
      (screen.getByRole('button', { name: 'Guardar permisos' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })
  it('explains why the final owner cannot be removed', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ code: 'last_owner' }), { status: 409 }))
    )
    render(<ConnectedAdminPermissions initial={initial} />)
    edit()
    expect((await screen.findByRole('alert')).textContent).toContain('otro owner con cuenta activa')
  })
})
