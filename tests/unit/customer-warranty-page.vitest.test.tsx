import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CustomerWarrantyCenter } from '@/components/customer/customer-warranty-center'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'

afterEach(() => cleanup())

const activeWarranty = customerDemoFixtures.warranties[0]
const openClaim = customerDemoFixtures.warranties[1]
const qualityFollowup = customerDemoFixtures.qualityFollowups[0]
const recognition = customerDemoFixtures.recognition

describe('customer warranty center', () => {
  it('links active coverage to a completed service record', () => {
    expect(activeWarranty.jobId).toBe('job_demo_completed')
    render(<CustomerWarrantyCenter warranties={[activeWarranty]} qualityFollowups={[]} />)
    expect(screen.getByText('Servicio finalizado 19 ago 2026')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver detalle del servicio' }).getAttribute('href')).toBe('/app/trabajos/job_demo_completed')
  })

  it('leads with assurance and keeps a new claim unavailable without persistence', () => {
    render(<CustomerWarrantyCenter warranties={[activeWarranty, openClaim]} qualityFollowups={[qualityFollowup]} recognition={recognition} />)

    expect(screen.getByRole('heading', { name: 'Tu servicio sigue respaldado después de la visita' })).toBeTruthy()
    expect(screen.getByText('Cobertura documentada')).toBeTruthy()
    expect(screen.getByText('Seguimiento comprensible')).toBeTruthy()
    expect(screen.getByText('Control de calidad')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Informar un problema' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('La apertura de reclamos se habilitará cuando exista una operación conectada.')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('separates coverage, claims and quality with accessible keyboard tabs', () => {
    expect(customerDemoFixtures.warranties[1]?.jobId).toBe('job_demo_completed')
    render(<CustomerWarrantyCenter warranties={[activeWarranty, openClaim]} qualityFollowups={[qualityFollowup]} recognition={recognition} />)

    expect(screen.getByRole('heading', { name: 'Aire del living' })).toBeTruthy()
    const coverageTab = screen.getByRole('tab', { name: /Coberturas/ })
    fireEvent.keyDown(coverageTab, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: /Reclamos/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Aire del living' })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Seguimiento del reclamo de Aire del living' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Solicitar devolución' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('tab', { name: /Calidad/ }))
    expect(screen.getByText('Seguimiento posterior al servicio')).toBeTruthy()
    expect(screen.getByText('Buenas prácticas de servicio')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Contactar a calidad' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('98%')).toBeTruthy()
  })

  it('keeps recognition visible when it is the only confirmed quality record', () => {
    render(<CustomerWarrantyCenter warranties={[]} qualityFollowups={[]} recognition={recognition} />)

    fireEvent.click(screen.getByRole('tab', { name: /Calidad/ }))
    expect(screen.getByText('Buenas prácticas de servicio')).toBeTruthy()
    expect(screen.queryByText('Todavía no hay coberturas ni casos')).toBeNull()
  })

  it('covers loading, empty and recoverable error states without internal notes', () => {
    const retry = vi.fn()
    const { rerender } = render(<CustomerWarrantyCenter warranties={[]} qualityFollowups={[]} state="loading" />)
    expect(screen.getByRole('status').textContent).toContain('Cargando garantías')

    rerender(<CustomerWarrantyCenter warranties={[]} qualityFollowups={[]} state="empty" />)
    expect(screen.getByText('Todavía no hay coberturas ni casos')).toBeTruthy()

    rerender(<CustomerWarrantyCenter warranties={[]} qualityFollowups={[]} state="error" onRetry={retry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/nota interna/i)).toBeNull()
  })
})
