import { z } from 'zod'
import { generateDiagnosis } from './rules'

export const preliminaryDiagnosisInput = z
  .object({
    issue: z.enum([
      'no_enfria',
      'pierde_agua',
      'hace_ruido',
      'no_enciende',
      'no_funciona_calor',
      'instalacion',
      'mantenimiento'
    ]),
    timeSince: z.enum(['today', 'days', 'weeks', 'months']),
    hasPhoto: z.boolean().optional(),
    hasVideo: z.boolean().optional()
  })
  .strict()
export function calculatePreliminaryDiagnosis(raw: unknown) {
  return {
    kind: 'preliminary_calculation' as const,
    persisted: false as const,
    diagnosis: generateDiagnosis(preliminaryDiagnosisInput.parse(raw))
  }
}
