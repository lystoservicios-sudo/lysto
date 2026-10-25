import 'server-only'

import { addressSelectionSchema, resolvedAddressSchema, type AddressSelection, type ResolvedAddress } from './contracts'
import { georefAddresses } from './georef'
import { geocodeVerifiedAddress } from './google-geocoding'
import { geocodeRoutingAddress } from './routing-geocoding'

export async function resolveArgentineAddress(raw: AddressSelection, options?: {
  apiKey?: string
  georefFetcher?: typeof fetch
  googleFetcher?: typeof fetch
  orsApiKey?: string
  orsFetcher?: typeof fetch
}): Promise<ResolvedAddress> {
  const input = addressSelectionSchema.parse(raw)
  if (input.provinceId && !['02', '06'].includes(input.provinceId)) throw new Error('outside_coverage')
  const matches = await georefAddresses({
    kind: 'address', query: input.number, street: input.street, streetId: input.streetId,
    city: input.city, cityId: input.cityId, province: input.province, provinceId: input.provinceId
  }, options?.georefFetcher)
  const exact = matches.filter((item) =>
    String(item.altura.valor) === input.number &&
    (!input.streetId || item.calle.id === input.streetId) &&
    (!input.cityId || item.localidad.id === input.cityId) &&
    (!input.provinceId || item.provincia.id === input.provinceId)
  )
  if (exact.length !== 1 || !exact[0].calle.id || !exact[0].calle.nombre) throw new Error(exact.length ? 'address_ambiguous' : 'address_unresolved')
  const selected = exact[0]
  if (!['02', '06'].includes(selected.provincia.id)) throw new Error('outside_coverage')
  const orsKey = options?.orsApiKey ?? process.env.OPENROUTESERVICE_API_KEY
  const point = orsKey
    ? await geocodeRoutingAddress(selected.nomenclatura, orsKey, options?.orsFetcher, selected)
    : await geocodeVerifiedAddress(selected.nomenclatura, options?.apiKey ?? process.env.GOOGLE_MAPS_SERVER_API_KEY ?? '', options?.googleFetcher)
  const province = selected.provincia.id === '02' ? 'CABA' : 'Buenos Aires'
  if ('province' in point && point.province !== province) throw new Error('address_ambiguous')
  return resolvedAddressSchema.parse({
    street: selected.calle.nombre, number: String(selected.altura.valor), city: selected.localidad.nombre,
    province, provinceId: selected.provincia.id,
    cityId: selected.localidad.id, streetId: selected.calle.id,
    formattedAddress: point.formattedAddress, latitude: point.latitude, longitude: point.longitude, precision: point.precision,
    source: 'coordinateSource' in point && point.coordinateSource === 'georef' ? 'georef' : orsKey ? 'georef_openrouteservice' : 'georef_google'
  })
}

