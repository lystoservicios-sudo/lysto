import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import CustomerError from '@/app/(customer)/app/error'
import HogarError from '@/app/(customer)/app/hogar/error'
import EquipmentError from '@/app/(customer)/app/equipos/error'
import RequestsError from '@/app/(customer)/app/solicitudes/error'
import MaintenanceError from '@/app/(customer)/app/mantenimientos/error'
import ServicesError from '@/app/(customer)/app/trabajos/error'
import JobNotFound from '@/app/(customer)/app/trabajos/[id]/not-found'
import EquipmentNotFound from '@/app/(customer)/app/equipos/[id]/not-found'
import RequestNotFound from '@/app/(customer)/app/solicitudes/[id]/not-found'
import CustomerNotFound from '@/app/(customer)/app/not-found'
import UnknownCustomerPage from '@/app/(customer)/app/[...notFound]/page'
import RootNotFound from '@/app/not-found'
import RootError from '@/app/error'
import GlobalError from '@/app/global-error'

afterEach(cleanup)
const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('customer recovery boundaries', () => {
  it('offers manual recovery and Inicio without disclosing the thrown error', () => {
    const reset = vi.fn()
    render(<CustomerError error={new Error('private-owner-id database failed')} reset={reset} />)

    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar esta pantalla')
    expect(screen.getByRole('link', { name: 'Ir a Inicio' }).getAttribute('href')).toBe('/app')
    expect(screen.queryByText(/private-owner-id/)).toBeNull()
    expect(reset).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['Hogar', HogarError], ['Equipos', EquipmentError], ['Solicitudes', RequestsError],
    ['Mantenimientos', MaintenanceError], ['Servicios', ServicesError]
  ] as const)('keeps %s failures actionable without asserting an uncertain write outcome', (_, Boundary) => {
    const reset = vi.fn()
    render(<Boundary error={new Error('sensitive internal error')} reset={reset} />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir a Inicio' }).getAttribute('href')).toBe('/app')
    expect(document.body.textContent).not.toMatch(/Tus datos se conservan|No se modificó|No se confirmó ninguna|sensitive internal/)
    expect(document.body.textContent).toMatch(/revisá el estado antes de repetir/)
    expect(reset).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['servicio', JobNotFound, '/app/trabajos', 'Volver a Servicios'],
    ['equipo', EquipmentNotFound, '/app/hogar', 'Volver a Hogar'],
    ['solicitud', RequestNotFound, '/app/trabajos', 'Volver a Servicios']
  ] as const)('gives the same non-disclosing explanation for a missing or inaccessible %s', (_, Boundary, href, label) => {
    render(<Boundary />)
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
    expect(screen.getByText('El enlace puede ser incorrecto o el contenido no estar disponible.')).toBeTruthy()
    expect(screen.getByRole('link', { name: label }).getAttribute('href')).toBe(href)
    expect(screen.getByRole('link', { name: 'Ir a Inicio' }).getAttribute('href')).toBe('/app')
    expect(document.body.textContent).not.toMatch(/pertenece a|otro cliente|propietario|UUID/)
  })

  it('routes unknown customer URLs to the local not-found boundary without a data query', () => {
    const catchAll = 'app/(customer)/app/[...notFound]/page.tsx'
    const notFound = 'app/(customer)/app/not-found.tsx'
    expect(existsSync(resolve(process.cwd(), catchAll))).toBe(true)
    expect(existsSync(resolve(process.cwd(), notFound))).toBe(true)
    expect(source(catchAll)).toContain('notFound()')
    expect(source(catchAll)).not.toMatch(/fetch|session|\.from\(|supabase|params|redirect/)
    expect(source(notFound)).not.toMatch(/ClientAppShell|requirePageSession|readAccount|params/)
  })

  it('provides root and independent global recovery boundaries', () => {
    for (const file of ['app/not-found.tsx', 'app/error.tsx', 'app/global-error.tsx']) {
      expect(existsSync(resolve(process.cwd(), file))).toBe(true)
      expect(source(file)).not.toMatch(/error\.message|error\.stack|error\.digest/)
    }
    expect(source('app/error.tsx')).toContain("'use client'")
    expect(source('app/global-error.tsx')).toContain('<html lang="es-AR">')
    expect(source('app/global-error.tsx')).toContain('<body')
    expect(source('app/global-error.tsx')).not.toMatch(/Provider|next\/navigation|next\/headers|supabase/)
  })

  it('uses the actual Next not-found signal for an unmatched customer URL', () => {
    expect(() => UnknownCustomerPage()).toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
    render(<CustomerNotFound />)
    expect(screen.getByRole('heading', { name: 'No encontramos esta página' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir a Inicio' }).getAttribute('href')).toBe('/app')
    expect(screen.queryByRole('main')).toBeNull()
  })

  it('keeps a public 404 usable without an account or a navigation provider', () => {
    render(<RootNotFound />)
    expect(screen.getByRole('main')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir a Inicio' }).getAttribute('href')).toBe('/app')
    expect(screen.getByRole('link', { name: 'Ir a la página de Lysto' }).getAttribute('href')).toBe('/')
  })

  it('recovers a failed customer layout from the root without exposing its error', () => {
    const reset = vi.fn()
    render(<RootError error={new Error('private layout/session details')} reset={reset} />)
    expect(screen.getByRole('heading', { name: 'No pudimos abrir esta pantalla' })).toBeTruthy()
    expect(document.body.textContent).not.toContain('private layout/session details')
    expect(reset).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('renders a complete global fallback document independently of the failed root', () => {
    const html = renderToStaticMarkup(<GlobalError error={new Error('private root failure')} reset={() => undefined} />)
    expect(html).toContain('<html lang="es-AR">')
    expect(html).toMatch(/<body[^>]*>/)
    expect(html).toContain('No pudimos abrir Lysto')
    expect(html).toContain('href="/app"')
    expect(html).toContain('href="/"')
    expect(html).not.toContain('private root failure')
  })

  it('provides touch targets, keyboard focus and both motion preference protections', () => {
    const css = source('components/customer/customer-feedback.module.css')
    expect(css).toContain('min-height: 44px')
    expect(css).toContain(':focus-visible')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain("html[data-lysto-reduce-motion='true']")
  })
})
