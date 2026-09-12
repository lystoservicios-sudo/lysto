// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { closeoutInput } from '@/lib/jobs/closeout-service'

const valid = {
  jobId: '10000000-0000-4000-8000-000000000001',
  equipmentId: '10000000-0000-4000-8000-000000000002',
  realDiagnosis: 'Capacitor fuera de tolerancia',
  workDone: 'Se reemplazó y verificó el arranque',
  partsUsed: [],
  resolutionStatus: 'resolved',
  maintenanceOption: 'none',
  afterPhotoIds: ['10000000-0000-4000-8000-000000000003'],
  idempotencyKey: '10000000-0000-4000-8000-000000000004'
}
describe('job closeout contract', () => {
  it('requires complete text and unique verified-evidence references', () => {
    expect(() => closeoutInput.parse({ ...valid, workDone: 'corto' })).toThrow()
    expect(() => closeoutInput.parse({ ...valid, afterPhotoIds: [] })).toThrow()
    expect(() =>
      closeoutInput.parse({
        ...valid,
        afterPhotoIds: [valid.afterPhotoIds[0], valid.afterPhotoIds[0]]
      })
    ).toThrow()
  })
  it('requires structured UUID ownership references and bounded warranty', () => {
    expect(() => closeoutInput.parse({ ...valid, equipmentId: 'foreign' })).toThrow()
    expect(() => closeoutInput.parse({ ...valid, warrantyDays: 366 })).toThrow()
    expect(closeoutInput.parse(valid).resolutionStatus).toBe('resolved')
  })
})
