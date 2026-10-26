import type { LocationSuggestionInput } from './contracts'

export const normalizeLocationText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export const normalizeAddressStreet = (value: string) => normalizeLocationText(value)
  .replace(/^(?:(?:av|avenida|calle|c|pje|pasaje|diagonal|diag|ruta)\s+)+/, '')

// These are administrative aliases, never street/locality aliases or points.
const provinceNames: Record<string, string[]> = {
  '02': ['ciudad autonoma de buenos aires', 'ciudad de buenos aires', 'capital federal', 'caba'],
  '06': ['provincia de buenos aires', 'buenos aires'],
  '10': ['catamarca'], '14': ['cordoba'], '18': ['corrientes'], '22': ['chaco'], '26': ['chubut'],
  '30': ['entre rios'], '34': ['formosa'], '38': ['jujuy'], '42': ['la pampa'], '46': ['la rioja'],
  '50': ['mendoza'], '54': ['misiones'], '58': ['neuquen'], '62': ['rio negro'], '66': ['salta'],
  '70': ['san juan'], '74': ['san luis'], '78': ['santa cruz'], '82': ['santa fe'],
  '86': ['santiago del estero'], '90': ['tucuman'], '94': ['tierra del fuego']
}
const provinceAliases = Object.entries(provinceNames).flatMap(([id, names]) => names.map(name => ({ id, name })))
  .sort((a, b) => b.name.length - a.name.length)
const countryAliases = [{ id: 'AR', name: 'republica argentina' }, { id: 'AR', name: 'argentina' }]

function takeSuffix(value: string, aliases: { id: string; name: string }[]) {
  const normalized = normalizeLocationText(value)
  const alias = aliases.find(item => normalized === item.name || normalized.endsWith(` ${item.name}`))
  if (!alias) return null
  return { id: alias.id, rest: value.split(/\s+/).slice(0, -alias.name.split(' ').length).join(' ').trim() }
}

export function addressSearchQuery(input: LocationSuggestionInput) {
  const parts = input.query.split(',').map(part => part.trim().replace(/\s+/g, ' ')).filter(Boolean)
  const country = takeSuffix(parts.at(-1) ?? '', countryAliases)
  if (country) {
    if (country.rest) parts[parts.length - 1] = country.rest
    else parts.pop()
  }
  const province = takeSuffix(parts.at(-1) ?? '', provinceAliases)
  if (province) {
    if (province.rest) parts[parts.length - 1] = province.rest
    else parts.pop()
  }
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
  const contextProvince = input.provinceId || provinceAliases.find(item => item.name === normalizeLocationText(input.province ?? ''))?.id ||
    (input.province ? 'unsupported' : undefined)
  const provinceId = province?.id || contextProvince || (input.cityId ? input.cityId.slice(0, 2) : undefined)
  const provinces = provinceId ? ['02', '06'].filter(id => id === provinceId) : ['02', '06']
  // A province typed into the field replaces stale locality IDs from a prior
  // selection; otherwise untouched context keeps its authoritative identity.
  const cityId = !typedCity && !province ? input.cityId : undefined
  const city = typedCity || (!province && !cityId ? input.city : undefined)
  return { street, number, direction: `${street} ${number}`.trim(), provinces, cityId, city }
}
