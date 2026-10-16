import { z } from 'zod'
import { addressInputSchema, addressMutationInputSchema, type CustomerAssetAddress, type CustomerAssetEquipment } from '@/lib/customer-assets/contracts'

export const HOME_KIND_OPTIONS = [
  { value: 'house', label: 'Casa' }, { value: 'apartment', label: 'Departamento' },
  { value: 'ph', label: 'PH' }, { value: 'office', label: 'Oficina' },
  { value: 'commercial', label: 'Local comercial' }
] as const
export type HomeKind = typeof HOME_KIND_OPTIONS[number]['value']
const residential: HomeKind[] = ['house', 'apartment', 'ph']
const allKinds: HomeKind[] = ['house', 'apartment', 'ph', 'office', 'commercial']
const variants = (...items: [string, string][]) => items.map(([value, label]) => ({ value, id: value, label }))
export const ROOM_CATALOG = {
  living: { label: 'Living', homeKinds: residential, variants: variants(['compact', 'Compacto'], ['family', 'Familiar'], ['dining', 'Con comedor']) },
  bedroom: { label: 'Dormitorio', homeKinds: residential, variants: variants(['principal', 'Principal'], ['double', 'Dos camas'], ['guest', 'Huéspedes']) },
  kitchen: { label: 'Cocina', homeKinds: allKinds, variants: variants(['linear', 'Lineal'], ['l', 'En L'], ['island', 'Con isla']) },
  bathroom: { label: 'Baño', homeKinds: allKinds, variants: variants(['shower', 'Con ducha'], ['bathtub', 'Con bañera'], ['compact', 'Toilette']) },
  office: { label: 'Espacio de trabajo', homeKinds: allKinds, variants: variants(['individual', 'Individual'], ['shared', 'Compartido'], ['studio', 'Estudio']) },
  dining: { label: 'Comedor', homeKinds: allKinds, variants: variants(['compact', 'Compacto'], ['family', 'Familiar']) },
  laundry: { label: 'Lavadero', homeKinds: allKinds, variants: variants(['compact', 'Compacto'], ['separate', 'Independiente']) },
  hall: { label: 'Entrada y pasillo', homeKinds: allKinds, variants: variants(['entrance', 'Entrada'], ['corridor', 'Pasillo']) },
  storage: { label: 'Guardado', homeKinds: allKinds, variants: variants(['closet', 'Vestidor'], ['utility', 'Depósito']) },
  garage: { label: 'Cochera', homeKinds: ['house', 'ph', 'office', 'commercial'] as HomeKind[], variants: variants(['single', 'Un vehículo'], ['double', 'Dos vehículos']) },
  patio: { label: 'Patio', homeKinds: allKinds, variants: variants(['courtyard', 'Patio interior'], ['garden', 'Con jardín']) },
  balcony: { label: 'Balcón', homeKinds: allKinds, variants: variants(['narrow', 'Compacto'], ['wide', 'Amplio']) },
  terrace: { label: 'Terraza', homeKinds: allKinds, variants: variants(['open', 'Abierta'], ['covered', 'Con pérgola']) },
  meeting: { label: 'Sala de reuniones', homeKinds: ['office', 'commercial'] as HomeKind[], variants: variants(['compact', 'Pequeña'], ['boardroom', 'Directorio']) },
  reception: { label: 'Recepción', homeKinds: ['office', 'commercial'] as HomeKind[], variants: variants(['compact', 'Mostrador'], ['lounge', 'Con sala de espera']) },
  commercial: { label: 'Área comercial', homeKinds: ['commercial'] as HomeKind[], variants: variants(['retail', 'Exhibición'], ['open', 'Espacio abierto']) }
} as const
export type RoomKind = keyof typeof ROOM_CATALOG
export const ROOM_OPTIONS = Object.entries(ROOM_CATALOG).map(([value, config]) => ({ value: value as RoomKind, ...config }))
export const ROOM_KINDS = Object.keys(ROOM_CATALOG) as [RoomKind, ...RoomKind[]]
export const WALL_OPTIONS = [
  { value: 'north', label: 'Pared del fondo' }, { value: 'east', label: 'Pared derecha' },
  { value: 'south', label: 'Pared del frente' }, { value: 'west', label: 'Pared izquierda' }
] as const
export const homeFeaturesSchema = z.object({ balcony: z.boolean(), terrace: z.boolean(), windows: z.enum(['small', 'large', 'mixed']) }).strict()
export type HomeFeatures = z.infer<typeof homeFeaturesSchema>
export const homeRoomSchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(1).max(80), kind: z.enum(ROOM_KINDS),
  variant: z.string().max(40), x: z.number().finite().min(-80).max(80), z: z.number().finite().min(-80).max(80),
  width: z.number().finite().min(2).max(12), depth: z.number().finite().min(2).max(12),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]), windows: z.enum(['small', 'large', 'none'])
}).strict().superRefine((room, ctx) => {
  if (!ROOM_CATALOG[room.kind].variants.some(v => v.value === room.variant)) ctx.addIssue({ code: 'custom', path: ['variant'], message: 'Elegí una variante válida del ambiente.' })
})
export type HomeRoom = z.infer<typeof homeRoomSchema>
export const homeFloorSchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(80), order: z.number().int().min(0).max(11), rooms: z.array(homeRoomSchema).max(60) }).strict()
export type HomeFloor = z.infer<typeof homeFloorSchema>
export const placementSchema = z.object({ equipmentId: z.string().uuid(), roomId: z.string().uuid(), wall: z.enum(['north', 'east', 'south', 'west']), offset: z.number().finite().min(0).max(1), height: z.number().finite().min(.35).max(2.5) }).strict()
export type EquipmentPlacement = z.infer<typeof placementSchema>
export type PlacementWall = EquipmentPlacement['wall']
const homeShape = {
  name: z.string().trim().min(1).max(80), addressId: z.string().uuid(),
  kind: z.enum(['house', 'apartment', 'ph', 'office', 'commercial']), building: z.enum(['low', 'high']).nullable(),
  features: homeFeaturesSchema, floors: z.array(homeFloorSchema).min(1).max(12), placements: z.array(placementSchema).max(500)
}
function validateHome(value: Pick<z.infer<z.ZodObject<typeof homeShape>>, 'floors' | 'placements' | 'kind' | 'features'>, ctx: z.RefinementCtx) {
  const ids = new Set<string>(), rooms = new Map<string, HomeRoom>(), orders = new Set<number>()
  for (const [fi, floor] of value.floors.entries()) {
    if (ids.has(floor.id) || orders.has(floor.order)) ctx.addIssue({ code: 'custom', path: ['floors', fi], message: 'Cada planta debe tener una identidad y un orden únicos.' })
    ids.add(floor.id); orders.add(floor.order)
    for (const [ri, room] of floor.rooms.entries()) {
      if (!ROOM_CATALOG[room.kind].homeKinds.includes(value.kind as never)) ctx.addIssue({ code: 'custom', path: ['floors', fi, 'rooms', ri, 'kind'], message: 'Este ambiente no corresponde al tipo de lugar.' })
      if ((room.kind === 'balcony' && !value.features.balcony) || (room.kind === 'terrace' && !value.features.terrace)) ctx.addIssue({ code: 'custom', path: ['features'], message: 'Indicá que el lugar tiene este espacio exterior.' })
      if (ids.has(room.id)) ctx.addIssue({ code: 'custom', path: ['floors', fi, 'rooms', ri], message: 'El ambiente está duplicado.' })
      ids.add(room.id); rooms.set(room.id, room)
      const rw = room.rotation % 180 === 0 ? room.width : room.depth, rd = room.rotation % 180 === 0 ? room.depth : room.width
      if (floor.rooms.slice(0, ri).some(other => {
        const ow = other.rotation % 180 === 0 ? other.width : other.depth, od = other.rotation % 180 === 0 ? other.depth : other.width
        return room.x < other.x + ow - .01 && room.x + rw > other.x + .01 && room.z < other.z + od - .01 && room.z + rd > other.z + .01
      })) ctx.addIssue({ code: 'custom', path: ['floors', fi, 'rooms', ri], message: 'Los ambientes no pueden superponerse.' })
    }
  }
  const equipmentIds = new Set<string>()
  for (const [i, placement] of value.placements.entries()) {
    if (!rooms.has(placement.roomId) || equipmentIds.has(placement.equipmentId)) ctx.addIssue({ code: 'custom', path: ['placements', i], message: 'El equipo debe estar una sola vez en un ambiente de este hogar.' })
    equipmentIds.add(placement.equipmentId)
  }
}
export const createHomeSchema = z.object({ ...homeShape, addressId: z.string().uuid().nullable(), newAddress: addressInputSchema.optional(), idempotencyKey: z.string().uuid() }).strict().superRefine((value, ctx) => {
  validateHome(value, ctx)
  if ((value.addressId !== null) === (value.newAddress !== undefined)) ctx.addIssue({ code: 'custom', path: ['addressId'], message: 'Elegí una dirección guardada o completá una nueva, no ambas.' })
  if (value.placements.length) ctx.addIssue({ code: 'custom', path: ['placements'], message: 'Primero creá el hogar y después ubicá sus equipos.' })
})
export const createHomeMutationSchema = z.object({ ...homeShape, addressId: z.string().uuid().nullable(), newAddress: addressMutationInputSchema.optional(), idempotencyKey: z.string().uuid() }).strict().superRefine((value, ctx) => {
  validateHome(value, ctx)
  if ((value.addressId !== null) === (value.newAddress !== undefined)) ctx.addIssue({ code: 'custom', path: ['addressId'], message: 'Elegí una dirección guardada o completá una nueva, no ambas.' })
  if (value.placements.length) ctx.addIssue({ code: 'custom', path: ['placements'], message: 'Primero creá el hogar y después ubicá sus equipos.' })
})
export const saveHomeSchema = z.object({ ...homeShape, id: z.string().uuid(), expectedVersion: z.number().int().positive() }).strict().superRefine(validateHome)
export const archiveHomeSchema = z.object({ id: z.string().uuid(), expectedVersion: z.number().int().positive() }).strict()
export const homeEquipmentSchema = z.object({ nickname: z.string().trim().min(1).max(100), equipmentType: z.enum(['split', 'inverter', 'on_off', 'window', 'floor_ceiling', 'central']), brand: z.string().trim().max(200).nullable().optional(), model: z.string().trim().max(200).nullable().optional(), serialNumber: z.string().trim().max(200).nullable().optional(), frigorias: z.number().int().min(1000).max(30000).nullable().optional() }).strict()
export const addHomeEquipmentSchema = z.object({ homeId: z.string().uuid(), expectedVersion: z.number().int().positive(), idempotencyKey: z.string().uuid(), equipment: homeEquipmentSchema, placement: placementSchema.omit({ equipmentId: true }) }).strict()
export type CreateHomeInput = z.infer<typeof createHomeSchema>
export type SaveHomeInput = z.infer<typeof saveHomeSchema>
export type AddHomeEquipmentInput = z.infer<typeof addHomeEquipmentSchema>
export type CustomerHome = z.infer<z.ZodObject<typeof homeShape>> & { id: string; version: number; addressIds?: string[] }
export type CustomerHomesSnapshot = { homes: CustomerHome[]; addresses: CustomerAssetAddress[]; equipment: CustomerAssetEquipment[] }
export type CreateHomeResult = { home: CustomerHome; address?: CustomerAssetAddress }
export const customerHomeSchema = z.object({ ...homeShape, id: z.string().uuid(), version: z.number().int().positive(), addressIds: z.array(z.string().uuid()).optional() }).strict().superRefine(validateHome)
