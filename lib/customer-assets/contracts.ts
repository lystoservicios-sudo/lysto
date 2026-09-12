import { z } from 'zod'

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()
export const profileInputSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    phone: z
      .string()
      .trim()
      .max(40)
      .refine((value) => value.replace(/\D/g, '').length >= 8),
    notificationPreference: z.enum(['email', 'whatsapp', 'both']),
    expectedVersion: z.number().int().positive()
  })
  .strict()
export const addressInputSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    street: z.string().trim().min(1).max(200),
    number: z.string().trim().min(1).max(30),
    floor: optionalText(100),
    apartment: optionalText(100),
    city: z.string().trim().min(1).max(100),
    province: z.string().trim().min(1).max(100),
    postalCode: optionalText(30),
    reference: optionalText(500),
    propertyType: z.enum(['apartment', 'house', 'commercial', 'office']),
    access: z
      .object({
        hasElevator: z.boolean().optional(),
        hasParking: z.boolean().optional(),
        stairsRequired: z.boolean().optional(),
        outdoorUnitAtHeight: z.boolean().optional(),
        outdoorUnitOnBalcony: z.boolean().optional(),
        difficultAccess: z.boolean().optional()
      })
      .strict(),
    isDefault: z.boolean().default(false)
  })
  .strict()
export const addressUpdateSchema = addressInputSchema
  .extend({ id: z.string().uuid(), expectedVersion: z.number().int().positive() })
  .strict()
export const archiveAssetSchema = z
  .object({ id: z.string().uuid(), expectedVersion: z.number().int().positive() })
  .strict()
export const equipmentInputSchema = z
  .object({
    nickname: z.string().trim().min(1).max(100),
    addressId: z.string().uuid().nullable().optional(),
    equipmentType: z.enum(['split', 'inverter', 'on_off', 'window', 'floor_ceiling', 'central']),
    brand: optionalText(200),
    model: optionalText(200),
    serialNumber: optionalText(200),
    frigorias: z.number().int().min(1000).max(30000).nullable().optional(),
    requestId: z.string().uuid().optional(),
    jobId: z.string().uuid().optional()
  })
  .strict()
export type CustomerAssetProfile = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  notificationPreference: 'email' | 'whatsapp' | 'both'
  version: number
}
export type CustomerAssetAddress = z.infer<typeof addressInputSchema> & {
  id: string
  version: number
  createdAt: string
  archivedAt: string | null
}
export type CustomerAssetEquipment = {
  id: string
  nickname: string
  addressId: string | null
  equipmentType: string | null
  brand: string | null
  model: string | null
  serialNumber: string | null
  frigorias: string | null
  version: number
  createdAt: string
  archivedAt: string | null
}
