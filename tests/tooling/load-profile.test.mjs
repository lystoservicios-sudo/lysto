import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../load/service-platform.js', import.meta.url), 'utf8')

test('load profile cannot target production or call external payment operations', () => {
  assert.match(source, /Production load testing is forbidden/)
  assert.match(source, /TARGET_ENV=local\|staging/)
  assert.doesNotMatch(source, /create-preference|mercadopago\/webhook|payments\/refund/)
})

test('load profile contains peak, burst, sustained and separately tagged own latency', () => {
  for (const name of ['peak', 'double_peak', 'burst', 'sustained']) assert.match(source, new RegExp(name))
  assert.match(source, /p\(95\)<1000/)
  assert.match(source, /p\(95\)<2000/)
  assert.match(source, /rate<0\.01/)
  assert.match(source, /operation: 'mutation'/)
  assert.match(source, /timeSince: 'months'/)
  assert.doesNotMatch(source, /answers: \{ timeSince/)
  assert.match(source, /Origin: baseUrl/)
  assert.match(source, /sleep\(6\)/)
  assert.doesNotMatch(source, /new URL\(/)
})
