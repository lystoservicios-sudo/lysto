import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HomeScene } from '@/components/marketing/home-scene'

afterEach(cleanup)

describe('photographic home scene', () => {
  it('shows the composed room even without browser animation capabilities', () => {
    render(<HomeScene />)
    expect(screen.getByRole('img', { name: /Habitación luminosa/ })).toBeTruthy()
    expect(document.querySelectorAll('[data-room-layer]').length).toBe(4)
    expect(document.querySelector('canvas')).toBeNull()
  })

  it('restores the complete room if one photographic layer fails to load', () => {
    render(<HomeScene />)
    const layer = document.querySelector('[data-room-layer="sofa"] img')!
    fireEvent.error(layer)
    expect(document.querySelectorAll('[data-room-layer]').length).toBe(0)
    expect(screen.getByAltText('Habitación luminosa con sillón verde, mesa de madera, plantas y aire acondicionado')).toBeTruthy()
  })
})
