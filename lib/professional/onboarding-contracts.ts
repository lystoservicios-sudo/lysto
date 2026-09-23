import { z } from 'zod'
import { requiredAirConditioningTools } from './tool-checklist'

const uniqueIds = z
  .array(z.string().uuid())
  .max(50)
  .refine((value) => new Set(value).size === value.length)
export const availabilitySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
    endTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
  })
  .strict()
  .refine((value) => value.startTime < value.endTime)
export const onboardingFields = z
  .object({
    firstName: z.string().trim().max(100),
    lastName: z.string().trim().max(100),
    phone: z.string().trim().max(100),
    dni: z.string().trim().max(100),
    cuil: z.string().trim().max(100),
    birthdate: z
      .string()
      .refine(
        (value) =>
          value === '' ||
          (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
            Number.isFinite(Date.parse(value)) &&
            new Date(value).toISOString().slice(0, 10) === value &&
            value <= new Date().toISOString().slice(0, 10))
      ),
    yearsExperience: z.number().int().min(0).max(80),
    licenseNumber: z.string().trim().max(100),
    licenseEntity: z.string().trim().max(100),
    hasMobility: z.boolean(),
    mobilityType: z.string().trim().max(100),
    bio: z.string().trim().max(2000),
    categoryIds: uniqueIds,
    zoneIds: uniqueIds,
    tools: z
      .array(z.enum(requiredAirConditioningTools))
      .max(requiredAirConditioningTools.length)
      .refine((value) => new Set(value).size === value.length),
    availability: z.array(availabilitySchema).max(50)
  })
  .strict()
export const onboardingInput = onboardingFields
  .extend({ expectedVersion: z.number().int().positive() })
  .strict()
export const onboardingSchema = onboardingFields
  .extend({
    professionalId: z.string().uuid(),
    version: z.number().int().positive(),
    status: z.enum([
      'invited',
      'form_started',
      'form_submitted',
      'under_review',
      'rejected',
      'approved',
      'suspended',
      'inactive'
    ]),
    email: z.string().email()
  })
  .strict()
export type ProfessionalApplication = z.infer<typeof onboardingSchema>
export const reviewRequirementsSchema = z
  .object({
    testOnly: z.boolean(),
    policies: z.array(
      z
        .object({
          categoryId: z.string().uuid(),
          version: z.string(),
          requiredDocuments: z.array(z.string()),
          expiryDocuments: z.array(z.string()),
          requiredTools: z.array(z.string()),
          minExperience: z.number().int(),
          requiresLicense: z.boolean()
        })
        .strict()
    )
  })
  .strict()
export const professionalReviewSchema = z
  .object({
    application: onboardingSchema,
    requirements: reviewRequirementsSchema.nullable(),
    decisionReason: z.string().nullable(),
    eligible: z.boolean(),
    avatarUrl: z.string().url().nullable().optional(),
    readyForNewWork: z.boolean().optional(),
    readinessReasons: z.array(z.enum(['documentos', 'foto', 'mercado_pago'])).optional(),
    documents: z.array(
      z
        .object({
          id: z.string().uuid(),
          documentType: z.string(),
          status: z.enum(['pending', 'approved', 'rejected']),
          version: z.number().int().positive(),
          expiresAt: z.string().nullable(),
          reviewedBy: z.string().uuid().nullable(),
          reviewedAt: z.string().datetime({ offset: true }).nullable(),
          reason: z.string().nullable(),
          inSubmission: z.boolean(),
          createdAt: z.string().datetime({ offset: true })
        })
        .strict()
    )
  })
  .strict()
export type ProfessionalReview = z.infer<typeof professionalReviewSchema>
