import { describe, expect, it } from 'vitest'

import RootLayout from '@/app/layout'

describe('root layout', () => {
  it('declares the document smooth-scroll behavior for Next route transitions', () => {
    const layout = RootLayout({ children: <p>Contenido</p> })

    expect(layout.props['data-scroll-behavior']).toBe('smooth')
  })
})
