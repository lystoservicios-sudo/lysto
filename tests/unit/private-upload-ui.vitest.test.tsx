import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MediaUploader } from '@/components/customer/media-uploader'
const { upload } = vi.hoisted(() => ({ upload: vi.fn() }))
vi.mock('@/lib/uploads/client', () => ({ uploadPrivateFile: upload }))
const photo = new File(['image'], 'equipo.jpg', { type: 'image/jpeg' })
afterEach(() => { cleanup(); vi.clearAllMocks() })
describe('photo upload feedback', () => {
  it('shows server persistence only after verification is acknowledged', async () => {
    upload.mockResolvedValue({ intentId: 'id', attachmentId: 'attachment', draftId: 'draft', entityId: null })
    const files = vi.fn()
    const saved = vi.fn()
    render(<MediaUploader files={[photo]} onFilesChange={files} onSavedPhotosChange={saved} />)
    expect(screen.queryByText('Guardada en borrador privado')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar fotos' }))
    await waitFor(() => expect(screen.getByText('Guardada en borrador privado')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Quitar equipo.jpg' }))
    expect(files).toHaveBeenLastCalledWith([])
    expect(saved).toHaveBeenLastCalledWith([])
  })
  it('does not offer removal for an attachment already linked to a request', () => {
    render(<MediaUploader files={[photo]} onFilesChange={vi.fn()} target={{ kind: 'request-photo', entityId: 'request-id' }}
      savedPhotos={[{ file: photo, upload: { intentId: 'id', attachmentId: 'attachment', draftId: null, entityId: 'request-id' } }]} />)
    expect(screen.queryByRole('button', { name: 'Quitar equipo.jpg' })).toBeNull()
    expect(upload).not.toHaveBeenCalled()
  })
  it('keeps a failed upload available to retry without claiming success', async () => {
    upload.mockRejectedValue(new Error('No se pudo verificar la foto.'))
    render(<MediaUploader files={[photo]} onFilesChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar fotos' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No se pudo verificar'))
    expect(screen.queryByText('Guardada en borrador privado')).toBeNull()
    expect((screen.getByRole('button', { name: 'Guardar fotos' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('aborts the originating upload on unmount and never acknowledges its late response', async () => {
    let complete: (value: unknown) => void = () => {}
    upload.mockImplementation(() => new Promise(resolve => { complete = resolve }))
    const saved = vi.fn()
    const { unmount } = render(<MediaUploader customerId="75000000-0000-4000-8000-000000000010" files={[photo]} onFilesChange={vi.fn()} onSavedPhotosChange={saved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar fotos' }))
    const execution = upload.mock.calls[0][4]
    unmount()
    expect(execution?.signal?.aborted).toBe(true)
    await act(async () => complete({ intentId: '75000000-0000-4000-8000-000000000001', attachmentId: '75000000-0000-4000-8000-000000000002', draftId: null, entityId: null }))
    expect(saved).not.toHaveBeenCalled()
  })
})
