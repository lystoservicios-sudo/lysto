import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManagedServiceRequestForm } from '@/components/admin/managed-service-request-form'
import { ManagedServiceRequestList } from '@/components/admin/managed-service-request-list'
import AdminRequestsPage from '@/app/(admin)/admin/solicitudes/page'
import type { AdminRequestOptions, AdminRequestRecord } from '@/lib/admin/service-request-contract'

const server = vi.hoisted(() => ({ requirePageSession: vi.fn(), adminResource: vi.fn(), readAdminRequests: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/lib/auth/session', () => ({ requirePageSession: server.requirePageSession }))
vi.mock('@/lib/operations/admin-console', () => ({ adminResource: server.adminResource }))
vi.mock('@/lib/admin/service-request-service', () => ({ readAdminRequests: server.readAdminRequests }))
vi.mock('@/components/pricing/saved-quotes', () => ({ SavedQuotes: () => null }))
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const options: AdminRequestOptions = {
  customers: [{ id: id(1), name: 'Ana Cliente', email: 'ana@example.test' }, { id: id(2), name: 'Otro Cliente', email: 'otro@example.test' }],
  addresses: [{ id: id(3), label: 'Corrientes 100, CABA' }],
  equipment: [{ id: id(4), addressId: id(3), categoryId: id(5), name: 'Aire del living' }],
  categories: [{ id: id(5), name: 'Aire acondicionado' }], issues: [{ id: id(6), categoryId: id(5), name: 'Mantenimiento' }],
  professionals: [{ id: id(7), name: 'Pedro Técnico', paymentAccountConnected: true }],
  quotes: [{ id: id(8), title: 'Mantenimiento cotizado', total: 100000, commissionRate: 20 }], paymentCostRate: 0.06
}
const record: AdminRequestRecord = {
  id: id(9), version: 1, state: 'draft', customerId: id(1), jobId: null, requestId: null, acceptedAt: null,
  createdAt: '2026-10-25T12:00:00Z', updatedAt: '2026-10-25T12:00:00Z',
  input: { customerId: id(1), addressId: id(3), equipmentId: id(4), categoryId: id(5), issueTypeId: id(6),
    professionalId: id(7), serviceTitle: 'Mantenimiento completo', description: 'Limpieza de unidades y control de funcionamiento.',
    startsAt: '2027-01-10T13:00:00Z', durationMinutes: 60, travelBufferMinutes: 15,
    total: 100000, commission: { mode: 'percentage', value: 20 } }
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear() })
describe('managed service request form', () => {
  it('shows the customer total and separate internal split for a saved draft', () => {
    render(<ManagedServiceRequestForm initialOptions={options} initialRecord={record} />)
    expect((screen.getByLabelText('Precio total al cliente (ARS)') as HTMLInputElement).value).toBe('100000')
    expect(screen.getByText('Participación del técnico')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Tipo de comisión'), { target: { value: 'amount' } })
    fireEvent.change(screen.getByLabelText('Comisión de Lysto'), { target: { value: '15000' } })
    expect(screen.getByTestId('professional-amount').textContent).toContain('85.000')
  })
  it('requires an explicit commission instead of treating an empty field as zero', () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ record: { ...record, version: 2 } })))
    vi.stubGlobal('fetch', fetcher)
    render(<ManagedServiceRequestForm initialOptions={options} initialRecord={record} />)
    fireEvent.change(screen.getByLabelText('Comisión de Lysto'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    expect(fetcher).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeTruthy()
  })
  it('clears owned assets immediately when selecting another customer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...options, addresses: [], equipment: [], quotes: [] }))))
    render(<ManagedServiceRequestForm initialOptions={options} initialRecord={record} />)
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: id(2) } })
    expect((screen.getByLabelText('Domicilio') as HTMLSelectElement).value).toBe('')
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Aire del living' })).toBeNull())
  })
  it('requires a review before sending and uses the durable draft version', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ record: { ...record, version: 2, state: 'sent', jobId: id(10), requestId: id(11) } })))
    vi.stubGlobal('fetch', fetcher)
    render(<ManagedServiceRequestForm initialOptions={options} initialRecord={record} />)
    expect(screen.queryByRole('button', { name: 'Enviar al técnico' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar solicitud' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar al técnico' }))
    await screen.findByText('Solicitud enviada al técnico')
    const sent = JSON.parse(fetcher.mock.calls[0][1].body)
    expect(sent).toMatchObject({ id: record.id, expectedVersion: 1, action: 'send', total: 100000, commission: { mode: 'percentage', value: 20 } })
    expect(sent).not.toHaveProperty('paid')
    expect(sent).not.toHaveProperty('acceptedAt')
  })
  it('recovers a committed send after a lost response without submitting again', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...record, state: 'sent', version: 2, jobId: id(10), requestId: id(11) })))
    vi.stubGlobal('fetch', fetcher)
    render(<ManagedServiceRequestForm initialOptions={options} initialRecord={record} />)
    fireEvent.click(screen.getByRole('button', { name: 'Revisar solicitud' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar al técnico' }))
    await screen.findByText('Solicitud enviada al técnico')
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1][0]).toContain(`/api/admin/service-requests?id=${record.id}`)
  })
  it('keeps an uncertain send blocked across remount until its state can be read', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('network timeout'))
      .mockRejectedValueOnce(new Error('state unavailable'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...record, state: 'sent', version: 2, jobId: id(10), requestId: id(11) })))
    vi.stubGlobal('fetch', fetcher)
    const first = render(<ManagedServiceRequestForm initialOptions={options} initialRecord={record} storageScope="admin-a" />)
    fireEvent.click(screen.getByRole('button', { name: 'Revisar solicitud' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar al técnico' }))
    await screen.findByText('No pudimos verificar el guardado. Consultá el estado antes de volver a enviar.')
    first.unmount()
    render(<ManagedServiceRequestForm initialOptions={options} initialRecord={record} storageScope="admin-a" />)
    expect((screen.getByRole('button', { name: 'Revisar solicitud' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Consultar estado' }))
    await screen.findByText('Solicitud enviada al técnico')
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  })
  it('clears a matching pending send when the refreshed server record is already sent', () => {
    const command = { ...record.input, id: record.id, expectedVersion: record.version, action: 'send' }
    const stored = JSON.stringify(command)
    sessionStorage.setItem('lysto:admin-request:pending:admin-a', stored)
    sessionStorage.setItem('lysto:admin-request:pending:admin-b', stored)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(options))))
    const refreshed = render(<ManagedServiceRequestForm initialOptions={options} initialRecord={{ ...record, state: 'sent', version: 2, jobId: id(10), requestId: id(11) }} storageScope="admin-a" />)
    expect(screen.getByText('Solicitud enviada al técnico')).toBeTruthy()
    refreshed.unmount()
    render(<ManagedServiceRequestForm initialOptions={options} storageScope="admin-a" />)
    expect(screen.queryByRole('button', { name: 'Consultar estado' })).toBeNull()
    expect((screen.getByRole('button', { name: 'Revisar solicitud' }) as HTMLButtonElement).disabled).toBe(false)
    expect(sessionStorage.getItem('lysto:admin-request:pending:admin-b')).toBe(stored)
  })
  it('preserves a pending command for a different request when viewing a sent record', () => {
    const stored = JSON.stringify({ ...record.input, id: id(20), expectedVersion: 1, action: 'send' })
    sessionStorage.setItem('lysto:admin-request:pending:admin-a', stored)
    render(<ManagedServiceRequestForm initialOptions={options} initialRecord={{ ...record, state: 'sent', version: 2, jobId: id(10), requestId: id(11) }} storageScope="admin-a" />)
    expect(sessionStorage.getItem('lysto:admin-request:pending:admin-a')).toBe(stored)
  })
  it('does not announce a send when recovery still finds the previous draft', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(new Response(JSON.stringify(record))))
    render(<ManagedServiceRequestForm initialOptions={options} initialRecord={record} />)
    fireEvent.click(screen.getByRole('button', { name: 'Revisar solicitud' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar al técnico' }))
    await screen.findByText('El envío no quedó registrado. Conservamos los datos para que revises y vuelvas a intentar.')
    expect(screen.queryByText('Solicitud enviada al técnico')).toBeNull()
  })
  it('ignores an older customer response after a newer customer selection', async () => {
    let resolveFirst!: (response: Response) => void
    const first = new Promise<Response>(resolve => { resolveFirst = resolve })
    const fetcher = vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce(new Response(JSON.stringify(options)))
    vi.stubGlobal('fetch', fetcher)
    render(<ManagedServiceRequestForm initialOptions={options} initialRecord={record} />)
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: id(2) } })
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: id(1) } })
    await screen.findByRole('option', { name: 'Corrientes 100, CABA' })
    await act(async () => { resolveFirst(new Response(JSON.stringify({ ...options, addresses: [{ id: id(12), label: 'Dirección de otro cliente' }] }))) })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Dirección de otro cliente' })).toBeNull())
    expect(screen.getByRole('option', { name: 'Corrientes 100, CABA' })).toBeTruthy()
  })
})

describe('managed service request pagination', () => {
  it('shows the total and a continuation link for older administrative requests', () => {
    render(<ManagedServiceRequestList records={[record]} total={51} nextHref="/admin/solicitudes?managedCursor=next-page" />)
    expect(screen.getByText('1 de 51 solicitudes cargadas')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver siguientes solicitudes' }).getAttribute('href')).toBe('/admin/solicitudes?managedCursor=next-page')
  })
  it('preserves each list cursor while continuing the other list', async () => {
    const actor = { permissions: ['owner'] }
    server.requirePageSession.mockResolvedValue(actor)
    server.adminResource.mockResolvedValue({ items: [], total: 70, nextCursor: 'accepted-next' })
    server.readAdminRequests.mockResolvedValue({ items: [record], total: 51, nextCursor: 'managed-next' })
    render(await AdminRequestsPage({ searchParams: Promise.resolve({ cursor: 'accepted-current', managedCursor: 'managed-current' }) }))
    expect(server.readAdminRequests).toHaveBeenCalledWith(actor, undefined, { cursor: 'managed-current' })
    const managedHref = screen.getByRole('link', { name: 'Ver siguientes solicitudes' }).getAttribute('href')
    const acceptedHref = screen.getByRole('link', { name: 'Ver siguientes registros' }).getAttribute('href')
    const managedUrl = new URL(managedHref!, 'https://lysto.test')
    const acceptedUrl = new URL(acceptedHref!, 'https://lysto.test')
    expect(managedUrl.searchParams.get('managedCursor')).toBe('managed-next')
    expect(managedUrl.searchParams.get('cursor')).toBe('accepted-current')
    expect(acceptedUrl.searchParams.get('cursor')).toBe('accepted-next')
    expect(acceptedUrl.searchParams.get('managedCursor')).toBe('managed-current')
  })
})
