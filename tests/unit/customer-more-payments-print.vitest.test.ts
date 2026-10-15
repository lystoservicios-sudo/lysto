import fs from 'node:fs'
import { expect, it } from 'vitest'

it('keeps the payment record visible when other app content is hidden for printing', () => {
  const css = fs.readFileSync('components/customer/more-payments/payments.module.css', 'utf8')
  expect(css).toContain(':global(body):has(.printable) .printable * { visibility: visible !important; }')
  expect(css).toContain(':global(div):has(> .printable) > :not(.printable)')
})
