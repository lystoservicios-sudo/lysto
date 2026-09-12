import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LiveProfessionalJobs } from '@/components/pro/live-professional'
import { ProfessionalTraining } from '@/components/pro/pro-account'
import { ProWorkspace } from '@/components/pro/pro-ui'
import type { ProfessionalLiveJob } from '@/lib/professional/live-model'

vi.mock('next/navigation', () => ({ usePathname: () => '/pro/trabajos' }))
afterEach(cleanup)

const jobs: ProfessionalLiveJob[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'confirmed',
    statusLabel: 'Técnico confirmado',
    scheduledDate: '2026-09-13',
    timeWindow: '09:00 - 11:00',
    issueLabel: 'Mantenimiento',
    address: 'Calle real 42, CABA',
    finalAmount: null
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    status: 'completed',
    statusLabel: 'Trabajo completado',
    scheduledDate: '2026-09-01',
    timeWindow: '14:00 - 16:00',
    issueLabel: 'No enfría',
    address: 'Avenida 80, CABA',
    finalAmount: 50000
  }
]

describe('professional mobile experience', () => {
  it('filters authenticated job projections without customer fixture names', () => {
    render(<LiveProfessionalJobs jobs={jobs} />)
    expect(screen.getByText('Mantenimiento')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Finalizados/ }))
    expect(screen.getByText('No enfría')).toBeTruthy()
    expect(screen.queryByText('Mantenimiento')).toBeNull()
    fireEvent.change(screen.getByLabelText('Buscar trabajos'), { target: { value: 'inexistente' } })
    expect(screen.getByText('No hay trabajos en este estado')).toBeTruthy()
  })

  it('keeps keyboard-sized mobile navigation and removes the demo banner', () => {
    render(
      <ProWorkspace>
        <p>Contenido</p>
      </ProWorkspace>
    )
    expect(screen.getByRole('navigation', { name: 'Navegación profesional móvil' })).toBeTruthy()
    expect(screen.queryByText(/demostración/i)).toBeNull()
  })

  it('presents operational guidance without claiming certification', () => {
    render(<ProfessionalTraining />)
    fireEvent.click(screen.getByText('Prepará tu visita'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar revisada' })[0])
    expect(screen.getByText('1 de 4 guías revisadas')).toBeTruthy()
    expect(screen.getByText(/No sustituyen habilitaciones/)).toBeTruthy()
  })
})
