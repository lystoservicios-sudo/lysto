import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MediaUploader } from '@/components/customer/media-uploader'
const { upload } = vi.hoisted(() => ({ upload: vi.fn() }))
vi.mock('@/lib/uploads/client', () => ({ uploadPrivateFile: upload }))
const photo = new File(['image'], 'equipo.jpg', { type: 'image/jpeg' })
afterEach(() => { cleanup(); vi.clearAllMocks() })
describe('photo upload feedback', () => {
  it('shows server persistence only after verification is acknowledged', async () => {
    upload.mockResolvedValue({ intentId: 'id', attachmentId: 'attachment', draftId: 'draft', entityId: null })
    render(<MediaUploader files={[photo]} onFilesChange={vi.fn()} />)
    expect(screen.queryByText('Guardada en borrador privado')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar fotos' }))
    await waitFor(() => expect(screen.getByText('Guardada en borrador privado')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Quitar equipo.jpg' })).toBeNull()
  })
  it('keeps a failed upload available to retry without claiming success', async () => {
    upload.mockRejectedValue(new Error('No se pudo verificar la foto.'))
    render(<MediaUploader files={[photo]} onFilesChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar fotos' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No se pudo verificar'))
    expect(screen.queryByText('Guardada en borrador privado')).toBeNull()
    expect((screen.getByRole('button', { name: 'Guardar fotos' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
