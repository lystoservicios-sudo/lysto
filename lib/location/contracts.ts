import { z } from 'zod'
import { findArgentineProvince } from './provinces'

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
    context.addIssue({ code: 'too_small', minimum: 2, origin: 'string', inclusive: true, path: ['query'], message: 'query_too_short' })
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

export const addressResolutionInputSchema = addressSelectionSchema.superRefine((value, context) => {
  const province = findArgentineProvince(value.province)
  if (!province || (value.provinceId && findArgentineProvince(value.provinceId)?.id !== province.id))
    context.addIssue({ code: 'custom', path: ['province'], message: 'argentine_province_required' })
})
export type AddressResolutionInput = z.infer<typeof addressResolutionInputSchema>

export const resolvedAddressSchema = addressSelectionSchema.extend({
  provinceId: z.string().min(1).max(20),
  cityId: z.string().min(1).max(30),
  streetId: z.string().min(1).max(40),
  formattedAddress: z.string().min(1).max(500),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  precision: z.enum(['rooftop', 'range_interpolated']),
  source: z.enum(['georef_google', 'georef_openrouteservice', 'georef'])
}).strict().superRefine((value, context) => {
  const province = findArgentineProvince(value.province)
  if (!province || findArgentineProvince(value.provinceId)?.id !== province.id)
    context.addIssue({ code: 'custom', path: ['provinceId'], message: 'province_mismatch' })
})
export type ResolvedAddress = z.infer<typeof resolvedAddressSchema>

