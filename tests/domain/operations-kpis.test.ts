import { test, expect } from '../_lib/test.ts'
import { calculateOperationsKpis, operationalHealth } from '../../lib/operations/kpis.ts'

test('operations kpis calculate conversion and margin', () => {
  const kpis = calculateOperationsKpis({ totalRequests: 100, paidRequests: 60, assignedJobs: 54, completedJobs: 50, cancelledJobs: 4, complaints: 1, averageRating: 4.6, totalRevenue: 1000000, platformRevenue: 180000 })
  expect(kpis.conversionRate).toBe(0.6)
  expect(kpis.assignmentRate).toBe(0.9)
  expect(kpis.platformMargin).toBe(0.18)
  expect(kpis.health).toBe('healthy')
})

test('operations health detects critical complaint rate', () => {
  expect(operationalHealth({ completionRate: 0.9, cancellationRate: 0.05, complaintRate: 0.12, averageRating: 4.5 })).toBe('critical')
})
