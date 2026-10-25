import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DetailsScreen, ReviewScreen } from '@/features/service-request/request-screen-parts'
import { createRequestDraft, getSelectedRequestAnswers } from '@/features/service-request/request-draft'

afterEach(cleanup)
const answers = getSelectedRequestAnswers(createRequestDraft('customer', null))

it('takes missing equipment data straight to the editable fields instead of retrying the same request', () => {
  const onEdit = vi.fn(), onRetry = vi.fn()
  render(<ReviewScreen equipment={null} answers={answers} homeRoom="Living" address="Dirección guardada"
    preview={{ status: 'needs_review', reason: 'equipment_unknown', message: 'Falta confirmar la capacidad o tecnología del aire.' }}
    busy={false} onEdit={onEdit} onRetry={onRetry} />)
  fireEvent.click(screen.getByRole('button', { name: 'Completar datos del equipo' }))
  expect(onEdit).toHaveBeenCalledWith('details')
  expect(onRetry).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Volver a comprobar el presupuesto' })).toBeNull()
})

it('explains the missing price requirements while the customer can edit them', () => {
  render(<DetailsScreen equipment={null} answers={answers} characteristics={null} onCharacteristics={vi.fn()}
    onDetails={vi.fn()} files={[]} savedPhotos={[]} retainedPhotos={[]} onRemoveRetained={vi.fn()}
    onFiles={vi.fn()} onSaved={vi.fn()} onUploadBusy={vi.fn()} mediaKey="new" customerId="customer" />)
  expect(screen.getByText(/Para calcular el precio y habilitar el pago, completá la capacidad y la tecnología/)).toBeTruthy()
  expect(screen.getByLabelText('Capacidad del aire (frigorías/h)').closest('details')?.open).toBe(true)
})

it.each(['no_available_professional', 'booking_notice_required'])('lets the customer change an unavailable time (%s)', reason => {
  const onEdit = vi.fn(), onRetry = vi.fn()
  render(<ReviewScreen equipment={null} answers={answers} homeRoom="Living" address="Dirección guardada"
    preview={{ status: 'unavailable', reason }}
    busy={false} onEdit={onEdit} onRetry={onRetry} />)
  fireEvent.click(screen.getByRole('button', { name: 'Elegir otro horario' }))
  expect(onEdit).toHaveBeenCalledWith('schedule')
  expect(onRetry).not.toHaveBeenCalled()
})
