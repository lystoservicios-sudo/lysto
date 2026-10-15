import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const cwd = fileURLToPath(new URL('../../', import.meta.url))
test('ignores private environment files but permits the payment configuration example', () => {
  for (const name of ['.env', '.env.local', '.env.production.local']) {
    const result = spawnSync('git', ['check-ignore', '--no-index', '--quiet', name], { cwd })
    assert.equal(result.error, undefined)
    assert.equal(result.status, 0, `${name} must stay ignored`)
  }
  const example = spawnSync('git', ['check-ignore', '--no-index', '--quiet', '.env.example'], { cwd })
  assert.equal(example.error, undefined)
  assert.equal(example.status, 1, 'The later broad ignore rule must not hide .env.example')
})
