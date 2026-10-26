import 'server-only'
import { z } from 'zod'

import {
  locationSuggestionInputSchema,
  locationSuggestionSchema,
  type LocationSuggestion,
  type LocationSuggestionInput
} from './contracts'
import { addressSearchQuery, normalizeAddressStreet, normalizeLocationText } from './search-query'

const territory = z.object({ id: z.string(), nombre: z.string() })
const nullableTerritory = z.object({ id: z.string().nullable(), nombre: z.string().nullable() })
// GeoRef legitimately omits the finer locality for some streets. Its census
// locality is still an official, queryable identity; never invent a city/point.
function withLocality<T extends { localidad: z.infer<typeof nullableTerritory>; localidad_censal: z.infer<typeof territory> }>(value: T) {
  return { ...value, localidad: value.localidad.id && value.localidad.nombre
    ? { id: value.localidad.id, nombre: value.localidad.nombre }
    : value.localidad_censal }
}
const page = { cantidad: z.number().int().nonnegative(), total: z.number().int().nonnegative(), inicio: z.number().int().nonnegative(), parametros: z.record(z.string(), z.unknown()) }
const provinceResponse = z.object({ ...page, provincias: z.array(territory.extend({ centroide: z.object({ lat: z.number(), lon: z.number() }) })) })
const locality = territory.extend({
  categoria: z.string(), centroide: z.object({ lat: z.number(), lon: z.number() }), provincia: territory,
  departamento: territory, gobierno_local: territory.nullable(), localidad_censal: territory
})
const localityResponse = z.object({ ...page, localidades: z.array(locality) })
const street = territory.extend({
  categoria: z.string(), nomenclatura: z.string(), provincia: territory, departamento: territory,
  localidad: nullableTerritory, localidad_censal: territory,
  altura: z.object({ inicio: z.object({ derecha: z.number().nullable(), izquierda: z.number().nullable() }), fin: z.object({ derecha: z.number().nullable(), izquierda: z.number().nullable() }) })
}).transform(withLocality)
const streetResponse = z.object({ ...page, calles: z.array(street) })
export const georefAddressSchema = z.object({
  altura: z.object({ unidad: z.string().nullable(), valor: z.union([z.number(), z.string()]) }),
  calle: nullableTerritory.extend({ categoria: z.string().nullable() }),
  calle_cruce_1: nullableTerritory.extend({ categoria: z.string().nullable() }),
  calle_cruce_2: nullableTerritory.extend({ categoria: z.string().nullable() }),
  departamento: territory, localidad: nullableTerritory, localidad_censal: territory,
  nomenclatura: z.string(), piso: z.string().nullable(), provincia: territory,
  ubicacion: z.object({ lat: z.number().nullable(), lon: z.number().nullable() })
}).transform(withLocality)
const addressResponse = z.object({ ...page, direcciones: z.array(georefAddressSchema) })
export type GeorefAddress = z.infer<typeof georefAddressSchema>

const endpoint = 'https://apis.datos.gob.ar/georef/api/v2.0'
const provinceOrder = (id: string) => id === '02' ? 0 : id === '06' ? 1 : 2

function orderAddresses(addresses: GeorefAddress[]) {
  const pointOrder = (address: GeorefAddress) => address.ubicacion.lat !== null && address.ubicacion.lon !== null ? 0 : 1
  return [...addresses].sort((a, b) => pointOrder(a) - pointOrder(b) || provinceOrder(a.provincia.id) - provinceOrder(b.provincia.id) ||
    a.localidad.nombre.localeCompare(b.localidad.nombre, 'es-AR'))
}

function addressContext(address: GeorefAddress) {
  const province = address.provincia.id === '02' ? 'CABA' : address.provincia.nombre
  return [...new Set([address.localidad.nombre, address.departamento.nombre, province, 'Argentina'])].join(' · ')
}

async function get<T>(path: string, params: URLSearchParams, schema: z.ZodType<T, unknown>, fetcher: typeof fetch): Promise<T> {
  const response = await fetcher(`${endpoint}/${path}?${params.toString()}`, {
    cache: 'no-store', signal: AbortSignal.timeout(8_000), headers: { Accept: 'application/json' }
  })
  if (!response.ok) throw new Error('georef_unavailable')
  const parsed = schema.safeParse(await response.json())
  if (!parsed.success) throw new Error('georef_invalid_response')
  return parsed.data
}

function context(input: LocationSuggestionInput) {
  const params = new URLSearchParams({ max: '8' })
  if (input.provinceId || input.province) params.set('provincia', input.provinceId || input.province || '')
  if (input.cityId || input.city) params.set('localidad', input.cityId || input.city || '')
  return params
}

export async function georefAddresses(input: LocationSuggestionInput, fetcher: typeof fetch = fetch, options?: { discovery: boolean }): Promise<GeorefAddress[]> {
  const value = locationSuggestionInputSchema.parse(input)
  if (value.kind !== 'address') throw new Error('address_query_required')
  if (options?.discovery) {
    const query = addressSearchQuery(value)
    if (!query.number || !normalizeAddressStreet(query.street) || !query.provinces.length) return []
    // Partition before max: a popular street in Buenos Aires must not exhaust
    // a combined/national page and hide all CABA matches.
    const results = await Promise.allSettled(query.provinces.flatMap(province => {
      const scopes: Record<string, string>[] = query.cityId ? [{ localidad: query.cityId }] : query.city
        ? [{ localidad: query.city }, { localidad_censal: query.city }] : [{}]
      return scopes.map(scope => get('direcciones', new URLSearchParams({ max: '100', provincia: province,
        direccion: query.direction, ...scope }), addressResponse, fetcher))
    }))
    const pages = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
    if (!pages.length) {
      const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
      throw failure?.reason ?? new Error('georef_unavailable')
    }
    return orderAddresses(pages.flatMap(result => result.direcciones).filter(item =>
      query.provinces.includes(item.provincia.id) && item.calle.id &&
      normalizeAddressStreet(item.calle.nombre ?? '') === normalizeAddressStreet(query.street) &&
      String(item.altura.valor).toLowerCase() === query.number.toLowerCase() &&
      (!query.cityId || item.localidad.id === query.cityId) &&
      (!query.city || [item.localidad.nombre, item.localidad_censal.nombre].some(name => normalizeLocationText(name) === normalizeLocationText(query.city!)))
    ))
  }
  const params = context(value)
  if (!value.provinceId && !value.province) params.set('provincia', '02,06')
  const parts = value.query.split(',').map(part => part.trim())
  const fullAddressWithCity = !value.street && !value.cityId && !value.city && parts.length === 2 && parts.every(Boolean)
  if (fullAddressWithCity) params.set('localidad', parts[1])
  params.set('direccion', value.street ? `${value.street} ${value.query}` : fullAddressWithCity ? parts[0] : value.query)
  const data = await get('direcciones', params, addressResponse, fetcher)
  return data.direcciones
}

export async function suggestLocations(raw: LocationSuggestionInput, fetcher: typeof fetch = fetch): Promise<LocationSuggestion[]> {
  const input = locationSuggestionInputSchema.parse(raw)
  let suggestions: LocationSuggestion[]
  if (input.kind === 'province') {
    const params = new URLSearchParams({ nombre: input.query, max: '8' })
    const data = await get('provincias', params, provinceResponse, fetcher)
    suggestions = data.provincias
      .filter((item) => ['02', '06'].includes(item.id))
      .map((item) => ({ kind: 'province', id: item.id, label: item.nombre, provinceId: item.id, province: item.nombre }))
  } else if (input.kind === 'city') {
    const params = context(input); params.set('nombre', input.query)
    const data = await get('localidades', params, localityResponse, fetcher)
    suggestions = data.localidades.map((item) => ({ kind: 'city', id: item.id, label: item.nombre, secondary: `${item.departamento.nombre}, ${item.provincia.nombre}`, provinceId: item.provincia.id, province: item.provincia.nombre, cityId: item.id, city: item.nombre }))
  } else if (input.kind === 'street') {
    const params = context(input)
    if (!input.provinceId && !input.province) params.set('provincia', '02,06')
    params.set('nombre', input.query)
    const data = await get('calles', params, streetResponse, fetcher)
    suggestions = data.calles.map((item) => ({ kind: 'street', id: item.id, label: item.nombre, secondary: `${item.localidad.nombre}, ${item.provincia.nombre}`, provinceId: item.provincia.id, province: item.provincia.nombre, cityId: item.localidad.id, city: item.localidad.nombre, streetId: item.id, street: item.nombre }))
  } else {
    const discovery = !input.street && !input.streetId
    const data = await georefAddresses(input, fetcher, { discovery })
    suggestions = data.filter((item) => item.calle.id && item.calle.nombre && ['02', '06'].includes(item.provincia.id)).map((item) => ({
      kind: 'address', id: `${item.calle.id}:${item.altura.valor}:${item.localidad.id}`,
      label: discovery ? `${item.calle.nombre} ${item.altura.valor}` : item.nomenclatura,
      ...(discovery ? { secondary: addressContext(item) } : {}),
      provinceId: item.provincia.id, province: item.provincia.nombre, cityId: item.localidad.id, city: item.localidad.nombre,
      streetId: item.calle.id!, street: item.calle.nombre!, number: String(item.altura.valor), latitude: item.ubicacion.lat, longitude: item.ubicacion.lon
    }))
  }
  const seen = new Set<string>()
  const limit = input.kind === 'address' && !input.street && !input.streetId ? 12 : 8
  return z.array(locationSuggestionSchema).parse(suggestions).filter((item) => !seen.has(item.id) && !!seen.add(item.id)).slice(0, limit)
}

