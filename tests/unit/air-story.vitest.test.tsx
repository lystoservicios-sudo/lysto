import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AirStory } from '@/components/marketing/air-story'

beforeEach(() => { vi.stubGlobal('scrollTo', vi.fn()) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('air conditioner story', () => {
  it('keeps the complete explanation and service link in server-rendered HTML', () => {
    const html = renderToStaticMarkup(<AirStory />)
    for (const text of ['Estar bien empieza por el ambiente.', 'Un buen flujo hace la diferencia.', 'Cada parte tiene una función.', 'Primero entender. Después resolver.']) {
      expect(html).toContain(text)
    }
    expect(html).toContain('/login?next=%2Fapp%2Fsolicitar%2Faire-acondicionado')
    expect(html).not.toContain('aria-hidden="true"><h3')
  })

  it('can move directly between stages and back with accessible controls', () => {
    render(<AirStory />)
    const first = screen.getByRole('button', { name: '01 Confort' })
    const diagnosis = screen.getByRole('button', { name: '04 Solución' })
    expect(first.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(diagnosis)
    expect(diagnosis.getAttribute('aria-pressed')).toBe('true')
    expect(first.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(first)
    expect(first.getAttribute('aria-pressed')).toBe('true')
    expect(diagnosis.getAttribute('aria-pressed')).toBe('false')
  })

  it('honors reduced motion while keeping manual exploration available', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    render(<AirStory />)
    expect(screen.getByRole('region', { name: 'Un buen aire cambia tu día.' }).getAttribute('data-motion')).toBe('reduced')
    fireEvent.click(screen.getByRole('button', { name: '03 Equipo' }))
    expect(screen.getByRole('button', { name: '03 Equipo' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Cada parte tiene una función.')).toBeTruthy()
  })

  it('follows native scrolling in either direction and removes listeners on unmount', () => {
    let frame: FrameRequestCallback | null = null
    let offset = 0
    vi.stubGlobal('innerWidth', 1280)
    vi.stubGlobal('innerHeight', 800)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1 })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const index = Number(this.id.replace('air-step-', ''))
      const top = this.tagName === 'ARTICLE' ? 500 + index * 400 + offset : 0
      return { top, bottom: top + 350, left: 0, right: 500, width: 500, height: 350, x: 0, y: top, toJSON: () => ({}) }
    })
    const removeListener = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<AirStory />)
    const runFrame = () => { act(() => { const callback = frame; frame = null; callback?.(0) }) }
    runFrame()
    expect(screen.getByRole('button', { name: '01 Confort' }).getAttribute('aria-pressed')).toBe('true')
    offset = -1000
    fireEvent.scroll(window)
    runFrame()
    expect(screen.getByRole('button', { name: '03 Equipo' }).getAttribute('aria-pressed')).toBe('true')
    offset = 0
    fireEvent.scroll(window)
    runFrame()
    expect(screen.getByRole('button', { name: '01 Confort' }).getAttribute('aria-pressed')).toBe('true')
    unmount()
    expect(removeListener).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('keeps a manual selection after automatic scroll tracking resumes', () => {
    vi.useFakeTimers()
    let frame: FrameRequestCallback | null = null
    let offset = 0
    vi.stubGlobal('innerWidth', 1280)
    vi.stubGlobal('innerHeight', 1000)
    vi.stubGlobal('scrollY', 0)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1 })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    vi.stubGlobal('scrollTo', (options: ScrollToOptions) => { offset = -(options.top ?? 0) })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const index = Number(this.id.replace('air-step-', ''))
      const top = this.tagName === 'ARTICLE' ? 700 + index * 355 + offset : 0
      return { top, bottom: top + 355, left: 0, right: 500, width: 500, height: 355, x: 0, y: top, toJSON: () => ({}) }
    })
    render(<AirStory />)
    const runFrame = () => { act(() => { const callback = frame; frame = null; callback?.(0) }) }
    runFrame()
    fireEvent.click(screen.getByRole('button', { name: '02 Flujo' }))
    expect(screen.getByRole('button', { name: '02 Flujo' }).getAttribute('aria-pressed')).toBe('true')
    act(() => { vi.advanceTimersByTime(850) })
    runFrame()
    expect(screen.getByRole('button', { name: '02 Flujo' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '03 Equipo' }).getAttribute('aria-pressed')).toBe('false')
  })

  it.each([
    { width: 390, height: 844, visualHeight: 400, sticky: true, expectedLine: 550 },
    { width: 740, height: 360, visualHeight: 320, sticky: false, expectedLine: 162 },
  ])('keeps a mobile selection stable before pinning at $width × $height', ({ width, height, visualHeight, sticky, expectedLine }) => {
    vi.useFakeTimers()
    let frame: FrameRequestCallback | null = null
    let offset = 0
    vi.stubGlobal('innerWidth', width)
    vi.stubGlobal('innerHeight', height)
    vi.stubGlobal('scrollY', 0)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1 })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    vi.stubGlobal('scrollTo', (options: ScrollToOptions) => { offset = -(options.top ?? 0) })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const index = Number(this.id.replace('air-step-', ''))
      const isArticle = this.tagName === 'ARTICLE'
      const top = isArticle ? 800 + index * 370 + offset : sticky ? Math.max(75, 300 + offset) : 300 + offset
      const boxHeight = isArticle ? 370 : visualHeight
      return { top, bottom: top + boxHeight, left: 0, right: 350, width: 350, height: boxHeight, x: 0, y: top, toJSON: () => ({}) }
    })
    render(<AirStory />)
    const runFrame = () => { act(() => { const callback = frame; frame = null; callback?.(0) }) }
    runFrame()
    fireEvent.click(screen.getByRole('button', { name: '03 Equipo' }))
    expect(1540 + offset).toBe(expectedLine)
    act(() => { vi.advanceTimersByTime(850) })
    runFrame()
    expect(screen.getByRole('button', { name: '03 Equipo' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '02 Flujo' }).getAttribute('aria-pressed')).toBe('false')
  })
})
