import 'server-only'
import { georefAddresses, type GeorefAddress } from './georef'
import { geocodeArgentineOpenRouteAddress, geocodeOpenRouteAddress } from './openrouteservice'
import { findArgentineProvince } from './provinces'

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const streetName = (value: string) => normalize(value).replace(/^(avenida|av|calle) /, '')
const caba = (value: string) => ['caba', 'ciudad autonoma de buenos aires', 'capital federal', 'ciudad de buenos aires'].includes(normalize(value))

async function geocodeAddress(address: string, apiKey: string, fetcher: typeof fetch, selectedAddress: GeorefAddress | undefined, national: boolean) {
  const geocode = national ? geocodeArgentineOpenRouteAddress : geocodeOpenRouteAddress
  try { return { ...await geocode(address, apiKey, fetcher), coordinateSource: 'openrouteservice' as const } }
  catch (error) { if (!(error instanceof Error) || error.message !== 'address_ambiguous') throw error }
  // Pelias may return only a city centroid in Argentina. GeoRef supplies official
  // street/house-number coordinates for some addresses; never use its city centroid.
  const parts = address.split(',').map(part => part.trim()).filter(part => part && normalize(part) !== 'argentina')
  const house = parts[0]?.match(/^(.*?)\s+(\d+)$/)
  if (!house) throw new Error('address_ambiguous')
  const province = selectedAddress ? findArgentineProvince(selectedAddress.provincia.id)
    : parts.slice(1).map(findArgentineProvince).filter(Boolean).at(-1)
  const provinceId = province?.id
  const city = selectedAddress?.localidad.nombre ?? (parts[1] && (parts.length > 2 || !findArgentineProvince(parts[1])) && !caba(parts[1]) ? parts[1] : undefined)
  // The resolver has already revalidated this selection with official IDs.
  // A second name-only lookup can drop its census locality or select a namesake.
  const addresses = selectedAddress ? [selectedAddress]
    : await georefAddresses({ kind: 'address', query: parts[0], ...(provinceId ? { provinceId } : {}), ...(city ? { city } : {}) }, fetcher)
  const matches = addresses.filter(a => String(a.altura.valor) === house[2] && streetName(a.calle.nombre ?? '') === streetName(house[1]) &&
    (national ? Boolean(findArgentineProvince(a.provincia.id)) : ['02', '06'].includes(a.provincia.id)) && (!provinceId || a.provincia.id === provinceId) &&
    (!city || normalize(a.localidad.nombre) === normalize(city)))
  const candidates = matches.filter(a => a.ubicacion.lat !== null && a.ubicacion.lon !== null)
  const unique = [...new Map(candidates.map(a => [`${a.ubicacion.lat},${a.ubicacion.lon}`, a])).values()]
  if (unique.length > 1) throw new Error('address_ambiguous')
  if (!unique.length) return { ...await geocode(address, apiKey, fetcher, {
    street: house[1], number: house[2], city: matches.length === 1 && provinceId !== '02' ? matches[0].localidad_censal.nombre : city,
    province: provinceId === '02' ? 'Ciudad Autónoma de Buenos Aires' : province?.name
  }), coordinateSource: 'openrouteservice' as const }
  const selected = unique[0]
  return { formattedAddress: selected.nomenclatura, latitude: selected.ubicacion.lat!, longitude: selected.ubicacion.lon!,
    province: findArgentineProvince(selected.provincia.id)!.name,
    precision: 'range_interpolated' as const, coordinateSource: 'georef' as const }
}

/** Existing pricing callers retain the commercial province boundary. */
export async function geocodeRoutingAddress(address: string, apiKey: string, fetcher: typeof fetch = fetch, selectedAddress?: GeorefAddress):
  Promise<Awaited<ReturnType<typeof geocodeAddress>> & { province: 'CABA' | 'Buenos Aires' }> {
  const point = await geocodeAddress(address, apiKey, fetcher, selectedAddress, false)
  const province = point.province
  if (province !== 'CABA' && province !== 'Buenos Aires') throw new Error('outside_coverage')
  return { ...point, province }
}

/** This national path requires an exact selection already resolved by GeoRef. */
export function geocodeSelectedArgentineAddress(address: string, apiKey: string, selectedAddress: GeorefAddress, fetcher: typeof fetch = fetch) {
  return geocodeAddress(address, apiKey, fetcher, selectedAddress, true)
}
