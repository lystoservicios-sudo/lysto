import { test, expect } from '../_lib/test.ts'
import { createInMemoryLystoRepository } from '../../lib/data-access/in-memory-store.ts'

test('repositorio en memoria guarda y recupera solicitud', async () => {
  const repo = createInMemoryLystoRepository()
  await repo.saveServiceRequest({ id: 'REQ-1', customerId: 'cus-1', status: 'pending_payment', issueSlug: 'no_enfria' })
  const record = await repo.getServiceRequest('REQ-1')
  expect(record?.customerId).toBe('cus-1')
})

test('repositorio en memoria guarda pago y job', async () => {
  const repo = createInMemoryLystoRepository()
  await repo.savePayment({ id: 'PAY-1', requestId: 'REQ-1', provider: 'mercadopago', amount: 45000, status: 'pending' })
  await repo.saveJob({ id: 'JOB-1', requestId: 'REQ-1', customerId: 'cus-1', professionalId: 'pro-1', status: 'confirmed' })
  expect((await repo.getPayment('PAY-1'))?.amount).toBe(45000)
  expect((await repo.getJob('JOB-1'))?.status).toBe('confirmed')
})

test('repositorio snapshot expone colecciones para tests de integracion', async () => {
  const repo = createInMemoryLystoRepository()
  await repo.saveProfessional({ id: 'pro-1', profileId: 'profile-1', status: 'approved', score: 90 })
  const snapshot = repo.snapshot()
  expect(snapshot.professionals.length).toBe(1)
})
