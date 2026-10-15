import { describe, expect, it } from 'vitest'
import { createRequestDraft, getSelectedRequestAnswers, getRequestServiceIssue, getRequestStepErrors, requestDraftReducer } from '@/features/service-request/request-draft'

const equipmentA = '00000000-0000-4000-8000-000000000001'
const equipmentB = '00000000-0000-4000-8000-000000000002'
const location = { homeId: 'home', addressId: 'address', floorId: 'floor', roomId: 'room', homeVersion: 3 }
const withQuote = () => {
  let state = createRequestDraft('actor-a', equipmentA)
  state = requestDraftReducer(state, { type: 'issue', issue: 'pierde_agua' })
  return requestDraftReducer(state, { type: 'quote', quote: { id: 'quote-a', actorId: state.actorId, inputRevision: state.inputRevision } })
}

describe('request draft equipment isolation', () => {
  it('keeps issue and detail answers per air while requesting only the selected one', () => {
    let state = createRequestDraft('actor-a', equipmentA)
    state = requestDraftReducer(state, { type: 'issue', issue: 'pierde_agua' })
    state = requestDraftReducer(state, { type: 'details', details: { kind: 'repair', timeSince: 'weeks', frequency: 'intermittent', description: 'Gotea de noche' } })
    state = requestDraftReducer(state, { type: 'select-equipment', equipmentId: equipmentB })
    expect(getSelectedRequestAnswers(state)).toMatchObject({ purpose: 'repair', issue: null, details: { kind: 'repair', description: '' } })
    state = requestDraftReducer(state, { type: 'issue', issue: 'hace_ruido' })
    state = requestDraftReducer(state, { type: 'select-equipment', equipmentId: equipmentA })
    expect(state.selectedEquipmentId).toBe(equipmentA)
    expect(getSelectedRequestAnswers(state)).toMatchObject({ issue: 'pierde_agua', details: { timeSince: 'weeks', description: 'Gotea de noche' } })
    expect(state.answersByEquipment[equipmentB].issue).toBe('hace_ruido')
  })
  it('maintains a separate new-air draft rather than copying saved-air answers', () => {
    let state = withQuote()
    state = requestDraftReducer(state, { type: 'select-equipment', equipmentId: null })
    expect(getSelectedRequestAnswers(state).issue).toBeNull()
    state = requestDraftReducer(state, { type: 'issue', issue: 'no_enfria' })
    state = requestDraftReducer(state, { type: 'select-equipment', equipmentId: equipmentA })
    expect(getSelectedRequestAnswers(state).issue).toBe('pierde_agua')
  })
  it('resets all sensitive drafts and quotes when the authenticated actor changes', () => {
    const initial = withQuote()
    const state = requestDraftReducer(initial, { type: 'actor', actorId: 'actor-b' })
    expect(state).toEqual({ ...createRequestDraft('actor-b'), inputRevision: initial.inputRevision + 1 })
    expect(JSON.stringify(state)).not.toContain('quote-a')
    expect(JSON.stringify(state)).not.toContain(equipmentA)
  })
  it('does not reset for a refreshed session of the same actor', () => {
    const state = withQuote()
    expect(requestDraftReducer(state, { type: 'actor', actorId: 'actor-a' })).toBe(state)
  })
  it('rejects an old actor quote even when the new actor has the same input revision', () => {
    const initial = createRequestDraft('actor-a', equipmentA)
    const nextActor = requestDraftReducer(initial, { type: 'actor', actorId: 'actor-b' })
    const staleQuote = { id: 'actor-a-quote', actorId: 'actor-a', inputRevision: nextActor.inputRevision }
    expect(requestDraftReducer(nextActor, { type: 'quote', quote: staleQuote }).quote).toBeNull()
  })
  it('rejects an old actor A quote after a session switches from A to B and back to A', () => {
    const initial = createRequestDraft('actor-a', equipmentA)
    const staleQuote = { id: 'old-actor-a-quote', actorId: 'actor-a', inputRevision: initial.inputRevision }
    const actorB = requestDraftReducer(initial, { type: 'actor', actorId: 'actor-b' })
    const freshActorA = requestDraftReducer(actorB, { type: 'actor', actorId: 'actor-a' })
    expect(actorB.inputRevision).toBeGreaterThan(initial.inputRevision)
    expect(freshActorA.inputRevision).toBeGreaterThan(actorB.inputRevision)
    expect(requestDraftReducer(freshActorA, { type: 'quote', quote: staleQuote }).quote).toBeNull()
  })
})

describe('request branches', () => {
  it('discriminates maintenance details and does not require a repair symptom duration', () => {
    let state = createRequestDraft('actor-a', equipmentA)
    state = requestDraftReducer(state, { type: 'purpose', purpose: 'maintenance' })
    state = requestDraftReducer(state, { type: 'details', details: { kind: 'maintenance', lastMaintenance: 'never', description: '' } })
    expect(getSelectedRequestAnswers(state)).toMatchObject({ purpose: 'maintenance', issue: null, details: { kind: 'maintenance' } })
    expect(getRequestServiceIssue(state)).toBe('mantenimiento')
    expect(getRequestStepErrors(state, 'issue')).toEqual([])
    expect(getRequestStepErrors(state, 'details')).toEqual([])
  })
  it('discriminates installation details without carrying repair or maintenance answers', () => {
    let state = withQuote()
    state = requestDraftReducer(state, { type: 'purpose', purpose: 'installation' })
    expect(getSelectedRequestAnswers(state)).toMatchObject({ purpose: 'installation', issue: null, details: { kind: 'installation', description: '' } })
    state = requestDraftReducer(state, { type: 'details', details: { kind: 'installation', installationType: 'relocation', description: 'En el dormitorio' } })
    expect(getRequestServiceIssue(state)).toBe('instalacion')
    expect(getRequestStepErrors(state, 'details')).toEqual([])
    expect(state.quote).toBeNull()
  })
  it('allows an unknown repair symptom without pretending it has a known tariffed issue', () => {
    const state = requestDraftReducer(createRequestDraft('actor-a', equipmentA), { type: 'issue', issue: 'unknown' })
    expect(getRequestStepErrors(state, 'issue')).toEqual([])
    expect(getRequestServiceIssue(state)).toBeNull()
  })
  it('rejects details for a different service branch', () => {
    expect(() => requestDraftReducer(createRequestDraft('actor-a', equipmentA), { type: 'details', details: { kind: 'installation', installationType: 'new', description: '' } })).toThrow('branch')
  })
})

describe('commercial draft invalidation', () => {
  it('clears only the previous symptom context when the repair issue changes', () => {
    const details = { kind: 'repair' as const, timeSince: 'weeks' as const, frequency: 'intermittent' as const, description: 'Gotea de noche', symptomContext: 'Solo mientras está encendido' }
    let state = requestDraftReducer(withQuote(), { type: 'details', details })
    state = requestDraftReducer(state, { type: 'orientation', accepted: true })
    state = requestDraftReducer(state, { type: 'quote', quote: { id: 'water-quote', actorId: state.actorId, inputRevision: state.inputRevision } })
    const changed = requestDraftReducer(state, { type: 'issue', issue: 'hace_ruido' })
    const answers = getSelectedRequestAnswers(changed)
    expect(answers.details).not.toHaveProperty('symptomContext')
    expect(answers.details).toEqual({ kind: 'repair', timeSince: 'weeks', frequency: 'intermittent', description: 'Gotea de noche' })
    expect(answers.issue).toBe('hace_ruido')
    expect(answers.orientationAccepted).toBe(false)
    expect(changed.quote).toBeNull()
    expect(changed.inputRevision).toBe(state.inputRevision + 1)
    expect(getSelectedRequestAnswers(state).details).toMatchObject({ symptomContext: 'Solo mientras está encendido' })
  })
  it('keeps the symptom context when the selected repair issue is unchanged', () => {
    let state = requestDraftReducer(withQuote(), { type: 'details', details: { kind: 'repair', timeSince: 'days', description: '', symptomContext: 'También cuando está apagado' } })
    state = requestDraftReducer(state, { type: 'orientation', accepted: true })
    state = requestDraftReducer(state, { type: 'quote', quote: { id: 'water-quote', actorId: state.actorId, inputRevision: state.inputRevision } })
    expect(requestDraftReducer(state, { type: 'issue', issue: 'pierde_agua' })).toBe(state)
    expect(getSelectedRequestAnswers(state).details).toMatchObject({ symptomContext: 'También cuando está apagado' })
  })
  it('invalidates the quote and acknowledgement when only the repair symptom context changes', () => {
    const details = { kind: 'repair' as const, timeSince: 'days' as const, frequency: 'intermittent' as const, description: '', symptomContext: 'Solo mientras está encendido' }
    let state = requestDraftReducer(withQuote(), { type: 'details', details })
    state = requestDraftReducer(state, { type: 'orientation', accepted: true })
    state = requestDraftReducer(state, { type: 'quote', quote: { id: 'context-quote', actorId: state.actorId, inputRevision: state.inputRevision } })
    const changed = requestDraftReducer(state, { type: 'details', details: { ...details, symptomContext: 'También cuando está apagado' } })
    expect(changed.quote).toBeNull()
    expect(getSelectedRequestAnswers(changed).orientationAccepted).toBe(false)
    expect(changed.inputRevision).toBe(state.inputRevision + 1)
  })
  it('retains the quote and acknowledgement when the repair symptom context is unchanged', () => {
    const details = { kind: 'repair' as const, timeSince: 'days' as const, description: '', symptomContext: 'No sé' }
    let state = requestDraftReducer(withQuote(), { type: 'details', details })
    state = requestDraftReducer(state, { type: 'orientation', accepted: true })
    state = requestDraftReducer(state, { type: 'quote', quote: { id: 'context-quote', actorId: state.actorId, inputRevision: state.inputRevision } })
    expect(requestDraftReducer(state, { type: 'details', details: { ...details } })).toBe(state)
    expect(getSelectedRequestAnswers(state).details).toMatchObject({ symptomContext: 'No sé' })
  })
  it('requires orientation acknowledgement again after changing the repair symptom', () => {
    let state = requestDraftReducer(withQuote(), { type: 'orientation', accepted: true })
    state = requestDraftReducer(state, { type: 'issue', issue: 'no_enfria' })
    expect(getSelectedRequestAnswers(state).orientationAccepted).toBe(false)
  })
  it.each([
    { purpose: 'repair' as const, details: { kind: 'repair' as const, timeSince: 'days' as const, description: 'Empezó ayer' } },
    { purpose: 'maintenance' as const, details: { kind: 'maintenance' as const, lastMaintenance: 'never' as const, description: '' } },
    { purpose: 'installation' as const, details: { kind: 'installation' as const, installationType: 'relocation' as const, description: '' } }
  ])('requires orientation acknowledgement again after changed $purpose details', ({ purpose, details }) => {
    let state = requestDraftReducer(createRequestDraft('actor-a', equipmentA), { type: 'purpose', purpose })
    state = requestDraftReducer(state, { type: 'orientation', accepted: true })
    state = requestDraftReducer(state, { type: 'details', details })
    expect(getSelectedRequestAnswers(state).orientationAccepted).toBe(false)
  })
  it('keeps acknowledgement and the quote for identical symptom or detail answers', () => {
    let state = requestDraftReducer(withQuote(), { type: 'orientation', accepted: true })
    state = requestDraftReducer(state, { type: 'quote', quote: { id: 'acknowledged-quote', actorId: state.actorId, inputRevision: state.inputRevision } })
    expect(requestDraftReducer(state, { type: 'issue', issue: 'pierde_agua' })).toBe(state)
    expect(requestDraftReducer(state, { type: 'details', details: getSelectedRequestAnswers(state).details })).toBe(state)
    expect(requestDraftReducer(state, { type: 'details', details: { description: '', kind: 'repair' } })).toBe(state)
    expect(getSelectedRequestAnswers(state).orientationAccepted).toBe(true)
    expect(state.quote?.id).toBe('acknowledged-quote')
  })
  it('invalidates the quote when changing the selected equipment', () => {
    const state = requestDraftReducer(withQuote(), { type: 'select-equipment', equipmentId: equipmentB })
    expect(state.quote).toBeNull()
    expect(state.inputRevision).toBeGreaterThan(withQuote().inputRevision)
  })
  it.each([
    { type: 'issue' as const, issue: 'no_enfria' as const },
    { type: 'location' as const, location },
    { type: 'schedule' as const, schedule: { preferredDate: '2026-10-20', preferredTimeWindow: '10:00 – 12:00', urgency: 'flexible' as const } },
    { type: 'details' as const, details: { kind: 'repair' as const, timeSince: 'days' as const, description: 'Empezó ayer' } },
    { type: 'characteristics' as const, characteristics: { capacity: 24000, technology: 'unknown' as const } }
  ])('invalidates a quote for a changed $type commercial answer', action => {
    const initial = withQuote()
    const state = requestDraftReducer(initial, action)
    expect(state.quote).toBeNull()
    expect(state.inputRevision).toBe(initial.inputRevision + 1)
  })
  it('preserves a quote and revision when an answer does not change', () => {
    const state = withQuote()
    expect(requestDraftReducer(state, { type: 'issue', issue: 'pierde_agua' })).toBe(state)
    expect(requestDraftReducer(state, { type: 'select-equipment', equipmentId: equipmentA })).toBe(state)
  })
  it('does not attach a stale asynchronous quote after input changed', () => {
    const before = withQuote()
    const changed = requestDraftReducer(before, { type: 'issue', issue: 'hace_ruido' })
    expect(requestDraftReducer(changed, { type: 'quote', quote: { id: 'stale', actorId: before.actorId, inputRevision: before.inputRevision } }).quote).toBeNull()
  })
  it('keeps forward/back navigation separate from commercial answers and price', () => {
    let state = withQuote()
    state = requestDraftReducer(state, { type: 'go-step', step: 'review' })
    state = requestDraftReducer(state, { type: 'go-step', step: 'issue' })
    expect(getSelectedRequestAnswers(state).issue).toBe('pierde_agua')
    expect(state.quote?.id).toBe('quote-a')
    expect(state.inputRevision).toBe(withQuote().inputRevision)
  })
})

describe('request advance validation', () => {
  it('rejects repair symptom context longer than 80 characters', () => {
    const details = { kind: 'repair' as const, timeSince: 'days' as const, description: '', symptomContext: 'a'.repeat(81) }
    const state = requestDraftReducer(createRequestDraft('actor-a', equipmentA), { type: 'details', details })
    expect(getRequestStepErrors(state, 'details')).toEqual(['symptom_context_too_long'])
  })
  it('allows optional symptom context up to 80 characters without replacing the repair frequency', () => {
    const details = { kind: 'repair' as const, timeSince: 'days' as const, frequency: 'constant' as const, description: '', symptomContext: 'a'.repeat(80) }
    const state = requestDraftReducer(createRequestDraft('actor-a', equipmentA), { type: 'details', details })
    expect(getRequestStepErrors(state, 'details')).toEqual([])
    expect(getSelectedRequestAnswers(state).details).toMatchObject({ frequency: 'constant', symptomContext: 'a'.repeat(80) })
  })
  it('requires the explicit symptom selection for a repair', () => {
    expect(getRequestStepErrors(createRequestDraft('actor-a', equipmentA), 'issue')).toEqual(['issue_required'])
  })
  it('requires location identities without storing the full house or postal snapshot', () => {
    let state = createRequestDraft('actor-a', equipmentA)
    expect(getRequestStepErrors(state, 'location')).toContain('location_required')
    state = requestDraftReducer(state, { type: 'location', location })
    expect(getRequestStepErrors(state, 'location')).toEqual([])
    expect(getSelectedRequestAnswers(state).location).toEqual(location)
  })
  it('requires a repair duration, a maintenance history or an installation type according to the branch', () => {
    let state = createRequestDraft('actor-a', equipmentA)
    expect(getRequestStepErrors(state, 'details')).toEqual(['time_since_required'])
    state = requestDraftReducer(state, { type: 'purpose', purpose: 'maintenance' })
    expect(getRequestStepErrors(state, 'details')).toEqual(['maintenance_history_required'])
    state = requestDraftReducer(state, { type: 'purpose', purpose: 'installation' })
    expect(getRequestStepErrors(state, 'details')).toEqual(['installation_type_required'])
  })
  it('requires explicit orientation acknowledgement and a supported visit preference', () => {
    let state = createRequestDraft('actor-a', equipmentA)
    expect(getRequestStepErrors(state, 'orientation')).toEqual(['orientation_required'])
    state = requestDraftReducer(state, { type: 'orientation', accepted: true })
    expect(getRequestStepErrors(state, 'orientation')).toEqual([])
    expect(getRequestStepErrors(state, 'schedule')).toEqual(['preferred_date_required', 'time_window_required'])
    state = requestDraftReducer(state, { type: 'schedule', schedule: { preferredDate: '2026-10-20', preferredTimeWindow: '10:00 – 12:00', urgency: 'flexible' } })
    expect(getRequestStepErrors(state, 'schedule')).toEqual([])
  })
  it('does not regard a malformed calendar day as a valid visit preference', () => {
    const state = requestDraftReducer(createRequestDraft('actor-a', equipmentA), { type: 'schedule', schedule: { preferredDate: '2026-02-31', preferredTimeWindow: 'invented', urgency: 'flexible' } })
    expect(getRequestStepErrors(state, 'schedule')).toEqual(['preferred_date_required', 'time_window_required'])
  })
})
