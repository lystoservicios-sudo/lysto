import { test, expect } from '../_lib/test.ts'
import { buildPublicReceipt } from '../../lib/qr/public-receipt.ts'

test('comprobante publico oculta campos sensibles', () => {
  const receipt = buildPublicReceipt({ token: 'token-seguro-123', jobId: 'job_1', serviceName: 'Aire acondicionado', date: '2026-08-19', professionalPublicName: 'Martín Gómez', workDone: 'Limpieza', warrantyText: '30 días', nextMaintenanceText: '6 meses' })
  expect(receipt.hiddenFields.includes('dni')).toBeTruthy()
  expect(receipt.hiddenFields.includes('customer_phone')).toBeTruthy()
})

test('token inseguro se rechaza', () => {
  expect(() => buildPublicReceipt({ token: 'x', jobId: 'job_1', serviceName: 'Aire', date: 'x', professionalPublicName: 'x', workDone: 'x', warrantyText: 'x', nextMaintenanceText: 'x' })).toThrow()
})
