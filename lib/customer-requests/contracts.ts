import { z } from 'zod'
import { TIME_WINDOWS } from '@/lib/domain/constants'
import { quotePolicySchema, routeSchema } from '@/lib/pricing/service-quote'

export const requestIssueSchema = z.enum(['no_enfria', 'pierde_agua', 'hace_ruido', 'no_enciende', 'no_funciona_calor', 'instalacion', 'mantenimiento', 'unknown'])
export const equipmentDeclarationSchema = z.object({
  capacity: z.number().int().min(1000).max(30000).nullable(),
  technology: z.enum(['conventional', 'inverter', 'unknown'])
}).strict()
export const requestPreviewInputSchema = z.object({
  equipmentId: z.string().uuid(), expectedEquipmentVersion: z.number().int().positive(),
  addressId: z.string().uuid(), homeId: z.string().uuid().optional(),
  expectedHomeVersion: z.number().int().positive().optional(), floorId: z.string().uuid().optional(), roomId: z.string().uuid().optional(),
  equipmentDeclaration: equipmentDeclarationSchema.optional(),
  issue: requestIssueSchema, timeSince: z.enum(['today', 'days', 'weeks', 'months']).default('days'),
  description: z.string().trim().max(2000).default(''),
  answers: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,59}$/), z.union([z.string().trim().max(500), z.boolean()]))
    .refine(value => Object.keys(value).length <= 20 && !['customer_description', 'constructor', 'prototype', '__proto__'].some(key => Object.hasOwn(value, key))).default({}),
  preferredDate: z.string().date(), timeWindow: z.enum(TIME_WINDOWS),
  urgency: z.enum(['flexible', 'priority']),
  uploadIntentIds: z.array(z.string().uuid()).max(5).refine(ids => new Set(ids).size === ids.length).default([])
}).strict().superRefine((input, context) => {
  if (Boolean(input.homeId) !== Boolean(input.expectedHomeVersion) ||
    Boolean(input.floorId) !== Boolean(input.roomId) || (input.roomId && !input.homeId))
    context.addIssue({ code: 'custom', message: 'Coherent owned home context required' })
})
export type RequestPreviewInput = z.infer<typeof requestPreviewInputSchema>
export const requestPrepareInputSchema = z.object({ previewId: z.string().uuid(), commandId: z.string().uuid() }).strict()
export type RequestPrepareInput = z.infer<typeof requestPrepareInputSchema>

export const initialLaborScopeSchema = z.object({
  scenario: z.enum(['maintenance', 'deep_maintenance', 'leak', 'board', 'capacitor', 'reversing_valve', 'uninstall', 'installation', 'compressor']),
  label: z.string().trim().min(10).max(300), durationMinutes: z.number().int().min(30).max(480),
  travelBufferMinutes: z.number().int().min(0).max(180), initialLaborOnly: z.literal(true),
  excludesUnpricedParts: z.literal(true), allowsPredictedRepair: z.boolean(),
  allowCustomerEquipmentDeclaration: z.boolean().default(false)
}).strict()
export type InitialLaborScope = z.infer<typeof initialLaborScopeSchema>

const quoteSchema = z.object({
  currency: z.literal('ARS'), total: z.number().positive(), platformFee: z.number().nonnegative(),
  professionalAmount: z.number().nonnegative(), calculatorSubtotal: z.number().positive(),
  reviewReasons: z.array(z.string()), readyToOffer: z.boolean(), scope: z.string(),
  exclusions: z.array(z.string()), expiresAt: z.string().datetime()
}).passthrough()
export const requestResultSchema = z.object({
  status: z.enum(['ready', 'needs_review', 'unavailable', 'price_changed']),
  previewId: z.string().uuid().optional(), jobId: z.string().uuid().optional(),
  requestId: z.string().uuid().optional(), quoteId: z.string().uuid().optional(),
  quote: quoteSchema.optional(), scope: z.string().optional(), exclusions: z.array(z.string()).optional(),
  reason: z.string().optional(), message: z.string().optional(), expiresAt: z.string().datetime({ offset: true }).optional()
}).strict()
export type CustomerRequestResult = z.infer<typeof requestResultSchema>

export const requestContextSchema = z.object({
  context: z.object({
    address: z.object({ id: z.string().uuid(), street: z.string(), number: z.string(), city: z.string(), province: z.string(),
      propertyType: z.enum(['house', 'apartment', 'commercial', 'office']), access: z.record(z.string(), z.boolean().nullable()) }).passthrough(),
    equipment: z.object({ id: z.string().uuid(), version: z.number().int().positive(), nickname: z.string(),
      capacity: z.number().int().nullable(), technology: z.enum(['conventional', 'inverter', 'unknown']), declarationUsed: z.boolean() }).passthrough(),
    home: z.unknown(), floor: z.unknown(), room: z.unknown(), placement: z.unknown()
  }).strict(),
  policy: z.object({ id: z.string().uuid(), quotePolicyId: z.string().uuid(), approvedUntil: z.string(),
    scope: initialLaborScopeSchema }).nullable(),
  quotePolicy: z.object({ id: z.string().uuid().nullable(), policy: quotePolicySchema.nullable() }),
  candidates: z.array(z.object({ professionalId: z.string().uuid(), origin: z.string(), sellerAccountId: z.string() }).strict()),
  reason: z.string().nullable()
}).strict()
export type CustomerRequestContext = z.infer<typeof requestContextSchema>
export const previewPayloadSchema = z.object({
  input: requestPreviewInputSchema, context: requestContextSchema.shape.context,
  policyId: z.string().uuid(), quotePolicyId: z.string().uuid(), quotePolicySnapshot: quotePolicySchema,
  scope: initialLaborScopeSchema, professionalId: z.string().uuid(), sellerAccountId: z.string(),
  origin: z.string(), route: routeSchema, calculatedInput: z.record(z.string(), z.unknown()), quote: quoteSchema,
  liveMode: z.boolean(), expiresAt: z.string().datetime()
}).strict()
