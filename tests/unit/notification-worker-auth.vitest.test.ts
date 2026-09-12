import { expect, it } from 'vitest'
import { authorizeOutboxWorker, readOutboxBody } from '../../lib/notifications/worker-auth'
const secret = 's'.repeat(48)
it('requires a specific well-formed bearer credential and enabled worker', () => {
  expect(authorizeOutboxWorker(`Bearer ${secret}`, secret, true)).toBe(true)
  for (const value of [
    null,
    '',
    `Bearer ${'x'.repeat(48)}`,
    `bearer ${secret}`,
    `Bearer ${secret}\n`,
    'x'.repeat(10000)
  ])
    expect(authorizeOutboxWorker(value, secret, true)).toBe(false)
  expect(authorizeOutboxWorker(`Bearer ${secret}`, secret, false)).toBe(false)
  expect(authorizeOutboxWorker('Bearer short', 'short', true)).toBe(false)
})
it('bounds bytes actually read and requires a strict small JSON batch', async () => {
  const request = (body: string) =>
    new Request('http://localhost/api/internal/outbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    })
  expect(await readOutboxBody(request('{}'))).toEqual({ batchSize: 5 })
  expect(await readOutboxBody(request('{"batchSize":1}'))).toEqual({ batchSize: 1 })
  for (const body of ['{"batchSize":6}', '{"recipient":"someone"}', ' '.repeat(1025), 'not json'])
    await expect(readOutboxBody(request(body))).rejects.toThrow()
})
