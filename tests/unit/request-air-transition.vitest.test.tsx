import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AirPlacementTransition } from '@/features/service-request/request-air-transition'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const origin = { x: 24, y: 140, width: 360, height: 240 }
describe('approved air to actual room transition', () => {
  it('never invents a destination when the actual 3D equipment anchor is unavailable', () => {
    render(<AirPlacementTransition origin={origin} anchor={null} src="/images/service-request/air-neutral.webp" onDone={() => {}} />)
    expect(screen.queryByAltText('Transición del aire a su ubicación guardada')).toBeNull()
  })
  it('places the raster against the actual mesh projection and completes on animation end', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
    const done = vi.fn()
    render(<AirPlacementTransition origin={origin} anchor={{ x: 120, y: 320, width: 90, height: 35 }} src="/images/service-request/air-neutral.webp" onDone={done} />)
    const image = screen.getByAltText('Transición del aire a su ubicación guardada')
    expect(image.style.left).toBe('75px')
    fireEvent.animationEnd(image)
    expect(done).toHaveBeenCalled()
  })
  it('keeps the location static when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))
    render(<AirPlacementTransition origin={origin} anchor={{ x: 120, y: 320, width: 90, height: 35 }} src="/images/service-request/air-neutral.webp" onDone={() => {}} />)
    expect(screen.queryByAltText('Transición del aire a su ubicación guardada')).toBeNull()
  })
  it('renders in the viewport outside an animated fieldset and removes its portal on unmount', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
    const { unmount } = render(<fieldset data-testid="transformed-screen" style={{ transform: 'translateY(0)' }}>
      <AirPlacementTransition origin={origin} anchor={{ x: 120, y: 320, width: 90, height: 35 }} src="/images/service-request/air-neutral.webp" onDone={() => {}} />
    </fieldset>)
    const image = screen.getByAltText('Transición del aire a su ubicación guardada')
    expect(screen.getByTestId('transformed-screen').contains(image)).toBe(false)
    expect(image.parentElement).toBe(document.body)
    unmount()
    expect(screen.queryByAltText('Transición del aire a su ubicación guardada')).toBeNull()
  })
})
