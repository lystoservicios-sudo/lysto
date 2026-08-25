import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MediaUploader } from '@/components/customer/media-uploader'
import { PaymentDeferredPanel } from '@/components/customer/payment-deferred-panel'
import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'

afterEach(() => cleanup())

describe('customer request wizard', () => {
  it('moves and selects radio choices with arrow keys', () => {
    render(<AirConditioningWizard />)

    const firstChoice = screen.getByRole('radio', { name: /No enfría/ })
    const secondChoice = screen.getByRole('radio', { name: /Pierde agua/ })
    firstChoice.focus()
    fireEvent.keyDown(firstChoice, { key: 'ArrowDown' })

    expect(document.activeElement).toBe(secondChoice)
    expect(secondChoice.getAttribute('aria-checked')).toBe('true')
  })

  it('stops at a deferred payment step instead of inventing matching and a created job', () => {
    render(<AirConditioningWizard />)

    expect(screen.getByText('Paso 1 de 7')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Progreso de la solicitud' }).getAttribute('aria-valuenow')).toBe('1')
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('radio', { name: /No enfría/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    fireEvent.click(screen.getByRole('radio', { name: /Hace días/ }))

    for (let step = 0; step < 5; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    }

    expect(screen.getByRole('heading', { name: 'Pago pendiente de integración' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Pagar con Mercado Pago' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull()
    expect(screen.queryByText('Buscando el mejor profesional...')).toBeNull()
    expect(screen.queryByText('Trabajo creado')).toBeNull()
  })

  it('centralizes the exact deferred-payment policy and keeps financial actions disabled', () => {
    render(<PaymentDeferredPanel amount={43750} planLabel="Prioridad" />)

    expect(screen.getByText('La integración de Mercado Pago se incorporará en la etapa final')).toBeTruthy()
    expect(screen.getByText('$ 43.750')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Pagar con Mercado Pago' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText(/pago aprobado/i)).toBeNull()
  })

  it('shows selected evidence locally, allows removal and never claims an upload completed', () => {
    const onFilesChange = vi.fn()
    const createObjectUrl = vi.fn(() => 'blob:equipo-preview')
    const revokeObjectUrl = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl })
    const photo = new File(['photo'], 'equipo.jpg', { type: 'image/jpeg' })
    const { rerender, unmount } = render(<MediaUploader files={[]} onFilesChange={onFilesChange} />)

    fireEvent.change(screen.getByLabelText('Agregar fotos o video'), { target: { files: [photo] } })
    expect(onFilesChange).toHaveBeenCalledWith([photo])

    rerender(<MediaUploader files={[photo]} onFilesChange={onFilesChange} />)
    expect(screen.getByText('equipo.jpg')).toBeTruthy()
    expect(screen.getByText('Seleccionado en este dispositivo')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Vista previa de equipo.jpg' })).toBeTruthy()
    expect(screen.queryByText(/subida completada/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Quitar equipo.jpg' }))
    expect(onFilesChange).toHaveBeenLastCalledWith([])
    unmount()
    expect(createObjectUrl).toHaveBeenCalledWith(photo)
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:equipo-preview')
  })
})
