import 'server-only'
import { georefAddresses } from './georef'
import { geocodeOpenRouteAddress } from './openrouteservice'

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const streetName = (value: string) => normalize(value).replace(/^(avenida|av|calle) /, '')
const caba = (value: string) => ['caba', 'ciudad autonoma de buenos aires', 'capital federal', 'ciudad de buenos aires'].includes(normalize(value))

export async function geocodeRoutingAddress(address: string, apiKey: string, fetcher: typeof fetch = fetch) {
  try { return { ...await geocodeOpenRouteAddress(address, apiKey, fetcher), coordinateSource: 'openrouteservice' as const } }
  catch (error) { if (!(error instanceof Error) || error.message !== 'address_ambiguous') throw error }
  // Pelias may return only a city centroid in Argentina. GeoRef supplies official
  // street/house-number coordinates for some addresses; never use its city centroid.
  const parts = address.split(',').map(part => part.trim()).filter(part => part && normalize(part) !== 'argentina')
  const house = parts[0]?.match(/^(.*?)\s+(\d+)$/)
  if (!house) throw new Error('address_ambiguous')
  const provinceId = parts.some(caba) ? '02' : parts.some(p => ['buenos aires', 'provincia de buenos aires'].includes(normalize(p))) ? '06' : undefined
  const city = parts[1] && !caba(parts[1]) && normalize(parts[1]) !== 'buenos aires' ? parts[1] : undefined
  const addresses = await georefAddresses({ kind: 'address', query: parts[0], ...(provinceId ? { provinceId } : {}), ...(city ? { city } : {}) }, fetcher)
  const matches = addresses.filter(a => String(a.altura.valor) === house[2] && streetName(a.calle.nombre ?? '') === streetName(house[1]) &&
    ['02', '06'].includes(a.provincia.id) && (!provinceId || a.provincia.id === provinceId) &&
    (!city || normalize(a.localidad.nombre) === normalize(city)))
  const candidates = matches.filter(a => a.ubicacion.lat !== null && a.ubicacion.lon !== null)
  const unique = [...new Map(candidates.map(a => [`${a.ubicacion.lat},${a.ubicacion.lon}`, a])).values()]
  if (unique.length > 1) throw new Error('address_ambiguous')
  if (!unique.length) return { ...await geocodeOpenRouteAddress(address, apiKey, fetcher, {
    street: house[1], number: house[2], city: matches.length === 1 && provinceId === '06' ? matches[0].localidad_censal.nombre : city,
    province: provinceId === '02' ? 'Ciudad Autónoma de Buenos Aires' : provinceId === '06' ? 'Buenos Aires' : undefined
  }), coordinateSource: 'openrouteservice' as const }
  const selected = unique[0]
  return { formattedAddress: selected.nomenclatura, latitude: selected.ubicacion.lat!, longitude: selected.ubicacion.lon!,
    province: selected.provincia.id === '02' ? 'CABA' as const : 'Buenos Aires' as const,
    precision: 'range_interpolated' as const, coordinateSource: 'georef' as const }
}
