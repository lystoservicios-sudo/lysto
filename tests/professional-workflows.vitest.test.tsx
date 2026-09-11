import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ProfessionalJobDetail, ProfessionalRequestDetail } from '@/components/pro/pro-details'
import { ProfessionalOnboarding, ProfessionalProfile } from '@/components/pro/pro-account'
import { ProWorkspace } from '@/components/pro/pro-ui'
import { ProfessionalAgenda } from '@/components/pro/pro-lists'
import { professionalJobs } from '@/components/pro/pro-model'
import { jobs, serviceRequests } from '@/lib/mock/lysto-data'
import JobRoute from '@/app/(professional)/pro/trabajos/[id]/page'
import RequestRoute from '@/app/(professional)/pro/solicitudes/[id]/page'

vi.mock('next/navigation', () => ({ usePathname: () => '/pro/trabajos/job_7001', notFound: () => { throw new Error('NOT_FOUND') } }))
afterEach(() => { cleanup(); sessionStorage.clear() })

it('shows the nearest pending date before later visits', () => {
  professionalJobs.push({ ...jobs[0], id: 'job_test_later', scheduledDate: '25/08/2026' })
  try {
    render(<ProfessionalAgenda />)
    const dates = screen.getAllByRole('heading', { level: 2 }).map(node => node.textContent).filter(text => text?.includes('/2026'))
    expect(dates).toEqual(['19/08/2026', '25/08/2026'])
  } finally { professionalJobs.pop() }
})

it('requires a diagnosis and stops before customer approval', () => {
  render(<ProfessionalJobDetail job={jobs[0]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Simular llegada' }))
  fireEvent.click(screen.getByRole('button', { name: 'Simular inicio de diagnóstico' }))
  expect((screen.getByRole('button', { name: 'Simular envío de diagnóstico' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Diagnóstico presencial'), { target: { value: 'Observación de prueba' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simular envío de diagnóstico' }))
  expect(screen.getByText(/Esta demo no puede aprobar en su nombre/)).toBeTruthy()
  expect(screen.getByText('En camino')).toBeTruthy()
  expect(jobs[0].status).toBe('technician_on_way')
  expect(screen.queryByRole('button', { name: /Simular/ })).toBeNull()
})
it('does not offer editing actions for a completed job', () => {
  render(<ProfessionalJobDetail job={jobs[2]} />)
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByRole('button', { name: /Simular/ })).toBeNull()
})
it('requires a decision and saves it without claiming an assignment', () => {
  render(<ProfessionalRequestDetail request={serviceRequests[1]} />)
  expect((screen.getByRole('button', { name: 'Guardar respuesta de prueba' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByLabelText('Sí, tengo disponibilidad'))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar respuesta de prueba' }))
  expect(screen.getByRole('status').textContent).toContain('No se envió')
  expect(serviceRequests[1].status).toBe('payment_approved')
})
it('points an already assigned request to its actual job', () => {
  render(<ProfessionalRequestDetail request={serviceRequests[0]} />)
  expect(screen.getByRole('link', { name: 'Ir al trabajo' }).getAttribute('href')).toBe('/pro/trabajos/job_7001')
  expect(screen.queryByRole('radio')).toBeNull()
})
it('does not expose another professional job or an unpaid request by URL', async () => {
  await expect(JobRoute({ params: Promise.resolve({ id: 'job_7002' }) })).rejects.toThrow('NOT_FOUND')
  await expect(RequestRoute({ params: Promise.resolve({ id: 'req_1003' }) })).rejects.toThrow('NOT_FOUND')
})
it('keys detail forms by record so client state cannot leak between visits', async () => {
  expect((await JobRoute({ params: Promise.resolve({ id: 'job_7001' }) })).key).toBe('job_7001')
  expect((await RequestRoute({ params: Promise.resolve({ id: 'req_1002' }) })).key).toBe('req_1002')
})
it('marks the jobs destination active for its detail', () => {
  render(<ProWorkspace><p>Detalle</p></ProWorkspace>)
  expect(screen.getByRole('link', { name: 'Trabajos' }).getAttribute('aria-current')).toBe('page')
  expect(screen.getByRole('link', { name: 'Inicio' }).getAttribute('aria-current')).toBeNull()
})
it('keeps onboarding values when moving back between steps', () => {
  render(<ProfessionalOnboarding />)
  fireEvent.change(screen.getByLabelText('Nombre y apellido'), { target: { value: 'Prueba de interfaz' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '1111111111' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(screen.getByLabelText('Zona de trabajo')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Atrás' }))
  expect((screen.getByLabelText('Nombre y apellido') as HTMLInputElement).value).toBe('Prueba de interfaz')
})
it('clears stale saved feedback when the user edits the profile again', () => {
  render(<ProfessionalProfile />)
  fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador de perfil' }))
  expect(screen.getByRole('status')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Zona de trabajo'), { target: { value: 'Nueva zona' } })
  expect(screen.queryByRole('status')).toBeNull()
})
