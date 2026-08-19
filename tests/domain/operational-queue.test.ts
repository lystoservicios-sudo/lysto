import { test, expect } from '../_lib/test.ts'
import { operationalPriority, sortOperationalQueue } from '../../lib/admin/operational-queue.ts'

test('pagada sin profesional tiene prioridad alta', () => {
  const score = operationalPriority({ id: '1', requestStatus: 'pending_assignment', urgency: 'priority', paid: true, createdMinutesAgo: 60, hasAssignedProfessional: false })
  expect(score).toBeGreaterThan(90)
})

test('reclamos suben al tope de la cola', () => {
  const sorted = sortOperationalQueue([
    { id: 'normal', requestStatus: 'pending_assignment', urgency: 'flexible', paid: true, createdMinutesAgo: 10, hasAssignedProfessional: false },
    { id: 'claim', requestStatus: 'assigned', urgency: 'flexible', paid: true, createdMinutesAgo: 5, hasAssignedProfessional: true, hasComplaint: true }
  ])
  expect(sorted[0].id).toBe('claim')
})
