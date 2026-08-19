import { test, expect } from '../_lib/test.ts'
import { assertTransition, canTransition, jobTransitions, paymentTransitions, requestTransitions } from '../../lib/domain/state-machine.ts'

test('request permite flujo pago aprobado a asignacion pendiente', () => {
  expect(canTransition(requestTransitions, 'payment_approved', 'pending_assignment')).toBeTruthy()
})

test('request no permite saltar de pending_payment a assigned', () => {
  expect(canTransition(requestTransitions, 'pending_payment', 'assigned')).toBeFalsy()
})

test('job no permite pasar de pending_assignment a completed', () => {
  expect(canTransition(jobTransitions, 'pending_assignment', 'completed')).toBeFalsy()
})

test('job permite confirmed a technician_on_way', () => {
  expect(canTransition(jobTransitions, 'confirmed', 'technician_on_way')).toBeTruthy()
})

test('payment webhook aprobado permite refund posterior', () => {
  expect(canTransition(paymentTransitions, 'approved', 'refunded')).toBeTruthy()
})

test('assertTransition arroja error en estado invalido', () => {
  expect(() => assertTransition(jobTransitions, 'pending_assignment', 'completed', 'job')).toThrow()
})
