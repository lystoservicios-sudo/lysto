import 'server-only'
import { z } from 'zod'

import {
  locationSuggestionInputSchema,
  locationSuggestionSchema,
  type LocationSuggestion,
  type LocationSuggestionInput
} from './contracts'

const territory = z.object({ id: z.string(), nombre: z.string() })
const nullableTerritory = z.object({ id: z.string().nullable(), nombre: z.string().nullable() })
const page = { cantidad: z.number().int().nonnegative(), total: z.number().int().nonnegative(), inicio: z.number().int().nonnegative(), parametros: z.record(z.unknown()) }
const provinceResponse = z.object({ ...page, provincias: z.array(territory.extend({ centroide: z.object({ lat: z.number(), lon: z.number() }) })) })
const locality = territory.extend({
  categoria: z.string(), centroide: z.object({ lat: z.number(), lon: z.number() }), provincia: territory,
  departamento: territory, gobierno_local: territory.nullable(), localidad_censal: territory
})
const localityResponse = z.object({ ...page, localidades: z.array(locality) })
const street = territory.extend({
  categoria: z.string(), nomenclatura: z.string(), provincia: territory, departamento: territory,
  localidad: territory, localidad_censal: territory,
  altura: z.object({ inicio: z.object({ derecha: z.number().nullable(), izquierda: z.number().nullable() }), fin: z.object({ derecha: z.number().nullable(), izquierda: z.number().nullable() }) })
})
const streetResponse = z.object({ ...page, calles: z.array(street) })
export const georefAddressSchema = z.object({
  altura: z.object({ unidad: z.string().nullable(), valor: z.union([z.number(), z.string()]) }),
  calle: nullableTerritory.extend({ categoria: z.string().nullable() }),
  calle_cruce_1: nullableTerritory.extend({ categoria: z.string().nullable() }),
  calle_cruce_2: nullableTerritory.extend({ categoria: z.string().nullable() }),
  departamento: territory, localidad: territory, localidad_censal: territory,
  nomenclatura: z.string(), piso: z.string().nullable(), provincia: territory,
  ubicacion: z.object({ lat: z.number().nullable(), lon: z.number().nullable() })
})
const addressResponse = z.object({ ...page, direcciones: z.array(georefAddressSchema) })
export type GeorefAddress = z.infer<typeof georefAddressSchema>

const endpoint = 'https://apis.datos.gob.ar/georef/api/v2.0'

async function get<T>(path: string, params: URLSearchParams, schema: z.ZodType<T>, fetcher: typeof fetch): Promise<T> {
  const response = await fetcher(`${endpoint}/${path}?${params.toString()}`, {
    cache: 'no-store', signal: AbortSignal.timeout(8_000), headers: { Accept: 'application/json' }
  })
  if (!response.ok) throw new Error('georef_unavailable')
  return schema.parse(await response.json())
}

function context(input: LocationSuggestionInput) {
  const params = new URLSearchParams({ max: '8' })
  if (input.provinceId || input.province) params.set('provincia', input.provinceId || input.province || '')
  if (input.cityId || input.city) params.set('localidad', input.cityId || input.city || '')
  return params
}

export async function georefAddresses(input: LocationSuggestionInput, fetcher: typeof fetch = fetch): Promise<GeorefAddress[]> {
  const value = locationSuggestionInputSchema.parse(input)
  if (value.kind !== 'address') throw new Error('address_query_required')
  const params = context(value)
  if (!value.provinceId && !value.province) params.set('provincia', '02,06')
  params.set('direccion', value.street ? `${value.street} ${value.query}` : value.query)
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
    const data = await georefAddresses(input, fetcher)
    suggestions = data.filter((item) => item.calle.id && item.calle.nombre).map((item) => ({
      kind: 'address', id: `${item.calle.id}:${item.altura.valor}:${item.localidad.id}`, label: item.nomenclatura,
      provinceId: item.provincia.id, province: item.provincia.nombre, cityId: item.localidad.id, city: item.localidad.nombre,
      streetId: item.calle.id!, street: item.calle.nombre!, number: String(item.altura.valor), latitude: item.ubicacion.lat, longitude: item.ubicacion.lon
    }))
  }
  const seen = new Set<string>()
  return z.array(locationSuggestionSchema).parse(suggestions).filter((item) => !seen.has(item.id) && !!seen.add(item.id)).slice(0, 8)
}

