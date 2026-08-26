import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CustomerJobDetail } from '@/components/customer/customer-job-detail'
import { CustomerJobList } from '@/components/customer/customer-job-list'
import { CustomerReviewForm } from '@/components/customer/customer-review-form'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'
import type { CustomerJobViewModel } from '@/features/customer/view-models'

afterEach(() => cleanup())

const activeJob = customerDemoFixtures.jobs[0]
const approvalJob: CustomerJobViewModel = {
  ...activeJob,
  id: 'job_demo_approval',
  status: 'waiting_customer_approval',
  statusView: { label: 'Presupuesto por confirmar', tone: 'warning' },
  issueLabel: 'Pierde agua',
  nextStep: 'Revisar el diagnóstico profesional y el cambio de presupuesto',
  preliminaryDiagnosis: 'Posible obstrucción del drenaje.',
  professionalDiagnosis: 'Drenaje obstruido y bandeja fuera de nivel.',
  preliminaryAmount: 35000,
  finalAmount: 43000,
  priceChangeReason: 'Nivelación de bandeja y limpieza profunda del drenaje.'
}
const completedJob: CustomerJobViewModel = {
  ...activeJob,
  id: 'job_demo_completed',
  status: 'completed',
  statusView: { label: 'Trabajo finalizado', tone: 'success' },
  issueLabel: 'Mantenimiento preventivo',
  nextStep: 'Calificar el servicio',
  canReview: true,
  completedAt: '2026-08-19T18:00:00.000Z'
}

describe('customer job pages', () => {
  it('filters active, confirmation and completed jobs with controlled count tabs', () => {
    render(<CustomerJobList jobs={[activeJob, approvalJob, completedJob]} />)

    expect(screen.getByRole('tab', { name: 'Activos 1' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('No enfría')).toBeTruthy()
    expect(screen.queryByText('Pierde agua')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Por confirmar 1' }))
    expect(screen.getByText('Pierde agua')).toBeTruthy()
    expect(screen.queryByText('No enfría')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Finalizados 1' }))
    expect(screen.getByText('Mantenimiento preventivo')).toBeTruthy()
  })

  it('shows an eight-stage customer-safe tracker and non-operational chat surface', () => {
    render(<CustomerJobDetail job={activeJob} />)

    expect(screen.getByRole('list', { name: 'Etapas del servicio' }).children).toHaveLength(8)
    expect(screen.getByText('Profesional en camino')).toBeTruthy()
    expect(screen.getByText('Llegada estimada')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Abrir chat' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('El chat se habilitará cuando el servicio esté conectado.')).toBeTruthy()
  })

  it('compares diagnoses and keeps approval unavailable without a real action', () => {
    render(<CustomerJobDetail job={approvalJob} />)

    expect(screen.getByText('Posible obstrucción del drenaje.')).toBeTruthy()
    expect(screen.getByText('Drenaje obstruido y bandeja fuera de nivel.')).toBeTruthy()
    expect(screen.getByText('$ 8.000')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Aprobar presupuesto' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Reservar importe adicional' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('La aprobación se habilitará cuando exista una acción segura conectada.')).toBeTruthy()
  })

  it('keeps the completed-job receipt unavailable without a confirmed payment record', () => {
    render(<CustomerJobDetail job={completedJob} />)

    expect((screen.getByRole('button', { name: 'Ver comprobante' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('covers loading, empty and recoverable error states', () => {
    const retry = vi.fn()
    const { rerender } = render(<CustomerJobList jobs={[]} state="loading" />)
    expect(screen.getByRole('status').textContent).toContain('Cargando trabajos')

    rerender(<CustomerJobList jobs={[]} state="empty" />)
    expect(screen.getByText('Todavía no tenés trabajos')).toBeTruthy()

    rerender(<CustomerJobList jobs={[]} state="error" onRetry={retry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})

function completeReviewForm() {
  fireEvent.click(screen.getByRole('radio', { name: '5 estrellas para el servicio' }))
  fireEvent.click(screen.getByRole('radio', { name: '4 estrellas para el profesional' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Sí, quedó resuelto' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Sí, volvería a elegir Lysto' }))
}

describe('customer review form', () => {
  it('allows completing the review but explains why submission is unavailable', () => {
    render(<CustomerReviewForm jobId={completedJob.id} professionalName={completedJob.professionalName} />)
    completeReviewForm()
    fireEvent.change(screen.getByRole('textbox', { name: 'Comentario opcional' }), { target: { value: 'El servicio fue claro y puntual.' } })

    expect((screen.getByRole('button', { name: 'Enviar calificación' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('El envío se habilitará cuando exista persistencia conectada.')).toBeTruthy()
  })

  it('selects ratings with arrow keys and prevents a second submission while pending', () => {
    const onSubmit = vi.fn(() => new Promise<{ ok: true; message: string }>(() => undefined))
    render(<CustomerReviewForm jobId={completedJob.id} professionalName={completedJob.professionalName} onSubmit={onSubmit} />)

    const firstServiceRating = screen.getByRole('radio', { name: '1 estrella para el servicio' })
    firstServiceRating.focus()
    fireEvent.keyDown(firstServiceRating, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: '2 estrellas para el servicio' }).getAttribute('aria-checked')).toBe('true')

    completeReviewForm()
    const submit = screen.getByRole('button', { name: 'Enviar calificación' })
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button', { name: 'Enviando calificación' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('does not expose a second form for an already reviewed job', () => {
    render(<CustomerReviewForm jobId={completedJob.id} alreadyReviewed />)

    expect(screen.getByText('Ya calificaste este servicio')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Enviar calificación' })).toBeNull()
  })
})
