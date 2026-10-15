import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('More uses brief non-layout entrance and feedback motion with reduced-motion protection', () => {
  const css = readFileSync('components/customer/more/more.module.css', 'utf8')
  const globals = readFileSync('app/globals.css', 'utf8')
  const page = css.match(/\.page\s*\{([^}]+)\}/)?.[1] ?? ''
  assert.match(page, /animation:\s*more-enter\s+180ms/)
  assert.match(css, /@keyframes more-enter\s*\{\s*from\s*\{\s*opacity:\s*0;\s*transform:\s*translateY\(4px\)/)
  assert.match(css, /\.notice,\s*\.error,\s*\.success\s*\{\s*animation:\s*more-feedback\s+140ms/)
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  assert.match(globals, /data-lysto-reduce-motion/)
  assert.match(globals, /animation-duration:\s*0s\s*!important/)
})
