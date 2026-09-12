import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import HomePage from '../../app/(public)/page'
import AirConditioningServicePage from '../../app/(public)/servicios/aire-acondicionado/page'
import { MarketingHeader } from '../../components/layout/marketing-header'

afterEach(cleanup)

describe('public entry links', () => {
  it('offers login—not direct registration—in the public header', () => {
    render(<MarketingHeader />)

    expect(screen.getByRole('link', { name: 'Ingresar' }).getAttribute('href')).toBe('/login')
    expect(screen.queryByRole('link', { name: 'Solicitar' })).toBeNull()
  })

  it('routes the landing page service CTA through login', () => {
    render(<HomePage />)

    expect(screen.getByRole('link', { name: 'Solicitar técnico' }).getAttribute('href'))
      .toBe('/login')
  })

  it('routes the service page CTA through login', () => {
    render(<AirConditioningServicePage />)

    expect(screen.getByRole('link', { name: 'Consultar disponibilidad' }).getAttribute('href'))
      .toBe('/login')
  })
})
