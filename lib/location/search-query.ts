import type { LocationSuggestionInput } from './contracts'
import { ARGENTINE_PROVINCES, findArgentineProvince } from './provinces'

export const normalizeLocationText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export const normalizeAddressStreet = (value: string) => normalizeLocationText(value)
  .replace(/^(?:(?:av|avenida|calle|c|pje|pasaje|diagonal|diag|ruta)\s+)+/, '')

// These are administrative aliases, never street/locality aliases or points.
const provinceAliases = ARGENTINE_PROVINCES.flatMap(province => [province.name, province.label, ...(province.aliases ?? [])]
  .flatMap(name => [name, `Provincia de ${name}`, `Province de ${name}`])
  .map(name => ({ id: province.id, name: normalizeLocationText(name) })))
  .sort((a, b) => b.name.length - a.name.length)
const countryAliases = [{ id: 'AR', name: 'republica argentina' }, { id: 'AR', name: 'argentina' }]

function takeSuffix(value: string, aliases: { id: string; name: string }[]) {
  const normalized = normalizeLocationText(value)
  const alias = aliases.find(item => normalized === item.name || normalized.endsWith(` ${item.name}`))
  if (!alias) return null
  const words = [...value.matchAll(/[\p{L}\p{N}]+/gu)]
  const firstAliasWord = words[words.length - alias.name.split(' ').length]
  return { id: alias.id, rest: value.slice(0, firstAliasWord.index).replace(/[\s,]+$/, '').trim() }
}

export function addressSearchQuery(input: LocationSuggestionInput) {
  const country = takeSuffix(input.query, countryAliases)
  const withoutCountry = country?.rest ?? input.query
  const province = takeSuffix(withoutCountry, provinceAliases)
  const parts = (province?.rest ?? withoutCountry).split(',').map(part => part.trim().replace(/\s+/g, ' ')).filter(Boolean)
  const address = parts[0] ?? ''
  // The first number after a street name is the height. A leading street type
  // alone is not a name: CALLE 23 5871 and AV 9 DE JULIO 500 retain their numbers.
  const height = [...address.matchAll(/\d+[a-z]?(?=\s|$)/gi)].find(match => {
    const before = address.slice(0, match.index).trim()
    return before.length > 0 && normalizeAddressStreet(before).length > 0 &&
      !/^(av|avenida|calle|c|pje|pasaje|diagonal|diag|ruta)$/i.test(before)
  })
  const street = height ? address.slice(0, height.index).trim() : address
  const number = height?.[0] ?? ''
  const typedCity = (height ? address.slice(height.index! + height[0].length).trim() : '') || parts[1]
  // Only the required province selector controls the provider filter. Province
  // text is parsed for formatting, never to infer or override the selection.
  const selectedProvince = findArgentineProvince(input.provinceId || input.province)
  const provinces = selectedProvince ? [selectedProvince.id] : []
  const cityId = !typedCity ? input.cityId : undefined
  const city = typedCity || (!cityId ? input.city : undefined)
  return { street, number, direction: `${street} ${number}`.trim(), provinces, cityId, city }
}
