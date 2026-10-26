import { describe, expect, it, vi } from 'vitest'

import { suggestLocations } from '@/lib/location/georef'
import type { LocationSuggestionInput } from '@/lib/location/contracts'
import * as provinceCatalog from '@/lib/location/provinces'

// Official identities and coordinates observed from the public GeoRef v2 API.
const caba = {
  altura: { unidad: null, valor: 1234 }, calle: { categoria: 'AV', id: '020070100501185', nombre: 'AV CORRIENTES' },
  calle_cruce_1: { categoria: null, id: null, nombre: null }, calle_cruce_2: { categoria: null, id: null, nombre: null },
  departamento: { id: '02007', nombre: 'Comuna 1' }, localidad: { id: '0200701005', nombre: 'San Nicolás' },
  localidad_censal: { id: '02007010', nombre: 'CABA - Comuna 1' },
  nomenclatura: 'AV CORRIENTES 1234, San Nicolás, Comuna 1, Ciudad Autónoma de Buenos Aires', piso: null,
  provincia: { id: '02', nombre: 'Ciudad Autónoma de Buenos Aires' },
  ubicacion: { lat: -34.603856329602046, lon: -58.384190181306124 }
}
const census = { ...caba, altura: { unidad: null, valor: 5871 },
  calle: { categoria: 'CALLE', id: '060910100000920', nombre: 'CALLE 23' },
  provincia: { id: '06', nombre: 'Buenos Aires' }, departamento: { id: '06091', nombre: 'Berazategui' },
  localidad: { id: null, nombre: null }, localidad_censal: { id: '06091010', nombre: 'Berazategui' },
  nomenclatura: 'CALLE 23 5871, Berazategui, Berazategui, Buenos Aires',
  ubicacion: { lat: -34.76484579742857, lon: -58.19177827271429 }
}
const west = { ...census, calle: { ...census.calle, id: '060910100200920' },
  localidad: { id: '0609101002', nombre: 'Berazategui Oeste' }, ubicacion: { lat: null, lon: null } }
type Entry = Omit<typeof caba, 'localidad' | 'ubicacion'> & {
  localidad: { id: string | null; nombre: string | null }
  ubicacion: { lat: number | null; lon: number | null }
}
const page = (direcciones: Entry[]) => new Response(JSON.stringify({ cantidad: direcciones.length, total: direcciones.length, inicio: 0, parametros: {}, direcciones }), { status: 200 })
function provider(entries: (params: URLSearchParams) => Entry[]) {
  return vi.fn(async (url: Parameters<typeof fetch>[0]) => page(entries(new URL(String(url)).searchParams)))
}
const requests = (fetcher: ReturnType<typeof provider>) => fetcher.mock.calls.map(([url]) => new URL(String(url)).searchParams)

describe('Argentine province catalog', () => {
  const officialProvinces = [
    ['02', 'CABA'], ['06', 'Buenos Aires'], ['10', 'Catamarca'], ['14', 'Córdoba'], ['18', 'Corrientes'],
    ['22', 'Chaco'], ['26', 'Chubut'], ['30', 'Entre Ríos'], ['34', 'Formosa'], ['38', 'Jujuy'],
    ['42', 'La Pampa'], ['46', 'La Rioja'], ['50', 'Mendoza'], ['54', 'Misiones'], ['58', 'Neuquén'],
    ['62', 'Río Negro'], ['66', 'Salta'], ['70', 'San Juan'], ['74', 'San Luis'], ['78', 'Santa Cruz'],
    ['82', 'Santa Fe'], ['86', 'Santiago del Estero'], ['90', 'Tucumán'],
    ['94', 'Tierra del Fuego, Antártida e Islas del Atlántico Sur']
  ]

  it('contains the 23 provinces and CABA with their official unique IDs and canonical names', () => {
    expect(provinceCatalog.ARGENTINE_PROVINCES).toBeDefined()
    expect(provinceCatalog.ARGENTINE_PROVINCES.map(item => [item.id, item.name])).toEqual(officialProvinces)
    expect(new Set(provinceCatalog.ARGENTINE_PROVINCES.map(item => item.id)).size).toBe(24)
  })

  it('finds every province by ID, canonical name and display label', () => {
    expect(provinceCatalog.findArgentineProvince).toBeTypeOf('function')
    for (const province of provinceCatalog.ARGENTINE_PROVINCES) {
      for (const value of [province.id, province.name, province.label]) {
        expect(provinceCatalog.findArgentineProvince(value)).toBe(province)
      }
    }
  })

  it.each([['Ciudad Autónoma de Buenos Aires', '02'], ['Capital Federal', '02'], [' Ciudad de Buenos Aires ', '02'],
    ['provincia de CORDOBA', '14'], ['Province de Santa Fe', '82'], ['Provincia de Buenos Aires', '06'],
    ['Provincia de Neuquen', '58'], ['Tierra del Fuego', '94']])('normalizes province alias %s', (value, id) => {
    expect(provinceCatalog.findArgentineProvince).toBeTypeOf('function')
    expect(provinceCatalog.findArgentineProvince(value)?.id).toBe(id)
  })

  it.each([undefined, null, '', 'Argentina', 'ES', '99', 'Atlantis', 'Cord'])('does not guess an unknown province from %s', value => {
    expect(provinceCatalog.findArgentineProvince).toBeTypeOf('function')
    expect(provinceCatalog.findArgentineProvince(value)).toBeUndefined()
  })
})

describe('full address search regressions', () => {
  it('survives a failed census scope while preserving only exact matches from the successful locality scope', async () => {
    const wrongStreet = { ...caba, calle: { ...caba.calle, id: 'other-street', nombre: 'CABO CORRIENTES' } }
    const wrongHeight = { ...caba, altura: { unidad: null, valor: 123 } }
    const fetcher = vi.fn(async (url: Parameters<typeof fetch>[0]) =>
      new URL(String(url)).searchParams.has('localidad')
        ? page([wrongStreet, wrongHeight, caba]) : new Response(null, { status: 503 }))
    await expect(suggestLocations({ kind: 'address', query: 'Corrientes 1234, San Nicolás', provinceId: '02' }, fetcher)).resolves.toEqual([
      expect.objectContaining({ streetId: caba.calle.id, cityId: caba.localidad.id, number: '1234', latitude: caba.ubicacion.lat, longitude: caba.ubicacion.lon })
    ])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('survives a failed finer-locality scope without losing the official census identity', async () => {
    const fetcher = vi.fn(async (url: Parameters<typeof fetch>[0]) =>
      new URL(String(url)).searchParams.has('localidad_censal')
        ? page([census]) : new Response(null, { status: 503 }))
    await expect(suggestLocations({ kind: 'address', query: 'Calle 23 5871, Berazategui, Buenos Aires', provinceId: '06' }, fetcher)).resolves.toEqual([
      expect.objectContaining({ streetId: census.calle.id, cityId: census.localidad_censal.id, number: '5871', latitude: census.ubicacion.lat, longitude: census.ubicacion.lon })
    ])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('preserves a recoverable provider error when every scope fails', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 503 }))
    await expect(suggestLocations({ kind: 'address', query: 'Corrientes 1234, San Nicolás', provinceId: '02' }, fetcher)).rejects.toThrow('georef_unavailable')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it.each(['Corrientes', 'Calle 23, Berazategui'])('does not invent a house number for %s', async query => {
    const fetcher = provider(() => [caba])
    await expect(suggestLocations({ kind: 'address', query, provinceId: '06' }, fetcher)).resolves.toEqual([])
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('queries only the selected province before max and excludes homonyms in another province', async () => {
    const ba = { ...caba, provincia: { id: '06', nombre: 'Buenos Aires' }, localidad: { id: '06805010', nombre: 'Tigre' }, calle: { ...caba.calle, id: '068050100002780', nombre: 'CORRIENTES' } }
    const national = { ...ba, provincia: { id: '14', nombre: 'Córdoba' } }
    const fetcher = provider(() => [national, ba, caba])
    const results = await suggestLocations({ kind: 'address', query: 'Corrientes 1234', provinceId: '02' }, fetcher)
    expect(requests(fetcher).map(params => params.get('provincia'))).toEqual(['02'])
    expect(results.map(item => item.provinceId)).toEqual(['02'])
    expect(results[0]).toMatchObject({ streetId: caba.calle.id, city: 'San Nicolás', latitude: caba.ubicacion.lat })
  })

  it.each(['Corrientes 1234, CABA', 'Corrientes1234,CABA,Argentina', 'Corrientes 1234 Ciudad Autónoma de Buenos Aires Argentina', 'Corrientes 1234, Capital Federal, República Argentina'])('keeps the explicit CABA scope in %s', async query => {
    const fetcher = provider(() => [caba])
    const results = await suggestLocations({ kind: 'address', query, provinceId: '02' }, fetcher)
    expect(requests(fetcher)).toHaveLength(1)
    expect(Object.fromEntries(requests(fetcher)[0])).toMatchObject({ direccion: 'Corrientes 1234', provincia: '02' })
    expect(requests(fetcher)[0].has('localidad')).toBe(false)
    expect(results).toHaveLength(1)
    expect(results[0].cityId).toBe(caba.localidad.id)
  })

  it.each(['Calle 23 5871, Berazategui, Buenos Aires, Argentina', 'Calle 23 5871 Berazategui Buenos Aires Argentina'])('separates numbered street, height and explicit locality in %s', async query => {
    const fetcher = provider(params => params.has('localidad_censal') ? [west, census] : [west])
    const results = await suggestLocations({ kind: 'address', query, provinceId: '06', cityId: '0665801007', city: 'Quilmes Oeste' }, fetcher)
    expect(requests(fetcher)).toHaveLength(2)
    for (const params of requests(fetcher)) {
      expect(params.get('direccion')).toBe('Calle 23 5871')
      expect(params.get('provincia')).toBe('06')
      expect(params.get('localidad') ?? params.get('localidad_censal')).toBe('Berazategui')
    }
    expect(results.map(item => item.streetId)).toEqual([census.calle.id, west.calle.id])
    expect(results[0]).toMatchObject({ cityId: '06091010', city: 'Berazategui', latitude: census.ubicacion.lat })
    expect(results[1]).toMatchObject({ cityId: '0609101002', city: 'Berazategui Oeste', latitude: null })
  })

  it('honors the selected locality identity when no locality is typed', async () => {
    const fetcher = provider(() => [west])
    await suggestLocations({ kind: 'address', query: 'Calle 23 5871', provinceId: '06', cityId: '0609101002', city: 'Berazategui Oeste' }, fetcher)
    expect(requests(fetcher)).toHaveLength(1)
    expect(Object.fromEntries(requests(fetcher)[0])).toMatchObject({ direccion: 'Calle 23 5871', provincia: '06', localidad: '0609101002' })
  })

  it('does not broaden the selected locality when another province is written in the query', async () => {
    const fetcher = provider(() => [census, west])
    const results = await suggestLocations({ kind: 'address', query: 'Calle 23 5871, CABA', provinceId: '06', cityId: '0609101002', city: 'Berazategui Oeste' }, fetcher)
    expect(requests(fetcher)).toHaveLength(1)
    expect(Object.fromEntries(requests(fetcher)[0])).toMatchObject({ direccion: 'Calle 23 5871', provincia: '06', localidad: '0609101002' })
    expect(results.map(item => item.streetId)).toEqual([west.calle.id])
    expect(results[0].latitude).toBeNull()
  })

  it('lets an explicit locality replace a stale locality ID, while retaining the province context', async () => {
    const fetcher = provider(params => params.has('localidad_censal') ? [west, census] : [west])
    const results = await suggestLocations({ kind: 'address', query: 'Calle 23 5871, Berazategui', provinceId: '06', cityId: '0665801007', city: 'Quilmes Oeste' }, fetcher)
    expect(requests(fetcher)).toHaveLength(2)
    expect(requests(fetcher).every(params => params.get('provincia') === '06' && (params.get('localidad') ?? params.get('localidad_censal')) === 'Berazategui')).toBe(true)
    expect(results[0].streetId).toBe(census.calle.id)
  })

  it('does not substitute the census point when the user explicitly asks for Oeste', async () => {
    const fetcher = provider(() => [census, west])
    const results = await suggestLocations({ kind: 'address', query: 'Calle 23 5871 Berazategui Oeste', provinceId: '06' }, fetcher)
    expect(results.map(item => item.streetId)).toEqual([west.calle.id])
    expect(results[0].latitude).toBeNull()
  })

  it('removes another street, a different height, outside provinces and duplicate identities', async () => {
    const wrongStreet = { ...caba, calle: { ...caba.calle, id: 'other-street', nombre: 'CABO CORRIENTES' } }
    const wrongHeight = { ...caba, altura: { unidad: null, valor: 123 } }
    const outside = { ...caba, provincia: { id: '14', nombre: 'Córdoba' } }
    const noPoint = { ...caba, ubicacion: { lat: null, lon: null } }
    const fetcher = provider(() => [wrongStreet, wrongHeight, outside, noPoint, caba, caba])
    const results = await suggestLocations({ kind: 'address', query: 'Corrientes 1234, CABA', provinceId: '02' }, fetcher)
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ street: 'AV CORRIENTES', number: '1234', latitude: caba.ubicacion.lat })
  })

  it('keeps street name dates intact when extracting the house number and locality', async () => {
    const fetcher = provider(() => [])
    await suggestLocations({ kind: 'address', query: '25 de Mayo 500 9 de Julio Buenos Aires', provinceId: '06' }, fetcher)
    expect(Object.fromEntries(requests(fetcher)[0])).toMatchObject({ direccion: '25 de Mayo 500', provincia: '06', localidad: '9 de Julio' })
  })

  it('returns at most twelve useful matches and ranks real provider points ahead of missing points', async () => {
    const entries = Array.from({ length: 25 }, (_, index) => ({ ...caba, calle: { ...caba.calle, id: 'street-' + index }, localidad: { id: 'city-' + index, nombre: 'Barrio ' + index }, ubicacion: index === 24 ? caba.ubicacion : { lat: null, lon: null } }))
    const fetcher = provider(() => entries)
    const results = await suggestLocations({ kind: 'address', query: 'Corrientes 1234, CABA', provinceId: '02' }, fetcher)
    expect(results).toHaveLength(12)
    expect(results[0].streetId).toBe('street-24')
  })

  it.each([{ query: 'Corrientes 1234' }, { query: 'Corrientes 1234, Córdoba' }, { query: 'Corrientes 1234, CABA', cityId: '0200701005' }, { query: 'Corrientes 1234', provinceId: 'ES' }])('does not search without an explicit valid selected province: %j', async context => {
    const fetcher = provider(() => [caba])
    await expect(suggestLocations({ kind: 'address', ...context } as LocationSuggestionInput, fetcher)).resolves.toEqual([])
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([{ provinceId: '06', province: 'Buenos Aires' }, { province: 'Buenos Aires' }])('keeps the selected province authoritative over CABA written in the address: %j', async context => {
    const ba = { ...caba, provincia: { id: '06', nombre: 'Buenos Aires' }, calle: { ...caba.calle, id: '068050100002780', nombre: 'CORRIENTES' }, localidad: { id: '06805010', nombre: 'Tigre' } }
    const fetcher = provider(() => [caba, ba])
    const results = await suggestLocations({ kind: 'address', query: 'Corrientes 1234, CABA, Argentina', ...context }, fetcher)
    expect(requests(fetcher).map(params => params.get('provincia'))).toEqual(['06'])
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ provinceId: '06', city: 'Tigre', streetId: ba.calle.id })
  })

  it.each([['14', 'Córdoba'], ['82', 'Santa Fe']])('supports province %s before the provider limit', async (id, name) => {
    const selected = { ...caba, provincia: { id, nombre: name }, calle: { ...caba.calle, id: id + '-official-street' }, ubicacion: { lat: null, lon: null } }
    const fetcher = provider(() => [caba, selected])
    const results = await suggestLocations({ kind: 'address', query: 'Corrientes 1234, Buenos Aires', provinceId: id }, fetcher)
    expect(requests(fetcher).map(params => params.get('provincia'))).toEqual([id])
    expect(requests(fetcher)[0].get('direccion')).toBe('Corrientes 1234')
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ provinceId: id, province: name, streetId: selected.calle.id, latitude: null, longitude: null })
  })

  it('parses the full official Tierra del Fuego name despite its internal comma', async () => {
    const fetcher = provider(() => [])
    await suggestLocations({ kind: 'address', provinceId: '94', query: 'Corrientes 1234, Ushuaia, Tierra del Fuego, Antártida e Islas del Atlántico Sur, Argentina' }, fetcher)
    expect(requests(fetcher)).toHaveLength(2)
    for (const params of requests(fetcher)) {
      expect(params.get('direccion')).toBe('Corrientes 1234')
      expect(params.get('provincia')).toBe('94')
      expect(params.get('localidad') ?? params.get('localidad_censal')).toBe('Ushuaia')
    }
  })
})
