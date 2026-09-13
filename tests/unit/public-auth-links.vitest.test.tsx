import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import HomePage from '../../app/(public)/page'
import AirConditioningServicePage from '../../app/(public)/servicios/aire-acondicionado/page'
import { MarketingHeader } from '../../components/layout/marketing-header'
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

afterEach(cleanup)

describe('public entry links', () => {
  it('offers login—not direct registration—in the public header', () => {
    render(<MarketingHeader />)

    expect(screen.getByRole('link', { name: 'Iniciar sesión' }).getAttribute('href')).toBe('/login')
    expect(screen.queryByRole('link', { name: 'Solicitar' })).toBeNull()
  })

  it('routes the landing page service CTA through login', () => {
    render(<HomePage />)

    for (const link of screen.getAllByRole('link', { name: 'Pedir un servicio' })) {
      expect(link.getAttribute('href')).toBe('/login?next=%2Fapp%2Fsolicitar%2Faire-acondicionado')
    }
  })

  it('routes the service page CTA through login', () => {
    render(<AirConditioningServicePage />)

    for (const link of screen.getAllByRole('link', { name: 'Pedir un servicio' })) {
      expect(link.getAttribute('href')).toBe('/login?next=%2Fapp%2Fsolicitar%2Faire-acondicionado')
    }
  })
})
