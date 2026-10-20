import { z } from 'zod'

export const locationKindSchema = z.enum(['province', 'city', 'street', 'address'])
export type LocationKind = z.infer<typeof locationKindSchema>

export const locationSuggestionSchema = z.object({
  kind: locationKindSchema,
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(300),
  secondary: z.string().max(300).optional(),
  provinceId: z.string().max(20).optional(),
  province: z.string().max(100).optional(),
  cityId: z.string().max(30).optional(),
  city: z.string().max(100).optional(),
  streetId: z.string().max(40).optional(),
  street: z.string().max(200).optional(),
  number: z.string().max(30).optional(),
  latitude: z.number().finite().nullable().optional(),
  longitude: z.number().finite().nullable().optional()
}).strict()
export type LocationSuggestion = z.infer<typeof locationSuggestionSchema>

export const locationSuggestionInputSchema = z.object({
  kind: locationKindSchema,
  query: z.string().trim().min(1).max(200),
  provinceId: z.string().trim().max(20).optional(),
  province: z.string().trim().max(100).optional(),
  cityId: z.string().trim().max(30).optional(),
  city: z.string().trim().max(100).optional(),
  streetId: z.string().trim().max(40).optional(),
  street: z.string().trim().max(200).optional()
}).strict().superRefine((value, context) => {
  if (value.kind !== 'address' && value.query.length < 2)
    context.addIssue({ code: 'too_small', minimum: 2, type: 'string', inclusive: true, path: ['query'], message: 'query_too_short' })
  if (value.kind === 'city' && !value.provinceId && !value.province)
    context.addIssue({ code: 'custom', path: ['province'], message: 'province_required' })
  if (value.kind === 'address' && value.street && (!value.city || !value.province))
    context.addIssue({ code: 'custom', path: ['street'], message: 'address_context_required' })
})
export type LocationSuggestionInput = z.infer<typeof locationSuggestionInputSchema>

export const addressSelectionSchema = z.object({
  street: z.string().trim().min(1).max(200),
  number: z.string().trim().min(1).max(30),
  city: z.string().trim().min(1).max(100),
  province: z.string().trim().min(1).max(100),
  provinceId: z.string().trim().max(20).optional(),
  cityId: z.string().trim().max(30).optional(),
  streetId: z.string().trim().max(40).optional()
}).strict()
export type AddressSelection = z.infer<typeof addressSelectionSchema>

export const resolvedAddressSchema = addressSelectionSchema.extend({
  provinceId: z.string().min(1).max(20),
  cityId: z.string().min(1).max(30),
  streetId: z.string().min(1).max(40),
  formattedAddress: z.string().min(1).max(500),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  precision: z.enum(['rooftop', 'range_interpolated', 'geometric_center']),
  source: z.enum(['georef_google', 'georef_openrouteservice'])
}).strict()
export type ResolvedAddress = z.infer<typeof resolvedAddressSchema>

