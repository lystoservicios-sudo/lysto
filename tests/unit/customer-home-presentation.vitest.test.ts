import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'

const stylesheet = postcss.parse(readFileSync(resolve('components/customer/customer-home.module.css'), 'utf8'))

function declarations(selector: string) {
  const values: Record<string, string> = {}
  stylesheet.walkRules(selector, rule => {
    if (rule.parent?.type !== 'root') return
    rule.walkDecls(declaration => { values[declaration.prop] = declaration.value })
  })
  return values
}

describe('customer home presentation contracts', () => {
  it('keeps horizontal overflow inside the carousel with native snap and compact targets', () => {
    const carousel = declarations('.issueCarousel')
    expect(carousel['overflow-x']).toBe('auto')
    expect(carousel['overscroll-behavior-x']).toBe('contain')
    expect(carousel['scroll-snap-type']).toBe('x proximity')
    expect(Number.parseInt(declarations('.issueIcon').width)).toBeGreaterThanOrEqual(44)
    expect(Number.parseInt(declarations('.issueIcon').width)).toBeLessThanOrEqual(56)
    expect(Number.parseInt(declarations('.issueLink')['min-height'])).toBeGreaterThanOrEqual(44)
  })

  it('provides a focus outline and disables motion when reduced motion is preferred', () => {
    expect(declarations('.home a:focus-visible, .home button:focus-visible').outline).toContain('2px')
    const reducedRules: string[] = []
    stylesheet.walkAtRules('media', rule => {
      if (rule.params === '(prefers-reduced-motion: reduce)') reducedRules.push(rule.toString())
    })
    expect(reducedRules.join('\n')).toContain('animation: none')
    expect(reducedRules.join('\n')).toContain('transition: none')
    expect(reducedRules.join('\n')).toContain('transform: none')
    expect(reducedRules.join('\n')).toContain('scroll-behavior: auto')
  })
})
