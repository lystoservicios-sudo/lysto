import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JobCloseoutForm } from '@/components/pro/job-closeout-form'
import { uploadPrivateFile } from '@/lib/uploads/client'

vi.mock('@/lib/uploads/client', () => ({ uploadPrivateFile: vi.fn() }))

const jobId = '75500000-0000-4000-8000-000000000001'
const equipmentId = '75500000-0000-4000-8000-000000000002'
const attachmentId = '75500000-0000-4000-8000-000000000003'
const actorKey = '75500000-0000-4000-8000-000000000004'
const otherJob = '75500000-0000-4000-8000-000000000005'
const fetcher = vi.fn()
const uploaded = () => ({ attachmentId, intentId: attachmentId, entityId: jobId, draftId: null })
const reportResponse = () => Response.json({ report: { jobId, finalReportId: attachmentId, status: 'completed_pending_customer_confirmation', version: 1, idempotent: false, evidenceCount: 1 } })
const draftKey = `lysto:closeout-draft:${actorKey}:${jobId}:${equipmentId}`
const completeDraft = {
  diagnosis: 'Filtros obstruidos y bajo rendimiento', work: 'Limpieza y prueba de funcionamiento',
  parts: '', resolution: 'resolved', maintenance: 'none', notes: '', evidenceIds: [attachmentId]
}

function mount(props: Partial<Parameters<typeof JobCloseoutForm>[0]> = {}) {
  return render(<JobCloseoutForm jobId={jobId} equipmentId={equipmentId} actorKey={actorKey} onCompleted={vi.fn()} {...props} />)
}
function fill() {
  fireEvent.change(screen.getByLabelText('Diagnóstico final'), { target: { value: completeDraft.diagnosis } })
  fireEvent.change(screen.getByLabelText('Trabajo realizado'), { target: { value: completeDraft.work } })
}
async function savePhoto() {
  const file = new File(['foto'], 'equipo.jpg', { type: 'image/jpeg' })
  fireEvent.change(screen.getByLabelText('Agregar fotos'), { target: { files: [file] } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar fotos' }))
  await waitFor(() => expect(screen.getByText(/Fotos finales verificadas: 1/)).toBeTruthy())
}
function restoreDraft(overrides: Record<string, unknown> = {}) {
  sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, actorKey, jobId, equipmentId, draft: { ...completeDraft, ...overrides } }))
}

beforeEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
  fetcher.mockReset().mockImplementation(async () => reportResponse())
  vi.stubGlobal('fetch', fetcher)
  vi.mocked(uploadPrivateFile).mockReset().mockResolvedValue(uploaded())
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('professional final report form', () => {
  it('uses the approved focused title and client-report action, without granting conformity', () => {
    mount()
    expect(screen.getByRole('heading', { name: 'Completá el informe' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Enviar informe al cliente' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText('Terminar trabajo y pedir conformidad')).toBeNull()
    expect(screen.getByText(/El cliente confirmará el resultado/)).toBeTruthy()
  })

  it('preserves every canonical resolution and maintenance value', () => {
    mount()
    expect(Array.from((screen.getByLabelText('Resultado') as HTMLSelectElement).options, x => x.value)).toEqual(['resolved', 'partially_resolved', 'pending_part', 'second_visit_required', 'not_resolved'])
    expect(Array.from((screen.getByLabelText('Seguimiento recomendado') as HTMLSelectElement).options, x => x.value)).toEqual(['none', 'filters_30_days', 'filters_60_days', 'filters_90_days', 'deep_cleaning_6_months', 'deep_cleaning_annual', 'gas_review_30_days', 'outdoor_unit_review', 'electrical_review', 'pending_part_replacement', 'second_visit_recommended'])
  })

  it('submits the real endpoint with verified after photos and an idempotency key', async () => {
    const onCompleted = vi.fn()
    mount({ onCompleted }); fill(); await savePhoto()
    fireEvent.change(screen.getByLabelText('Repuestos utilizados, uno por línea'), { target: { value: 'Capacitor\n  Filtro  ' } })
    fireEvent.change(screen.getByLabelText('Notas internas'), { target: { value: 'Acceso por el patio' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar informe al cliente' }))
    await waitFor(() => expect(onCompleted).toHaveBeenCalledOnce())
    expect(uploadPrivateFile).toHaveBeenCalledWith(expect.any(File), { kind: 'job-photo', entityId: jobId, phase: 'after' }, expect.any(Function), undefined, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    const [url, request] = fetcher.mock.calls[0]
    expect(url).toBe('/api/jobs/final-report')
    expect(JSON.parse(request.body)).toEqual({ jobId, equipmentId, realDiagnosis: completeDraft.diagnosis, workDone: completeDraft.work, partsUsed: ['Capacitor', 'Filtro'], resolutionStatus: 'resolved', maintenanceOption: 'none', internalNotes: 'Acceso por el patio', afterPhotoIds: [attachmentId], idempotencyKey: expect.stringMatching(/^[a-f0-9-]{36}$/) })
    expect(sessionStorage.getItem(draftKey)).toBeNull()
  })

  it('requires useful pending-followup details before allowing submission', () => {
    restoreDraft(); mount()
    fireEvent.change(screen.getByLabelText('Resultado'), { target: { value: 'pending_part' } })
    const button = screen.getByRole('button', { name: 'Enviar informe al cliente' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Repuesto o seguimiento pendiente'), { target: { value: 'Reemplazar el capacitor' } })
    expect(button.disabled).toBe(false)
  })

  it('restores only a validated draft matching the assigned professional, job and equipment', () => {
    restoreDraft(); mount()
    expect((screen.getByLabelText('Trabajo realizado') as HTMLTextAreaElement).value).toBe(completeDraft.work)
    expect(screen.getByText(/Fotos finales verificadas: 1/)).toBeTruthy()
  })

  it.each([
    { resolution: 'finished' }, { maintenance: 'invented' }, { evidenceIds: ['not-a-uuid'] },
    { evidenceIds: [attachmentId, attachmentId] }, { diagnosis: 23 }
  ])('ignores corrupt or unsupported draft fields: %j', overrides => {
    restoreDraft(overrides); mount()
    expect((screen.getByLabelText('Trabajo realizado') as HTMLTextAreaElement).value).toBe('')
  })

  it('rejects a valid-looking draft belonging to another actor', () => {
    sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, actorKey: 'another-professional', jobId, equipmentId, draft: completeDraft }))
    mount()
    expect((screen.getByLabelText('Trabajo realizado') as HTMLTextAreaElement).value).toBe('')
  })

  it('resets text and verified evidence when changing jobs', () => {
    restoreDraft()
    const view = mount()
    view.rerender(<JobCloseoutForm jobId={otherJob} equipmentId={equipmentId} actorKey={actorKey} initialDiagnosis="Diagnóstico del otro equipo" onCompleted={vi.fn()} />)
    expect((screen.getByLabelText('Diagnóstico final') as HTMLTextAreaElement).value).toBe('Diagnóstico del otro equipo')
    expect((screen.getByLabelText('Trabajo realizado') as HTMLTextAreaElement).value).toBe('')
    expect(screen.getByText(/Fotos finales verificadas: 0/)).toBeTruthy()
  })

  it('continues safely when session storage is denied, including command acknowledgement', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied') })
    const onCompleted = vi.fn()
    mount({ onCompleted }); fill(); await savePhoto()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar informe al cliente' }))
    await waitFor(() => expect(onCompleted).toHaveBeenCalledOnce())
  })

  it('locks navigation and submission while a real photo is uploading', async () => {
    let finish!: (value: ReturnType<typeof uploaded>) => void
    vi.mocked(uploadPrivateFile).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const onBusyChange = vi.fn(), onBack = vi.fn()
    mount({ onBusyChange, onBack }); fill()
    fireEvent.change(screen.getByLabelText('Agregar fotos'), { target: { files: [new File(['foto'], 'aire.jpg', { type: 'image/jpeg' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar fotos' }))
    expect(onBusyChange).toHaveBeenLastCalledWith(true)
    expect((screen.getByRole('button', { name: 'Volver al trabajo' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar informe al cliente' }))
    expect(fetcher).not.toHaveBeenCalled()
    await act(async () => finish(uploaded()))
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false))
  })

  it('sends only one command for rapid double submission', async () => {
    let finish!: (value: Response) => void
    fetcher.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    restoreDraft(); mount()
    const button = screen.getByRole('button', { name: 'Enviar informe al cliente' })
    fireEvent.click(button); fireEvent.click(button)
    expect(fetcher).toHaveBeenCalledOnce()
    await act(async () => finish(reportResponse()))
  })

  it('consults authoritative state after an ambiguous response and reuses the same command on retry', async () => {
    fetcher.mockRejectedValueOnce(new Error('Conexión interrumpida'))
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    restoreDraft(); mount({ onRefresh })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar informe al cliente' }))
    await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce())
    await waitFor(() => expect((screen.getByRole('button', { name: 'Enviar informe al cliente' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar informe al cliente' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    expect(JSON.parse(fetcher.mock.calls[0][1].body).idempotencyKey).toBe(JSON.parse(fetcher.mock.calls[1][1].body).idempotencyKey)
  })

  it('does not retry an uncertain command while the server-state consultation fails', async () => {
    fetcher.mockRejectedValueOnce(new Error('Timeout'))
    const onRefresh = vi.fn().mockRejectedValue(new Error('Servidor sin respuesta'))
    restoreDraft(); mount({ onRefresh })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar informe al cliente' }))
    await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce())
    const check = await screen.findByRole('button', { name: 'Consultar estado' })
    expect((screen.getByRole('button', { name: 'Enviar informe al cliente' }) as HTMLButtonElement).disabled).toBe(true)
    expect(fetcher).toHaveBeenCalledOnce()
    onRefresh.mockResolvedValue(undefined)
    fireEvent.click(check)
    await waitFor(() => expect((screen.getByRole('button', { name: 'Enviar informe al cliente' }) as HTMLButtonElement).disabled).toBe(false))
  })

  it('bounds verified evidence to five and refuses more than five selected files', () => {
    mount()
    fireEvent.change(screen.getByLabelText('Agregar fotos'), { target: { files: Array.from({ length: 6 }, (_, n) => new File(['foto'], `foto-${n}.jpg`, { type: 'image/jpeg' })) } })
    expect(screen.getByRole('alert').textContent).toContain('hasta 5 archivos')
    expect(uploadPrivateFile).not.toHaveBeenCalled()
  })

  it('cannot create a new command after the report has already succeeded', async () => {
    const onCompleted = vi.fn()
    restoreDraft(); mount({ onCompleted })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar informe al cliente' }))
    await waitFor(() => expect(onCompleted).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: 'Enviar informe al cliente' }))
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('still detects an uncertain command when the separate draft JSON is corrupt', () => {
    sessionStorage.setItem(draftKey, '{broken')
    sessionStorage.setItem(`lysto:command:${actorKey}:${jobId}:${equipmentId}:closeout`, JSON.stringify({ key: attachmentId, fingerprint: JSON.stringify({ jobId, equipmentId }), state: 'pending' }))
    mount({ onRefresh: vi.fn() })
    expect(screen.getByText(/Hay un envío sin confirmar/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Enviar informe al cliente' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('requires checking state rather than acknowledging a response for another job', async () => {
    fetcher.mockImplementationOnce(async () => Response.json({ report: { jobId: otherJob, finalReportId: attachmentId, status: 'completed_pending_customer_confirmation', version: 1, idempotent: false } }))
    const onCompleted = vi.fn(), onRefresh = vi.fn()
    restoreDraft(); mount({ onCompleted, onRefresh })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar informe al cliente' }))
    await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce())
    expect(onCompleted).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(draftKey)).not.toBeNull()
  })

  it('never sends while a newly selected photo has not yet been saved', () => {
    restoreDraft(); mount()
    fireEvent.change(screen.getByLabelText('Agregar fotos'), { target: { files: [new File(['foto'], 'otra.jpg', { type: 'image/jpeg' })] } })
    expect((screen.getByRole('button', { name: 'Enviar informe al cliente' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar informe al cliente' }))
    expect(fetcher).not.toHaveBeenCalled()
  })
})
