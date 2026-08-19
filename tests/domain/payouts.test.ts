import { expect, test } from '../_lib/test.ts'
import { buildSettlementReference, decidePayout } from '../../lib/marketplace/payouts.ts'

test('payout is ready after approved payment and completed job', () => {
  const decision = decidePayout({ paymentStatus: 'approved', jobCompleted: true, hasOpenComplaint: false, grossAmount: 100000, platformFeeRate: 0.18, professionalMercadoPagoConnected: true })
  expect(decision.status).toBe('ready_to_settle')
  expect(decision.platformFee).toBe(18000)
  expect(decision.professionalAmount).toBe(82000)
})

test('payout blocks open quality case', () => {
  const decision = decidePayout({ paymentStatus: 'approved', jobCompleted: true, hasOpenComplaint: true, grossAmount: 100000, platformFeeRate: 0.18, professionalMercadoPagoConnected: true })
  expect(decision.status).toBe('blocked')
  expect(decision.reason).toBe('open_quality_case')
})

test('payout blocks missing professional payment account', () => {
  const decision = decidePayout({ paymentStatus: 'approved', jobCompleted: true, hasOpenComplaint: false, grossAmount: 100000, platformFeeRate: 0.18, professionalMercadoPagoConnected: false })
  expect(decision.status).toBe('blocked')
  expect(decision.reason).toBe('professional_payment_account_missing')
})

test('settlement reference is deterministic and sanitized', () => {
  expect(buildSettlementReference('JOB-5009!', 'PRO-01##')).toBe('lysto:JOB-5009:PRO-01')
})
