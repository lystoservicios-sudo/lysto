import 'server-only'

import { addressResolutionInputSchema, resolvedAddressSchema, type ResolvedAddress } from './contracts'
import { georefAddresses } from './georef'
import { geocodeVerifiedAddress } from './google-geocoding'
import { geocodeSelectedArgentineAddress } from './routing-geocoding'
import { findArgentineProvince } from './provinces'

export async function resolveArgentineAddress(raw: unknown, options?: {
  apiKey?: string
  georefFetcher?: typeof fetch
  googleFetcher?: typeof fetch
  orsApiKey?: string
  orsFetcher?: typeof fetch
}): Promise<ResolvedAddress> {
  const input = addressResolutionInputSchema.parse(raw)
  const requestedProvince = findArgentineProvince(input.province)
  if (!requestedProvince) throw new Error('address_ambiguous')
  const matches = await georefAddresses({
    kind: 'address', query: input.number, street: input.street, streetId: input.streetId,
    city: input.city, cityId: input.cityId, province: requestedProvince.name, provinceId: requestedProvince.id
  }, options?.georefFetcher)
  const exact = matches.filter((item) =>
    String(item.altura.valor) === input.number &&
    (!input.streetId || item.calle.id === input.streetId) &&
    (!input.cityId || item.localidad.id === input.cityId) &&
    item.provincia.id === requestedProvince.id
  )
  if (exact.length !== 1 || !exact[0].calle.id || !exact[0].calle.nombre) throw new Error(exact.length ? 'address_ambiguous' : 'address_unresolved')
  const selected = exact[0]
  const orsKey = options?.orsApiKey ?? process.env.OPENROUTESERVICE_API_KEY
  const point = orsKey
    ? await geocodeSelectedArgentineAddress(selected.nomenclatura, orsKey, selected, options?.orsFetcher)
    : await geocodeVerifiedAddress(selected.nomenclatura, options?.apiKey ?? process.env.GOOGLE_MAPS_SERVER_API_KEY ?? '', options?.googleFetcher)
  const province = requestedProvince.name
  if ('province' in point && point.province !== province) throw new Error('address_ambiguous')
  return resolvedAddressSchema.parse({
    street: selected.calle.nombre, number: String(selected.altura.valor), city: selected.localidad.nombre,
    province, provinceId: selected.provincia.id,
    cityId: selected.localidad.id, streetId: selected.calle.id,
    formattedAddress: point.formattedAddress, latitude: point.latitude, longitude: point.longitude, precision: point.precision,
    source: 'coordinateSource' in point && point.coordinateSource === 'georef' ? 'georef' : orsKey ? 'georef_openrouteservice' : 'georef_google'
  })
}

