import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ActionGroup } from '@/components/customer/action-group'
import { InfoNotice } from '@/components/customer/info-notice'
import { MetricStrip } from '@/components/customer/metric-strip'
import { PageIntro } from '@/components/customer/page-intro'
import { EmptyState, ErrorState, FormFeedback, LoadingSkeleton } from '@/components/customer/states'

afterEach(() => cleanup())

describe('customer UI foundations', () => {
  it('renders page context and action without introducing navigation', () => {
    const { container } = render(
      <PageIntro
        eyebrow="Cliente"
        title="Mis equipos"
        description="Historial técnico de tus equipos."
        action={<button type="button">Agregar equipo</button>}
      />
    )

    expect(screen.getByRole('heading', { name: 'Mis equipos' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Agregar equipo' })).toBeTruthy()
    expect(container.querySelector('nav')).toBeNull()
    expect(container.querySelector('aside')).toBeNull()
  })

  it('exposes honest loading, empty and recoverable error states', () => {
    const retry = vi.fn()
    const { rerender } = render(<LoadingSkeleton label="Cargando equipos" rows={2} />)

    expect(screen.getByRole('status').textContent).toContain('Cargando equipos')

    rerender(<EmptyState title="Todavía no hay equipos" description="Aparecerán después del primer servicio." />)
    expect(screen.getByText('Todavía no hay equipos')).toBeTruthy()

    rerender(<ErrorState title="No pudimos cargar" description="Intentá nuevamente." onRetry={retry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('disables a pending action to prevent double activation', () => {
    const submit = vi.fn()
    render(
      <ActionGroup
        actions={[{ id: 'save', label: 'Guardar', pendingLabel: 'Guardando', onClick: submit }]}
        pendingActionId="save"
      />
    )

    const action = screen.getByRole('button', { name: 'Guardando' }) as HTMLButtonElement
    expect(action.disabled).toBe(true)
    fireEvent.click(action)
    expect(submit).not.toHaveBeenCalled()
  })

  it('renders semantic notices and metric empty states', () => {
    const { rerender } = render(
      <InfoNotice tone="warning" title="Integración pendiente" description="La acción todavía no está disponible." live="assertive" />
    )

    expect(screen.getByRole('alert')).toBeTruthy()

    rerender(<MetricStrip items={[]} emptyTitle="Sin métricas disponibles" />)
    expect(screen.getByText('Sin métricas disponibles')).toBeTruthy()
  })

  it('announces form progress and failures without inventing a success state', () => {
    const { rerender } = render(<FormFeedback state="pending" message="Guardando cambios" />)
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')

    rerender(<FormFeedback state="error" message="No pudimos guardar los cambios" />)
    expect(screen.getByRole('alert').textContent).toContain('No pudimos guardar')
  })
})
