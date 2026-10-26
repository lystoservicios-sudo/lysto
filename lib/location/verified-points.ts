import 'server-only'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { resolvedAddressSchema, type ResolvedAddress } from './contracts'
import { geocodeRoutingAddress } from './routing-geocoding'
import { quoteWriter } from '@/lib/pricing/server'
import type { Json } from '@/lib/supabase/database.types'

const pointSchema = z.object({
  formattedAddress: z.string().min(1).max(500), latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180), province: z.enum(['CABA','Buenos Aires']),
  precision: z.enum(['rooftop','range_interpolated']), coordinateSource: z.enum(['georef','openrouteservice','google'])
}).strict()
export type VerifiedRoutingPoint = z.infer<typeof pointSchema>
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()
export function routingAddressKey(address: string) {
  const parts = address.split(',').map(normalize).filter(part => part && part !== 'argentina')
    .map(part => ['ciudad autonoma de buenos aires','capital federal'].includes(part) ? 'caba' : part)
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex')
}
async function storePoint(address: string, point: VerifiedRoutingPoint) {
  const { error } = await quoteWriter().rpc('store_verified_routing_point', {p_key:routingAddressKey(address),p_point:point as Json})
  if (error) throw new Error('location_storage_unavailable')
}
export async function rememberResolvedAddress(address: ResolvedAddress) {
  address = resolvedAddressSchema.parse(address)
  // This cache and its SQL enum belong to commercial routing, not national registration.
  if (!['CABA', 'Buenos Aires'].includes(address.province)) return
  const point = pointSchema.parse({formattedAddress:address.formattedAddress, latitude:address.latitude, longitude:address.longitude,
    province:address.province, precision:address.precision,
    coordinateSource:address.source === 'georef' ? 'georef' : address.source === 'georef_openrouteservice' ? 'openrouteservice' : 'google'})
  const routingAddress = `${address.street} ${address.number}, ${address.city}, ${address.province}, Argentina`
  await storePoint(routingAddress,point)
  // Professional profiles save the provider's formatted address, which may
  // include a department or a different street/province spelling.
  if (routingAddressKey(address.formattedAddress) !== routingAddressKey(routingAddress))
    await storePoint(address.formattedAddress,point)
}
export async function geocodeSavedRoutingAddress(address: string, apiKey: string, fetcher: typeof fetch = fetch): Promise<VerifiedRoutingPoint> {
  try {
    const {data,error} = await quoteWriter().rpc('read_verified_routing_point',{p_key:routingAddressKey(address)})
    const saved = pointSchema.safeParse(data)
    if (!error && saved.success) return saved.data
  } catch { console.warn('verified_location_read_unavailable') }
  const point = pointSchema.parse(await geocodeRoutingAddress(address,apiKey,fetcher))
  // Failure to persist must never substitute an unverified point or block a freshly verified route.
  try { await storePoint(address,point) } catch { console.warn('verified_location_write_unavailable') }
  return point
}
