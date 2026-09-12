import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('provider matrix contains every mandatory case and none is pre-approved', () => {
  const source = readFileSync('docs/release/provider-acceptance.md', 'utf8')
  for (let number = 1; number <= 12; number++) {
    const id = `MP${String(number).padStart(2, '0')}`
    assert.equal((source.match(new RegExp(`\\| ${id} \\|`, 'g')) ?? []).length, 1)
  }
  const states = source.split('\n').filter(line => /^\| MP\d{2} /.test(line)).map(line => line.split('|').at(-2)?.trim())
  assert.deepEqual(states, Array(12).fill('pendiente'))
})

test('staging checklist binds the candidate and rejects local equivalence', () => {
  const source = readFileSync('docs/release/staging-acceptance.md', 'utf8')
  for (const term of ['Commit y deployment ID', 'Supabase project ref', 'MP01–MP12', '36 casos', 'RPO/RTO']) assert.match(source, new RegExp(term))
  assert.match(source, /test local.*no equivalen/i)
})
