// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { acknowledgeCommand, recoverCommand } from '@/lib/jobs/recoverable-command'

beforeEach(() => sessionStorage.clear())

it('reuses the same command key after timeout and reload', () => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111')
  const first = recoverCommand(sessionStorage, 'job-1:diagnosis', 'same-payload')
  const afterReload = recoverCommand(sessionStorage, 'job-1:diagnosis', 'same-payload')
  expect(afterReload).toEqual(first)
  expect(afterReload.state).toBe('pending')
})

it('rotates the key only after acknowledgement or a changed payload', () => {
  const ids = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333'
  ] as `${string}-${string}-${string}-${string}-${string}`[]
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => ids.shift()!)
  const first = recoverCommand(sessionStorage, 'job-1:extra', 'payload-a')
  const changed = recoverCommand(sessionStorage, 'job-1:extra', 'payload-b')
  expect(changed.key).not.toBe(first.key)
  acknowledgeCommand(sessionStorage, 'job-1:extra', changed.key)
  expect(recoverCommand(sessionStorage, 'job-1:extra', 'payload-b').key).not.toBe(changed.key)
})

it('does not erase a newer pending command when a stale response arrives', () => {
  const ids = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  ] as `${string}-${string}-${string}-${string}-${string}`[]
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => ids.shift()!)
  const stale = recoverCommand(sessionStorage, 'job-1:scope', 'a')
  const current = recoverCommand(sessionStorage, 'job-1:scope', 'b')
  acknowledgeCommand(sessionStorage, 'job-1:scope', stale.key)
  expect(recoverCommand(sessionStorage, 'job-1:scope', 'b')).toEqual(current)
})
