import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfessionalJobWorkspace } from '@/components/pro/job-workspace'
import type { ProfessionalJobData } from '@/lib/professional/job-workspace-model'

vi.mock('next/dynamic', () => ({ default: () => () => <div aria-label="Vista 3D del ambiente" /> }))
vi.mock('@/components/payments/payment-panel', () => ({ PaymentPanel: () => <p>Movimientos del servicio</p> }))
vi.mock('@/components/customer/media-uploader', () => ({ MediaUploader: ({ onSavedPhotosChange }: { onSavedPhotosChange: (p: unknown[]) => void }) => <button type="button" onClick={() => onSavedPhotosChange([{ upload: { attachmentId: photo }, file: new File(['foto'], 'equipo.jpg') }])}>Guardar foto de prueba</button> }))
const id = '75500000-0000-4000-8000-000000000001'
const photo = '75500000-0000-4000-8000-000000000002'
const extra = '75500000-0000-4000-8000-000000000003'
function fixture(): ProfessionalJobData {
  return { role: 'professional', job: { id, status: 'confirmed' }, equipmentId: photo, visitAddressLabel: 'Av. Ejemplo 123, Caballito', visit: null, savedQuote: null, onsiteDiagnosis: null, finalReport: null, extras: [] }
}
let data: ProfessionalJobData
let context: Record<string, unknown>
let mutation: (url: string, body: Record<string, unknown>) => Response
const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
  const path = String(url)
  if (path === '/api/uploads/read') return Response.json({ url: 'https://storage.example/photo.jpg' })
  if (init?.method === 'POST' || init?.method === 'PATCH') return mutation(path, JSON.parse(String(init.body)))
  if (path.startsWith('/api/pricing/job?')) return Response.json(data)
  if (path.startsWith('/api/pro/jobs/context?')) return Response.json({ context })
  throw new Error(`Unexpected request ${path}`)
})
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  data = fixture()
  context = { jobId: id, issueLabel: 'Aire no enfría', reportedProblem: 'Enciende, pero no enfría.', accessInstructions: null,
    equipment: { id: photo, nickname: 'Aire del living', addressId: null, equipmentType: 'split', brand: null, model: null, serialNumber: null, frigorias: '3000', version: 1, createdAt: '2026-10-15T12:00:00Z', archivedAt: null },
    history: [], home: null, initialPaymentStatus: 'approved', extraPayments: [] }
  mutation = () => Response.json({ ok: true })
  fetcher.mockClear(); vi.stubGlobal('fetch', fetcher); sessionStorage.clear(); window.history.replaceState(null, '', '/pro/trabajos/' + id)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
async function mount() { render(<ProfessionalJobWorkspace jobId={id} />); await screen.findByRole('heading', { name: 'Aire no enfría' }) }

describe('approved compact professional job workspace', () => {
  it('directs an unaccepted proposal to the acceptance flow instead of waiting for payment', async () => {
    data.job.status = 'pending_professional_acceptance'
    context.initialPaymentStatus = null
    await mount()
    expect(screen.queryByText('Esperando el pago del cliente')).toBeNull()
    expect(screen.getByRole('link', { name: 'Revisar propuesta' }).getAttribute('href')).toBe('/pro/solicitudes')
  })
  it('does not shift a date-only visit to the previous day and shows the stored time window', async () => {
    data.job = { ...data.job, scheduled_date: '2026-10-21', scheduled_time_window: '14:00-16:00' } as ProfessionalJobData['job']
    await mount()
    const visit = screen.getByRole('region', { name: 'Datos de la visita' })
    expect(visit.textContent).toContain('21 oct')
    expect(visit.textContent).toContain('14:00-16:00')
    expect(visit.textContent).not.toContain('21:00')
  })
  it('keeps the canonical visit time and full address after departure', async () => {
    data.visit = { startsAt: '2026-10-21T17:00:00Z', endsAt: '2026-10-21T19:00:00Z', addressLabel: 'Av. Ejemplo 123, Piso 2 Depto. B, Caballito', confirmed: true }
    mutation = () => { data = { ...data, job: { ...data.job, status: 'technician_on_way' } }; return Response.json({ ok: true }) }
    await mount()
    fireEvent.click(screen.getByRole('button', { name: 'Marcar en camino' }))
    await screen.findByRole('button', { name: 'Confirmar llegada' })
    const visit = screen.getByRole('region', { name: 'Datos de la visita' })
    expect(visit.textContent).toContain('14:00')
    expect(visit.textContent).toContain('Piso 2 Depto. B')
  })
  it('clearly identifies a cancelled job and does not encourage travelling to it', async () => {
    data.job.status = 'cancelled_by_customer'
    await mount()
    expect(screen.getByText(/Servicio cancelado/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Cómo llegar' })).toBeNull()
  })
  it('starts a newly opened view at its heading rather than keeping the previous form scroll position', async () => {
    await mount()
    vi.mocked(window.scrollTo).mockClear()
    fireEvent.click(screen.getByRole('tab', { name: 'Equipo' }))
    await screen.findByRole('heading', { name: 'Aire del living' })
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' })
  })
  it('removes previously loaded customer information when assignment access is revoked', async () => {
    await mount()
    fireEvent.click(screen.getByRole('button', { name: 'Opciones del trabajo' }))
    fetcher.mockImplementationOnce(async () => Response.json(data)).mockImplementationOnce(async () => Response.json({ error: 'No disponible' }, { status: 403 }))
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar trabajo' }))
    await screen.findByRole('heading', { name: 'No pudimos abrir el trabajo' })
    expect(screen.queryByText('Aire del living')).toBeNull()
    expect(screen.queryByText('Av. Ejemplo 123, Caballito')).toBeNull()
  })
  it('does not leave a successfully submitted extra editable when the subsequent refresh fails', async () => {
    data.job.status = 'arrived'
    await mount()
    fireEvent.click(screen.getByRole('button', { name: 'Adicionales' }))
    fireEvent.click(screen.getByRole('button', { name: 'Proponer adicional' }))
    fireEvent.change(screen.getByLabelText('Problema adicional'), { target: { value: 'Capacitor averiado' } })
    fireEvent.change(screen.getByLabelText('Trabajo y repuestos incluidos'), { target: { value: 'Cambio del capacitor y prueba de arranque' } })
    fireEvent.change(screen.getByLabelText('Importe total (ARS)'), { target: { value: '28000' } })
    mutation = () => { fetcher.mockImplementationOnce(async () => Response.json({ error: 'No disponible' }, { status: 503 })); return Response.json({ ok: true }) }
    fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Enviar propuesta' })).toBeNull())
  })
  it('renders only real assigned service context and the next action', async () => {
    await mount()
    expect(screen.getByText('Pago inicial aprobado')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Marcar en camino' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Trabajos' }).getAttribute('aria-current')).toBe('page')
    expect(screen.queryByText('Aceptar trabajo')).toBeNull()
    expect(screen.queryByText('Reprogramar')).toBeNull()
  })
  it('does not allow departure until the initial payment is actually approved', async () => {
    context.initialPaymentStatus = 'pending'
    await mount()
    expect(screen.getByText('Esperando el pago del cliente')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Marcar en camino' })).toBeNull()
  })
  it('sends the canonical visit command and reloads confirmed state', async () => {
    let received: Record<string, unknown> | undefined
    mutation = (_url, body) => { received = body; data = { ...data, job: { ...data.job, status: 'technician_on_way' } }; return Response.json({ ok: true }) }
    await mount(); fireEvent.click(screen.getByRole('button', { name: 'Marcar en camino' }))
    await screen.findByRole('button', { name: 'Confirmar llegada' })
    expect(received).toMatchObject({ action: 'advance', jobId: id, expectedStatus: 'confirmed' })
    expect(received?.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/)
  })
  it('shows an honest equipment fallback rather than inventing a configured room', async () => {
    await mount(); fireEvent.click(screen.getByRole('tab', { name: 'Equipo' }))
    await screen.findByRole('heading', { name: 'Aire del living' })
    expect(screen.getByText('El cliente todavía no ubicó este equipo en un ambiente.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Añadir ambiente' })).toBeNull()
  })
  it('submits verified diagnosis evidence and hides app navigation during the form', async () => {
    data.job.status = 'onsite_diagnosis'
    const sent: Array<Record<string, unknown>> = []
    mutation = (_url, body) => { sent.push(body); data = { ...data, job: { ...data.job, status: 'waiting_customer_approval' }, onsiteDiagnosis: { id: photo, actual_diagnosis: String(body.actualDiagnosis), base_scope: String(body.baseScope), evidence_ids: [photo], status: 'submitted', decision_reason: null, version: 1 } }; return Response.json({ ok: true }) }
    render(<ProfessionalJobWorkspace jobId={id} />)
    await screen.findByRole('heading', { name: 'Diagnóstico presencial' })
    expect(screen.queryByRole('navigation', { name: 'Navegación profesional' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Falla encontrada'), { target: { value: 'Filtros obstruidos y bajo rendimiento' } })
    fireEvent.change(screen.getByLabelText('Alcance base'), { target: { value: 'Limpieza y verificación de funcionamiento' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar foto de prueba' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para aprobación' }))
    await screen.findByRole('heading', { name: 'Diagnóstico enviado' })
    expect(sent[0]).toMatchObject({ action: 'submitDiagnosis', expectedStatus: 'onsite_diagnosis', equipmentId: photo, evidenceIds: [photo] })
  })
  it('keeps diagnosis and evidence read-only while waiting for the client', async () => {
    data.job.status = 'waiting_customer_approval'
    data.onsiteDiagnosis = { id: photo, actual_diagnosis: 'Filtros obstruidos', base_scope: 'Limpieza y verificación', evidence_ids: [photo], status: 'submitted', decision_reason: null, version: 1 }
    render(<ProfessionalJobWorkspace jobId={id} />)
    await screen.findByRole('heading', { name: 'Diagnóstico enviado' })
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Guardar foto de prueba' })).toBeNull()
    expect(screen.queryByText('Iniciar trabajo')).toBeNull()
    expect((screen.getByRole('button', { name: 'Esperando aprobación' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('distinguishes accepted additional from its still pending payment', async () => {
    data.job.status = 'waiting_customer_approval'
    data.extras = [{ id: extra, fault: 'Capacitor fuera de valor', description: 'Reemplazo y prueba del capacitor', amount: 28000, status: 'accepted' }]
    context.extraPayments = [{ extraId: extra, status: 'pending' }]
    await mount(); fireEvent.click(screen.getByRole('button', { name: 'Adicionales' }))
    await screen.findByText('Propuesta aceptada')
    expect(screen.getByText('Esperando pago')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Realizar adicional' })).toBeNull()
  })
  it('does not offer a professional customer-confirmation shortcut after report submission', async () => {
    data.job.status = 'completed_pending_customer_confirmation'
    data.finalReport = { id: photo, real_diagnosis: 'Desagüe obstruido', work_done: 'Limpieza y prueba de drenaje', parts_used: null, final_state: 'resolved', maintenance_option: 'none', after_photo_ids: [photo], version: 1, created_at: '2026-10-15T19:00:00Z' }
    render(<ProfessionalJobWorkspace jobId={id} />)
    await screen.findByRole('heading', { name: 'Informe enviado' })
    expect(screen.getByText('Esperando conformidad del cliente')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirmar servicio' })).toBeNull()
    expect(screen.queryByText('Limpieza y prueba de drenaje')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver informe' }))
    await screen.findByRole('heading', { name: 'Informe del servicio' })
    expect(screen.getByText('Limpieza y prueba de drenaje')).toBeTruthy()
  })
  it('fails closed when the professional context cannot be verified', async () => {
    fetcher.mockImplementationOnce(async () => Response.json(data)).mockImplementationOnce(async () => Response.json({ error: 'No disponible' }, { status: 403 }))
    render(<ProfessionalJobWorkspace jobId={id} />)
    await screen.findByRole('heading', { name: 'No pudimos abrir el trabajo' })
    expect(screen.queryByRole('button', { name: 'Marcar en camino' })).toBeNull()
    expect(screen.queryByText('Aire del living')).toBeNull()
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  })
})
