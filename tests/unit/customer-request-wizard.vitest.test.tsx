import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MediaUploader } from '@/components/customer/media-uploader'
import { PaymentDeferredPanel } from '@/components/customer/payment-deferred-panel'
import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'
import { AIR_CONDITIONING_ISSUES } from '@/lib/domain/constants'
import { generateDiagnosis } from '@/lib/diagnosis/rules'

afterEach(() => cleanup())

describe('customer request wizard', () => {
  it('guides the first choice without presenting a validation error before interaction', () => {
    render(<AirConditioningWizard />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Elegí una opción para continuar.')).toBeTruthy()
  })

  it.each(AIR_CONDITIONING_ISSUES.filter(issue => !['instalacion', 'mantenimiento'].includes(issue.slug)))('explains every existing cause for $title without presenting a confirmed diagnosis', ({ slug, title }) => {
    render(<AirConditioningWizard />)
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(title) }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    fireEvent.click(screen.getByRole('radio', { name: /Hace días/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByRole('heading', { name: 'Qué puede estar pasando' })).toBeTruthy()
    for (const cause of generateDiagnosis({ issue: slug, timeSince: 'days' }).causes) {
      expect(screen.getByText(cause.customerHint)).toBeTruthy()
    }
    expect(screen.getByText('El técnico confirmará qué está pasando antes de indicarte la solución.')).toBeTruthy()
  })

  it.each(['Instalación', 'Mantenimiento'])('presents %s as a service review, not as a fault', title => {
    render(<AirConditioningWizard />)
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(title) }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByRole('radiogroup', { name: 'Desde cuándo necesitás el servicio' })).toBeTruthy()
    expect(screen.queryByRole('radiogroup', { name: 'Antigüedad del problema' })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: /Hace días/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByRole('heading', { name: 'Qué vamos a revisar' })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Revisión del servicio' }).children).toHaveLength(4)
    expect(screen.queryByText(/Posible causa/)).toBeNull()
    expect(screen.getByText('El profesional confirmará el alcance y los materiales necesarios antes de realizar el trabajo.')).toBeTruthy()
  })

  it('announces the new step, labels equipment fields and retains answers on back navigation', () => {
    render(<AirConditioningWizard />)
    fireEvent.click(screen.getByRole('radio', { name: /No enfría/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Paso 2 de 7: Detalles')
    expect(screen.getByRole('combobox', { name: 'Capacidad del aire (frigorías/h)' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Tecnología del equipo' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /Hace días/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(screen.getByRole('radio', { name: /Hace días/ }).getAttribute('aria-checked')).toBe('true')
  })

  it('offers a mobile visit summary and requires a date when choosing another day', () => {
    render(<AirConditioningWizard />)
    fireEvent.click(screen.getByRole('radio', { name: /No enfría/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    fireEvent.click(screen.getByRole('radio', { name: /Hace días/ }))
    for (let step = 0; step < 3; step += 1) fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText('Ver resumen de la visita')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /Otro día/ }))
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Fecha de visita'), { target: { value: '2027-01-12' } })
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('asks again for timing when changing between a fault and a planned service', () => {
    render(<AirConditioningWizard />)
    fireEvent.click(screen.getByRole('radio', { name: /No enfría/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    fireEvent.click(screen.getByRole('radio', { name: /Hace días/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    fireEvent.click(screen.getByRole('radio', { name: /Instalación/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByRole('radio', { name: 'Hace días' }).getAttribute('aria-checked')).toBe('false')
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)
  })

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

    expect(screen.getByRole('heading', { name: 'Confirmación y pago' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver mis presupuestos' }).getAttribute('href')).toBe('/app/presupuestos')
    expect(screen.queryByRole('button', { name: 'Pagar con Mercado Pago' })).toBeNull()
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

    fireEvent.change(screen.getByLabelText('Agregar fotos'), { target: { files: [photo] } })
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
