import { describe, expect, it } from 'vitest'
import { professionalJobCapabilities, professionalDefaultView, professionalExtraState } from '@/lib/professional/job-workspace-model'

const base = { status: 'confirmed', initialPaymentStatus: 'approved', diagnosisStatus: null as string | null, extras: [] as Array<{ status: string; paymentStatus: string | null }> }

describe('professional job capabilities use confirmed server state', () => {
  it.each(['cancelled_by_customer', 'refunded', 'disputed'])('does not present a pending approval after the service becomes %s', status => {
    expect(professionalDefaultView({ role: 'professional', job: { id: '75500000-0000-4000-8000-000000000001', status }, equipmentId: null, visit: null, savedQuote: null, extras: [], finalReport: null, onsiteDiagnosis: { id: '75500000-0000-4000-8000-000000000002', actual_diagnosis: 'Filtros obstruidos', base_scope: 'Limpieza de filtros', evidence_ids: [], status: 'submitted', version: 1, decision_reason: null } })).toBe('summary')
  })
  it('can propose a newly discovered problem while working, but still requires client authorization', () => {
    expect(professionalJobCapabilities({ ...base, status: 'in_progress', diagnosisStatus: 'accepted' }).canProposeExtra).toBe(true)
  })
  it.each([null, 'pending', 'rejected', 'refunded', 'partially_refunded'])('does not allow departure on %s payment', initialPaymentStatus => {
    expect(professionalJobCapabilities({ ...base, initialPaymentStatus }).advance).toBeNull()
  })
  it.each([
    ['confirmed', 'Marcar en camino'], ['technician_on_way', 'Confirmar llegada'], ['arrived', 'Iniciar diagnóstico']
  ])('offers only the real next manual visit action for %s', (status, label) => {
    expect(professionalJobCapabilities({ ...base, status }).advance?.label).toBe(label)
  })
  it('keeps submitted diagnosis read-only, even if a stale status still says diagnosis', () => {
    const state = professionalJobCapabilities({ ...base, status: 'onsite_diagnosis', diagnosisStatus: 'submitted' })
    expect(state.canDiagnose).toBe(false)
    expect(state.waitingApproval).toBe(true)
    expect(state.canWork).toBe(false)
  })
  it('allows requested corrections, not arbitrary edits to submitted/accepted diagnosis', () => {
    expect(professionalJobCapabilities({ ...base, status: 'waiting_customer_approval', diagnosisStatus: 'changes_requested' }).canDiagnose).toBe(true)
    expect(professionalJobCapabilities({ ...base, status: 'waiting_customer_approval', diagnosisStatus: 'accepted' }).canDiagnose).toBe(false)
  })
  it('requires approved scope and actual initial payment for execution and closeout', () => {
    expect(professionalJobCapabilities({ ...base, status: 'in_progress', diagnosisStatus: 'accepted' }).canClose).toBe(true)
    expect(professionalJobCapabilities({ ...base, status: 'in_progress' }).canClose).toBe(false)
    expect(professionalJobCapabilities({ ...base, status: 'in_progress', diagnosisStatus: 'accepted', initialPaymentStatus: 'pending' }).canClose).toBe(false)
  })
  it('does not treat an accepted but unpaid extra as executable', () => {
    expect(professionalExtraState('accepted', 'pending')).toEqual({ label: 'Esperando pago', ready: false, waiting: 'payment' })
    expect(professionalExtraState('proposed', null)).toEqual({ label: 'Esperando aprobación', ready: false, waiting: 'approval' })
    expect(professionalExtraState('accepted', 'approved').ready).toBe(true)
    expect(professionalExtraState('paid', 'refunded').ready).toBe(false)
  })
  it('does not allow closeout while any proposed or accepted extra is unresolved', () => {
    expect(professionalJobCapabilities({ ...base, status: 'in_progress', diagnosisStatus: 'accepted', extras: [{ status: 'accepted', paymentStatus: 'pending' }] }).canClose).toBe(false)
    expect(professionalJobCapabilities({ ...base, status: 'in_progress', diagnosisStatus: 'accepted', extras: [{ status: 'rejected', paymentStatus: null }] }).canClose).toBe(true)
  })
  it.each(['completed', 'completed_pending_customer_confirmation', 'cancelled_by_customer', 'cancelled_by_professional', 'cancelled_by_admin', 'disputed', 'warranty_claim'])('never advances or edits terminal/review job %s', status => {
    const state = professionalJobCapabilities({ ...base, status, diagnosisStatus: 'accepted' })
    expect(state.advance).toBeNull()
    expect(state.canDiagnose || state.canClose || state.canProposeExtra).toBe(false)
  })
  it('treats expired automatic contracts as read-only, not merely confirmed jobs', () => {
    const state = professionalJobCapabilities({ ...base, contractSource: 'automatic_customer_request', requestStatus: 'expired' })
    expect(state.readOnly).toBe(true)
    expect(state.advance).toBeNull()
  })
})
