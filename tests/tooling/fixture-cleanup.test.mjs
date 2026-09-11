import test from 'node:test'
import assert from 'node:assert/strict'
import { boundedFixtureOperation, runFixtureCleanup } from '../integration/fixture-lifecycle.mjs'

test('a hung operation times out and aborts its transport', async () => {
  let transportSignal
  await assert.rejects(boundedFixtureOperation('hung auth', signal => {
    transportSignal = signal
    return new Promise(() => {})
  }, { timeoutMs: 20 }), /hung auth timed out/)
  assert.equal(transportSignal.aborted, true)
})

test('cancellation settles a pending operation even when transport ignores abort', async () => {
  const controller = new AbortController()
  const pending = boundedFixtureOperation('setup', () => new Promise(() => {}), { timeoutMs: 500, signal: controller.signal })
  controller.abort()
  await assert.rejects(pending, /setup cancelled/)
})

test('cleanup attempts every exact ID and closes DB despite a hung signout and failed delete', async () => {
  const visited = []
  const failures = await runFixtureCleanup([
    { label: 'signout A', run: () => new Promise(() => {}) },
    { label: 'delete A', run: async () => { visited.push('A'); throw new Error('provider credential must not appear') } },
    { label: 'delete B', run: async () => { visited.push('B') } },
    { label: 'close database', run: async () => { visited.push('closed') } }
  ], { timeoutMs: 20 })
  assert.deepEqual(visited, ['A', 'B', 'closed'])
  assert.deepEqual(failures, ['signout A', 'delete A'])
})

test('already cancelled operations cannot start later setup mutations', async () => {
  const controller = new AbortController()
  controller.abort()
  let started = false
  await assert.rejects(boundedFixtureOperation('late insert', async () => { started = true }, { signal: controller.signal, timeoutMs: 20 }), /cancelled/)
  assert.equal(started, false)
})
