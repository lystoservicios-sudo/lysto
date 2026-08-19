import type { PropertyType } from '../domain/types.ts'

export type EquipmentType = 'split' | 'inverter' | 'on_off' | 'window' | 'floor_ceiling' | 'central'
export type EquipmentRoom = 'living' | 'bedroom' | 'office' | 'commercial_area' | 'kitchen' | 'other'

export type EquipmentRegistrationInput = {
  customerId: string
  addressId: string
  nickname: string
  room: EquipmentRoom
  propertyType: PropertyType
  equipmentType: EquipmentType
  brand?: string
  model?: string
  frigorias?: number
  serialNumber?: string
  indoorPhotoCount?: number
  outdoorPhotoCount?: number
  notes?: string
}

export type EquipmentRegistrationResult = {
  ok: true
  normalized: EquipmentRegistrationInput & { nickname: string; brand: string; model: string; photoCompleteness: 'none' | 'partial' | 'complete' }
} | { ok: false; errors: string[] }

export function validateEquipmentRegistration(input: EquipmentRegistrationInput): EquipmentRegistrationResult {
  const errors: string[] = []
  if (!input.customerId.trim()) errors.push('customer_id_required')
  if (!input.addressId.trim()) errors.push('address_id_required')
  if (!input.nickname.trim()) errors.push('nickname_required')
  if (input.frigorias !== undefined && (input.frigorias < 1000 || input.frigorias > 30000)) errors.push('invalid_frigorias')
  const indoor = input.indoorPhotoCount ?? 0
  const outdoor = input.outdoorPhotoCount ?? 0
  if (indoor < 0 || outdoor < 0) errors.push('invalid_photo_count')
  if (errors.length) return { ok: false, errors }
  const photoCompleteness = indoor > 0 && outdoor > 0 ? 'complete' : indoor > 0 || outdoor > 0 ? 'partial' : 'none'
  return {
    ok: true,
    normalized: {
      ...input,
      nickname: input.nickname.trim(),
      brand: input.brand?.trim() || 'Sin marca cargada',
      model: input.model?.trim() || 'Sin modelo cargado',
      photoCompleteness
    }
  }
}

export function equipmentDisplayName(input: Pick<EquipmentRegistrationInput, 'nickname' | 'brand' | 'model'>): string {
  const brand = input.brand?.trim()
  const model = input.model?.trim()
  return [input.nickname.trim(), brand, model].filter(Boolean).join(' · ')
}
