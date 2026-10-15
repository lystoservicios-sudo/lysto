import { calculateServiceQuote, type QuoteInput, type QuotePolicy } from '@/lib/pricing/service-quote'
import { initialLaborScopeSchema, type InitialLaborScope } from './contracts'

/** A different, explicitly approved contract; it never changes the legacy calculator. */
export function calculateInitialLaborQuote(input: QuoteInput, policy: QuotePolicy, rawScope: Omit<InitialLaborScope, 'allowCustomerEquipmentDeclaration'> & { allowCustomerEquipmentDeclaration?: boolean }, now = new Date()) {
  const scope = initialLaborScopeSchema.parse(rawScope)
  if (!['mantenimiento', 'instalacion'].includes(input.issue) && !scope.allowsPredictedRepair)
    throw new Error('initial_scope_unavailable')
  const quote = calculateServiceQuote({ ...input, scenario: scope.scenario, materials: [], materialsConfirmed: false }, policy, now)
  const reviewReasons = quote.reviewReasons.filter(reason =>
    reason !== 'materials_unconfirmed' && (reason !== 'diagnosis_required' || !scope.allowsPredictedRepair))
  return { ...quote, scope: scope.label, contractScope: 'initial_labor' as const,
    reviewReasons, readyToOffer: reviewReasons.length === 0 }
}
