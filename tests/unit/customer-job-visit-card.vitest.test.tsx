import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { JobVisitCard, type CustomerJobVisit } from '@/components/customer/job-visit-card'

const visit: CustomerJobVisit = {
  scheduleVersion: 3,
  startsAt: '2030-09-18T13:00:00+00:00',
  endsAt: '2030-09-18T15:00:00+00:00',
  timezone: 'America/Argentina/Buenos_Aires',
  addressLabel: 'Av. Siempre Viva 742, Buenos Aires',
  professionalName: 'Martín T.',
  durationMinutes: 120,
  travelBufferMinutes: 30,
  confirmed: true
}

afterEach(cleanup)

describe('customer confirmed visit card', () => {
  it('shows the current visit and safe authenticated actions', () => {
    const { container } = render(
      <JobVisitCard jobId="75500000-0000-4000-8000-000000000001" visit={visit} />
    )
    expect(screen.getByText('18 de septiembre de 2030')).toBeTruthy()
    expect(screen.getByText('10:00–12:00')).toBeTruthy()
    expect(screen.getByText(visit.addressLabel)).toBeTruthy()
    expect(screen.getByText(visit.professionalName)).toBeTruthy()
    expect(container.querySelector('#agenda')).toBeTruthy()
    expect(container.querySelector('#reprogramacion')).toBeTruthy()
    expect(container.querySelector('#contacto')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Cómo llegar' }).getAttribute('href')).toContain(
      encodeURIComponent(visit.addressLabel)
    )
    expect(screen.getByRole('link', { name: 'Contactar a soporte de Lysto' }).getAttribute('href')).toBe(
      '/app/garantias?jobId=75500000-0000-4000-8000-000000000001'
    )
    expect(container.innerHTML).not.toMatch(/tel:|mailto:|@lysto/i)
  })

  it('submits a real reschedule request with the current schedule version', async () => {
    const onReschedule = vi.fn(async () => undefined)
    render(
      <JobVisitCard
        jobId="75500000-0000-4000-8000-000000000001"
        visit={visit}
        onReschedule={onReschedule}
      />
    )
    fireEvent.change(screen.getByLabelText('Nueva fecha y hora'), {
      target: { value: '2030-09-20T14:30' }
    })
    fireEvent.change(screen.getByLabelText('Motivo de la reprogramación'), {
      target: { value: 'Necesito cambiar el horario por un compromiso familiar.' }
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Solicitar reprogramación' }).closest('form')!)
    await waitFor(() => expect(onReschedule).toHaveBeenCalledTimes(1))
    expect(onReschedule).toHaveBeenCalledWith({
      startsAt: '2030-09-20T17:30:00.000Z',
      durationMinutes: 120,
      travelBufferMinutes: 30,
      reason: 'Necesito cambiar el horario por un compromiso familiar.',
      expectedVersion: 3
    })
  })

  it('renders a truthful pending state when no schedule is confirmed', () => {
    render(<JobVisitCard jobId="75500000-0000-4000-8000-000000000001" visit={null} />)
    expect(screen.getByText('La fecha de la visita todavía no está confirmada.')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Cómo llegar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Solicitar reprogramación' })).toBeNull()
  })
})
