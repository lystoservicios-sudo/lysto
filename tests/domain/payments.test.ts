import { test, expect } from '../_lib/test.ts'
import { calculateMarketplaceSplit, isDuplicateWebhook, normalizePaymentStatus } from '../../lib/payments/idempotency.ts'

test('calcula split marketplace 18%', () => {
  const split = calculateMarketplaceSplit(100000, 0.18)
  expect(split.platformFee).toBe(18000)
  expect(split.professionalAmount).toBe(82000)
})

test('rechaza totales invalidos', () => {
  expect(() => calculateMarketplaceSplit(0, 0.18)).toThrow()
  expect(() => calculateMarketplaceSplit(1000, 1)).toThrow()
})

test('normaliza estados de mercado pago', () => {
  expect(normalizePaymentStatus('approved')).toBe('approved')
  expect(normalizePaymentStatus('in_process')).toBe('pending')
  expect(normalizePaymentStatus('unknown')).toBe('pending')
})

test('detecta webhook duplicado por provider event id', () => {
  expect(isDuplicateWebhook({ id: 'evt-1', type: 'payment' }, [{ providerEventId: 'evt-1' }])).toBeTruthy()
  expect(isDuplicateWebhook({ id: 'evt-2', type: 'payment' }, [{ providerEventId: 'evt-1' }])).toBeFalsy()
})
