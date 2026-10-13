import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8')

test('CI can obtain E2E evidence after an integration assertion failure', () => {
  const e2e = workflow.split('- name: Production build and E2E with disposable backend; zero skipped')[1]?.split('- name:')[0]
  assert.ok(e2e)
  assert.match(e2e, /if:.*!cancelled\(\)/)
  assert.match(e2e, /steps\.integration\.outcome == 'success'/)
  assert.match(e2e, /steps\.integration\.outcome == 'failure'/)
})

test('E2E diagnostics still require a validated database and installed browsers', () => {
  const e2e = workflow.split('- name: Production build and E2E with disposable backend; zero skipped')[1]?.split('- name:')[0]
  assert.match(e2e ?? '', /steps\.database-schema\.outcome == 'success'/)
  assert.match(e2e ?? '', /steps\.e2e-browsers\.outcome == 'success'/)
  assert.match(workflow, /- name: Database lint and generated types\s+id: database-schema/)
  assert.match(workflow, /- name: Install E2E browsers\s+id: e2e-browsers/)
  assert.match(workflow, /- name: Mandatory Auth and payment integration; zero skipped\s+id: integration/)
})

test('Integration remains mandatory and no diagnostic failure is ignored', () => {
  assert.doesNotMatch(workflow, /continue-on-error:/)
  assert.match(workflow, /pnpm test:integration -- --local-workdir/)
  assert.match(workflow, /run: node scripts\/test-e2e-ci\.mjs/)
})

test('Production deployment still requires both successful quality jobs on main', () => {
  const deploy = workflow.split('deploy-production:')[1]
  assert.ok(deploy)
  assert.match(deploy, /needs: \[quality, domain-windows\]/)
  assert.match(deploy, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/)
  assert.doesNotMatch(deploy, /always\(\)|failure\(\)/)
})
