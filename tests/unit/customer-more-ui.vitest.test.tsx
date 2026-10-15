import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Wallet } from 'lucide-react'
import { MoreEmpty, MoreLink, MorePage, MoreSection } from '@/components/customer/more/more-ui'

afterEach(cleanup)
describe('shared customer More vocabulary', () => {
  it('grounds a subpage with a real back link and one main heading', () => {
    render(<MorePage title="Mis pagos" description="Tus movimientos confirmados."><p>Contenido</p></MorePage>)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Mis pagos')
    expect(screen.getByRole('link', { name: /Volver a Más/ }).getAttribute('href')).toBe('/app/mas')
    expect(screen.getByText('Contenido')).toBeTruthy()
  })
  it('supports the hub without a redundant back link', () => {
    render(<MorePage title="Más" backHref={null}><p>Cuenta y respaldo</p></MorePage>)
    expect(screen.queryByRole('link')).toBeNull()
  })
  it('uses a whole row with a label, description and actual action badge', () => {
    render(<MoreSection title="Pagos y respaldo"><MoreLink href="/app/pagos" title="Pagos y comprobantes" description="Movimientos de tus servicios" badge="1 pendiente" icon={Wallet} /></MoreSection>)
    const link = screen.getByRole('link', { name: /Pagos y comprobantes.*Movimientos de tus servicios.*1 pendiente/ })
    expect(link.getAttribute('href')).toBe('/app/pagos')
    expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
  it('explains an honest empty state without a fabricated counter', () => {
    render(<MoreEmpty title="Todavía no hay pagos" description="Cuando pagues un servicio, aparecerá acá." />)
    expect(screen.getByRole('heading', { name: 'Todavía no hay pagos' })).toBeTruthy()
    expect(screen.getByText('Cuando pagues un servicio, aparecerá acá.')).toBeTruthy()
  })
})
