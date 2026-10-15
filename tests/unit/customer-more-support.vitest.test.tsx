import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { listSupportCases, updateSupportCase } from '@/lib/support/service'
import type { Session } from '@/lib/auth/session'
import { CustomerCaseDetail } from '@/components/customer/more-support/case-detail'
import { readCustomerCase, loadCustomerCases } from '@/lib/support/customer-center'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
const id = 'c1727548-fc12-4ca1-a11f-f295a40a7d6a'
const baseCase = { id, jobId: null, category: 'other', status: 'open', severity: 'low', description: 'Una consulta sobre la cuenta', dueAt: null, assignedTo: id, publicResolution: null, version: 1, createdAt: '2026-10-14T00:00:00Z', warrantyClaim: null, events: [{ id, type: 'opened', fromStatus: null, toStatus: 'open', message: 'Mensaje público', internalNote: 'PRIVATE-NOTE', evidenceIds: [], createdAt: '2026-10-14T00:00:00Z' }] }
const formModule = '../../components/customer/more-support/case-form'
function session(data: unknown, role: Session['role'] = 'customer') { return { role, customerId: id, client: { rpc: vi.fn().mockResolvedValue({ data, error: null }) } } as unknown as Session }

describe('Más support privacy boundaries', () => {
  it('omits staff assignment and internal-note keys from customer JSON', async () => {
    const cases = await listSupportCases(session([baseCase]), 50)
    expect(JSON.stringify(cases)).not.toMatch(/assignedTo|internalNote|PRIVATE-NOTE/)
    expect(cases[0].events[0].message).toBe('Mensaje público')
  })
  it('retains staff-only fields for the operations interface', async () => {
    const cases = await listSupportCases(session([baseCase], 'admin'), 50)
    expect(cases[0].assignedTo).toBe(id)
    expect(cases[0].events[0].internalNote).toBe('PRIVATE-NOTE')
  })
  it('strips privileged RPC return fields for customer mutations', async () => {
    const result = await updateSupportCase(session({ id, status: 'in_review', version: 2, assignedTo: id }), id, { action: 'customer_replied', expectedVersion: 1, publicMessage: 'Más información' })
    expect(JSON.stringify(result)).not.toMatch(/assignedTo/)
  })
  it('maps PT409 business conflicts without a retry loop', async () => {
    const s = session(null)
    vi.mocked(s.client.rpc).mockResolvedValue({ data: null, error: { code: 'PT409' } } as never)
    await expect(updateSupportCase(s, id, { action: 'customer_replied', expectedVersion: 1, publicMessage: 'Más información' })).rejects.toMatchObject({ code: 'conflict' })
  })
})

describe('Más connected support forms', () => {
  it('retries the same support submission with the original idempotency key and links its case', async () => {
    const mod = await import(formModule).catch(() => null)
    expect(mod?.SupportCaseForm).toBeTypeOf('function')
    if (!mod) return
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(new Response(JSON.stringify({ case: { id } }), { status: 200 }))
    render(<mod.SupportCaseForm jobs={[]} customerId={id} />)
    fireEvent.change(screen.getByLabelText('Contanos qué pasó'), { target: { value: 'Necesito ayuda para actualizar mi cuenta.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar consulta' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Enviar consulta' }))
    await screen.findByRole('link', { name: 'Seguir mi consulta' })
    const first = JSON.parse(String(fetcher.mock.calls[0][1]?.body))
    const second = JSON.parse(String(fetcher.mock.calls[1][1]?.body))
    expect(first.idempotencyKey).toBe(second.idempotencyKey)
    expect(screen.getByRole('link', { name: 'Seguir mi consulta' }).getAttribute('href')).toBe(`/app/ayuda/consultas/${id}`)
    expect(screen.queryByLabelText(/ID/)).toBeNull()
  })
  it('routes warranty submission to the existing support case returned by the server', async () => {
    const mod = await import(formModule).catch(() => null)
    expect(mod?.WarrantyClaimForm).toBeTypeOf('function')
    if (!mod) return
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ claim: { id: 'claim', caseId: id, coverageEligible: false, supportContinues: true } }), { status: 200 }))
    render(<mod.WarrantyClaimForm job={{ id, requestId: id, label: 'Mantenimiento', equipment: 'Aire del living', completedAt: '2026-10-01T00:00:00Z', warrantyUntil: null, claim: null }} customerId={id} />)
    fireEvent.change(screen.getByLabelText('¿Qué volvió a ocurrir?'), { target: { value: 'El equipo volvió a perder agua.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar a revisión' }))
    await waitFor(() => expect(screen.getByRole('link', { name: 'Seguir mi reclamo' }).getAttribute('href')).toBe(`/app/ayuda/consultas/${id}`))
    expect(screen.getByRole('status').textContent).toMatch(/sin confirmar cobertura/)
  })
  it('preserves the reply draft and reloads the case after a version conflict', async () => {
    const publicCase = { ...baseCase, events: [] }
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Los datos cambiaron.' }), { status: 409 })).mockResolvedValueOnce(new Response(JSON.stringify({ case: { ...publicCase, version: 2 } }), { status: 200 }))
    render(<CustomerCaseDetail initialCase={publicCase} customerId={id} />)
    fireEvent.change(screen.getByLabelText('Tu respuesta'), { target: { value: 'Adjunto información importante.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }))
    await screen.findByRole('alert')
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect((screen.getByLabelText('Tu respuesta') as HTMLTextAreaElement).value).toBe('Adjunto información importante.')
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({ expectedVersion: 1, action: 'customer_replied' })
  })
  it('never offers a reply or internal staff controls for a closed case', () => {
    render(<CustomerCaseDetail initialCase={{ ...baseCase, status: 'resolved' }} customerId={id} />)
    expect(screen.queryByRole('button', { name: 'Enviar respuesta' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Nueva consulta' })).toBeTruthy()
    expect(screen.queryByText('PRIVATE-NOTE')).toBeNull()
  })
})

describe('Más owned support reads', () => {
  function query(data: unknown) {
    const builder = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), not: vi.fn(), or: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(), then: vi.fn() }
    for (const name of ['select', 'eq', 'in', 'not', 'or', 'order', 'limit']) builder[name as keyof typeof builder].mockReturnValue(builder)
    builder.maybeSingle.mockResolvedValue({ data, error: null })
    builder.then.mockImplementation((resolve) => Promise.resolve({ data, error: null }).then(resolve))
    return builder
  }
  it('uses an owned point lookup even when the case is older than the first list page', async () => {
    const row = { id, job_id: null, category: 'other', status: 'open', description: 'Una consulta antigua', public_resolution: null, version: 1, created_at: baseCase.createdAt }
    const complaint = query(row), events = query([]), claim = query(null), from = vi.fn((table: string) => table === 'complaints' ? complaint : table === 'support_case_events' ? events : claim)
    const detail = await readCustomerCase({ ...session(null), client: { from } } as unknown as Session, id)
    expect(detail?.description).toBe('Una consulta antigua')
    expect(complaint.eq).toHaveBeenCalledWith('customer_id', id)
    expect(complaint.eq).toHaveBeenCalledWith('id', id)
    expect(complaint.limit).not.toHaveBeenCalled()
    expect(events.select.mock.calls[0][0]).not.toMatch(/internal_note|metadata|actor_profile_id/)
  })
  it('does not fetch events or claims if the owned case lookup is absent', async () => {
    const complaint = query(null), from = vi.fn(() => complaint)
    expect(await readCustomerCase({ ...session(null), client: { from } } as unknown as Session, id)).toBeNull()
    expect(from).toHaveBeenCalledTimes(1)
  })
  it('rejects a malformed or cross-scope cursor before querying the database', async () => {
    const from = vi.fn()
    await expect(loadCustomerCases({ ...session(null), client: { from } } as unknown as Session, { cursor: 'bad,cursor' })).rejects.toMatchObject({ code: 'invalid_input' })
    expect(from).not.toHaveBeenCalled()
  })
})
