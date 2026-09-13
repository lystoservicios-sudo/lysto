import { test, expect } from '../_lib/test.ts'
import { runManagedServiceSimulation } from '../simulations/full-system-simulation.ts'
import type { ProfessionalCandidate } from '../../lib/matching/score-professionals.ts'

const request = {
  customerId: 'cus-100',
  issue: 'no_enfria' as const,
  timeSince: 'weeks' as const,
  address: {
    street: 'Av. Santa Fe',
    number: '2400',
    city: 'CABA',
    province: 'Buenos Aires',
    propertyType: 'apartment' as const,
    access: { hasElevator: true, hasParking: true, outdoorUnitAtHeight: false }
  },
  schedule: { dateChoice: 'tomorrow' as const, timeWindow: '10:00 – 12:00' },
  selectedOption: 'priority' as const,
  media: { photosCount: 3, videosCount: 1 },
  zone: 'caba'
}

const candidates: ProfessionalCandidate[] = [
  { id: 'pro-top', name: 'Martín Gómez', status: 'approved', serviceSlugs: ['aire_acondicionado'], zones: ['caba'], available: true, hasLicense: true, toolsScore: 9, ratingAvg: 4.9, jobsCompleted: 48, activeJobs: 0, acceptanceRate: 0.96, distanceKm: 4, internalScore: 94 },
  { id: 'pro-backup', name: 'Diego Pérez', status: 'approved', serviceSlugs: ['aire_acondicionado'], zones: ['caba'], available: true, hasLicense: true, toolsScore: 7, ratingAvg: 4.4, jobsCompleted: 12, activeJobs: 1, acceptanceRate: 0.82, distanceKm: 10, internalScore: 77 }
]

const equipment = {
  customerId: 'cus-100',
  addressId: 'addr-100',
  nickname: 'Aire living',
  room: 'living' as const,
  propertyType: 'apartment' as const,
  equipmentType: 'inverter' as const,
  brand: 'Surrey',
  model: '553AIQ1201F',
  frigorias: 3000,
  indoorPhotoCount: 1,
  outdoorPhotoCount: 1
}

const finalReport = {
  jobId: 'JOB-temp',
  equipmentId: 'eq-100',
  realDiagnosis: 'Filtro saturado y presión de gas fuera de rango recomendado.',
  workDone: 'Limpieza integral, control de presión, prueba de frío y revisión de unidad exterior.',
  resolutionStatus: 'resolved' as const,
  maintenanceOption: 'deep_cleaning_6_months' as const,
  photosAfterCount: 2,
  warrantyDays: 30
}

test('simulación completa cliente-asignación-profesional-pago-cierre-conformidad-review termina completada', () => {
  const result = runManagedServiceSimulation({
    adminProfileId: 'admin-100',
    request,
    candidates,
    equipment,
    finalReport,
    review: {
      serviceRating: 5,
      professionalRating: 5,
      problemResolved: true,
      wouldHireAgain: true,
      comment: 'Excelente servicio',
      score: { serviceRating: 5, professionalRating: 5, resolved: true },
      previousRatingAvg: 4.8,
      previousJobsCompleted: 48
    },
    receiptToken: 'receipt-safe-token-100'
  })
  expect(result.finalJobStatus).toBe('completed')
  expect(result.professionalId).toBe('pro-top')
  expect(result.platformFee).toBeGreaterThan(0)
  expect(result.professionalAmount).toBeGreaterThan(result.platformFee)
  expect(result.notificationEvents).toContain('job.completed')
  expect(result.operationalChecklist).toContain('audit_events_validated')
  expect(result.publicReceiptHiddenFields).toContain('dni')
})

test('simulación con review baja abre caso de calidad', () => {
  const result = runManagedServiceSimulation({
    adminProfileId: 'admin-100',
    request,
    candidates,
    equipment,
    finalReport,
    review: {
      serviceRating: 2,
      professionalRating: 2,
      problemResolved: false,
      wouldHireAgain: false,
      comment: 'No quedó bien',
      score: { serviceRating: 2, professionalRating: 2, resolved: false },
      previousRatingAvg: 4.8,
      previousJobsCompleted: 48
    },
    receiptToken: 'receipt-safe-token-101'
  })
  expect(result.qualityCaseOpened).toBeTruthy()
  expect(result.auditEvents.length).toBe(2)
})

test('simulación rechaza recibo público inseguro', () => {
  expect(() => runManagedServiceSimulation({
    adminProfileId: 'admin-100',
    request,
    candidates,
    equipment,
    finalReport,
    review: {
      serviceRating: 5,
      professionalRating: 5,
      problemResolved: true,
      wouldHireAgain: true,
      score: { serviceRating: 5, professionalRating: 5, resolved: true }
    },
    receiptToken: 'short'
  })).toThrow()
})

test('simulación rechaza si no hay profesional elegible', () => {
  expect(() => runManagedServiceSimulation({
    adminProfileId: 'admin-100',
    request,
    candidates: candidates.map((candidate) => ({ ...candidate, status: 'suspended' as const })),
    equipment,
    finalReport,
    review: {
      serviceRating: 5,
      professionalRating: 5,
      problemResolved: true,
      wouldHireAgain: true,
      score: { serviceRating: 5, professionalRating: 5, resolved: true }
    },
    receiptToken: 'receipt-safe-token-102'
  })).toThrow()
})

test('simulación exige registro de equipo válido antes del cierre', () => {
  expect(() => runManagedServiceSimulation({
    adminProfileId: 'admin-100',
    request,
    candidates,
    equipment: { ...equipment, nickname: '' },
    finalReport,
    review: {
      serviceRating: 5,
      professionalRating: 5,
      problemResolved: true,
      wouldHireAgain: true,
      score: { serviceRating: 5, professionalRating: 5, resolved: true }
    },
    receiptToken: 'receipt-safe-token-103'
  })).toThrow()
})
