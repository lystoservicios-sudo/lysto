import { z } from 'zod'
import type { ServiceQuote } from './service-quote'

// Older accepted snapshots omitted display metadata. Never recalculate their
// amounts or manufacture contractual terms while making them readable.
export const quoteScopeSchema = z.string().nullish().transform(
  value => value?.trim() || 'Alcance no registrado en el presupuesto'
)

export function quotePresentation<T extends Partial<Pick<
  ServiceQuote, 'scope' | 'adjustments' | 'reviewReasons' | 'exclusions'
>>>(quote: T) {
  return {
    ...quote,
    scope: quoteScopeSchema.parse(quote.scope),
    adjustments: quote.adjustments ?? [],
    reviewReasons: quote.reviewReasons ?? [],
    exclusions: quote.exclusions ?? []
  }
}
