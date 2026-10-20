import { describe, expect, it, vi } from 'vitest'

import { suggestLocations } from '@/lib/location/georef'
import { resolveArgentineAddress } from '@/lib/location/resolve'

const response = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

describe('GeoRef location suggestions', () => {
  it('maps official provinces without leaking provider response fields', async () => {
    const fetcher = vi.fn(() => response({ cantidad: 3, total: 3, inicio: 0, parametros: {}, provincias: [
      { id: '06', nombre: 'Buenos Aires', centroide: { lat: -36.6, lon: -60.5 } },
      { id: '02', nombre: 'Ciudad Autónoma de Buenos Aires', centroide: { lat: -34.6, lon: -58.4 } },
      { id: '14', nombre: 'Córdoba', centroide: { lat: -31.4, lon: -64.2 } }
    ] })) as unknown as typeof fetch

    await expect(suggestLocations({ kind: 'province', query: 'buenos' }, fetcher)).resolves.toEqual([
      { kind: 'province', id: '06', label: 'Buenos Aires', provinceId: '06', province: 'Buenos Aires' },
      { kind: 'province', id: '02', label: 'Ciudad Autónoma de Buenos Aires', provinceId: '02', province: 'Ciudad Autónoma de Buenos Aires' }
    ])
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/v2.0/provincias?'), expect.objectContaining({ cache: 'no-store' }))
  })

  it('keeps locality and street identities scoped to the selected province', async () => {
    const fetcher = vi.fn()
      .mockImplementationOnce(() => response({ cantidad: 1, total: 1, inicio: 0, parametros: {}, localidades: [{ id: '0665801007', nombre: 'Quilmes Oeste', categoria: 'Entidad', centroide: { lat: -34.7, lon: -58.3 }, provincia: { id: '06', nombre: 'Buenos Aires' }, departamento: { id: '06658', nombre: 'Quilmes' }, gobierno_local: { id: '060658', nombre: 'Quilmes' }, localidad_censal: { id: '06658010', nombre: 'Quilmes' } }] }))
      .mockImplementationOnce(() => response({ cantidad: 1, total: 1, inicio: 0, parametros: {}, calles: [{ id: '066580100704335', nombre: 'GRL BELGRANO', categoria: 'CALLE', nomenclatura: 'GRL BELGRANO, Quilmes Oeste, Quilmes, Buenos Aires', altura: { inicio: { derecha: 0, izquierda: 0 }, fin: { derecha: 5149, izquierda: 4900 } }, provincia: { id: '06', nombre: 'Buenos Aires' }, departamento: { id: '06658', nombre: 'Quilmes' }, localidad: { id: '0665801007', nombre: 'Quilmes Oeste' }, localidad_censal: { id: '06658010', nombre: 'Quilmes' } }] })) as unknown as typeof fetch

    const cities = await suggestLocations({ kind: 'city', query: 'quilmes', provinceId: '06' }, fetcher)
    const streets = await suggestLocations({ kind: 'street', query: 'belgrano', provinceId: '06', cityId: '0665801007' }, fetcher)
    expect(cities[0]).toMatchObject({ kind: 'city', id: '0665801007', label: 'Quilmes Oeste', provinceId: '06' })
    expect(streets[0]).toMatchObject({ kind: 'street', id: '066580100704335', label: 'GRL BELGRANO', city: 'Quilmes Oeste', province: 'Buenos Aires' })
  })

  it('lets the existing street-first forms suggest only covered Argentine provinces', async () => {
    const fetcher = vi.fn(() => response({ cantidad: 0, total: 0, inicio: 0, parametros: {}, calles: [] })) as unknown as typeof fetch
    await suggestLocations({ kind: 'street', query: 'belgrano' }, fetcher)
    const requested = new URL(String(vi.mocked(fetcher).mock.calls[0][0]))
    expect(requested.searchParams.get('provincia')).toBe('02,06')
  })

  it('returns full selectable addresses even when GeoRef has no coordinate', async () => {
    const fetcher = vi.fn(() => response({ cantidad: 1, total: 158, inicio: 0, parametros: {}, direcciones: [{ altura: { unidad: null, valor: 123 }, calle: { categoria: 'CALLE', id: '066580100704335', nombre: 'GRL BELGRANO' }, calle_cruce_1: { categoria: null, id: null, nombre: null }, calle_cruce_2: { categoria: null, id: null, nombre: null }, departamento: { id: '06658', nombre: 'Quilmes' }, localidad: { id: '0665801007', nombre: 'Quilmes Oeste' }, localidad_censal: { id: '06658010', nombre: 'Quilmes' }, nomenclatura: 'GRL BELGRANO 123, Quilmes Oeste, Quilmes, Buenos Aires', piso: null, provincia: { id: '06', nombre: 'Buenos Aires' }, ubicacion: { lat: null, lon: null } }] })) as unknown as typeof fetch

    await expect(suggestLocations({ kind: 'address', query: '123', street: 'GRL BELGRANO', streetId: '066580100704335', city: 'Quilmes Oeste', cityId: '0665801007', province: 'Buenos Aires', provinceId: '06' }, fetcher)).resolves.toEqual([
      expect.objectContaining({ kind: 'address', label: 'GRL BELGRANO 123, Quilmes Oeste, Quilmes, Buenos Aires', street: 'GRL BELGRANO', number: '123', latitude: null, longitude: null })
    ])
  })
})

describe('canonical address resolution', () => {
  it.each(['google', 'openrouteservice'])('uses %s to verify a selected GeoRef address and canonicalizes CABA', async provider => {
    const georefFetcher = vi.fn(() => response({ cantidad: 1, total: 1, inicio: 0, parametros: {}, direcciones: [{ altura: { unidad: null, valor: 1234 }, calle: { categoria: 'AVENIDA', id: '0200701000085', nombre: 'AV RIVADAVIA' }, calle_cruce_1: { categoria: null, id: null, nombre: null }, calle_cruce_2: { categoria: null, id: null, nombre: null }, departamento: { id: '02007', nombre: 'Comuna 1' }, localidad: { id: '02007010', nombre: 'San Nicolás' }, localidad_censal: { id: '02007010', nombre: 'Ciudad de Buenos Aires' }, nomenclatura: 'AV RIVADAVIA 1234, San Nicolás, Ciudad Autónoma de Buenos Aires', piso: null, provincia: { id: '02', nombre: 'Ciudad Autónoma de Buenos Aires' }, ubicacion: { lat: -34.61, lon: -58.38 } }] })) as unknown as typeof fetch
    const googleFetcher = vi.fn(() => response({ status: 'OK', results: [{ partial_match: false, formatted_address: 'Av. Rivadavia 1234, CABA, Argentina', geometry: { location: { lat: -34.609, lng: -58.389 }, location_type: 'ROOFTOP' }, address_components: [{ long_name: 'Argentina', short_name: 'AR', types: ['country'] }, { long_name: 'Ciudad Autónoma de Buenos Aires', short_name: 'CABA', types: ['administrative_area_level_1'] }] }] })) as unknown as typeof fetch

    const orsFetcher = vi.fn(() => response({ features: [{ geometry: { type: 'Point', coordinates: [-58.389, -34.609] }, properties: {
      label: 'Av. Rivadavia 1234, CABA, Argentina', layer: 'address', housenumber: '1234', confidence: 1, accuracy: 'point', country_a: 'ARG', region: 'Ciudad Autónoma de Buenos Aires'
    } }] }))
    await expect(resolveArgentineAddress({ street: 'AV RIVADAVIA', number: '1234', city: 'San Nicolás', province: 'Ciudad Autónoma de Buenos Aires', streetId: '0200701000085', cityId: '02007010', provinceId: '02' }, { apiKey: 'server-key', georefFetcher, googleFetcher, orsApiKey: provider === 'openrouteservice' ? 'ors-key' : '', orsFetcher })).resolves.toMatchObject({
      street: 'AV RIVADAVIA', number: '1234', city: 'San Nicolás', province: 'CABA', latitude: -34.609, longitude: -58.389, precision: 'rooftop', source: `georef_${provider}`
    })
  })

  it('rejects partial or out-of-coverage Google results', async () => {
    const georefFetcher = vi.fn(() => response({ cantidad: 1, total: 1, inicio: 0, parametros: {}, direcciones: [{ altura: { unidad: null, valor: 1 }, calle: { categoria: 'CALLE', id: 'x', nombre: 'CALLE X' }, calle_cruce_1: { categoria: null, id: null, nombre: null }, calle_cruce_2: { categoria: null, id: null, nombre: null }, departamento: { id: 'x', nombre: 'X' }, localidad: { id: 'x', nombre: 'X' }, localidad_censal: { id: 'x', nombre: 'X' }, nomenclatura: 'CALLE X 1, X, Córdoba', piso: null, provincia: { id: '14', nombre: 'Córdoba' }, ubicacion: { lat: -31.4, lon: -64.2 } }] })) as unknown as typeof fetch
    const googleFetcher = vi.fn(() => response({ status: 'OK', results: [{ partial_match: true, formatted_address: 'Córdoba, Argentina', geometry: { location: { lat: -31.4, lng: -64.2 }, location_type: 'APPROXIMATE' }, address_components: [{ long_name: 'Argentina', short_name: 'AR', types: ['country'] }, { long_name: 'Córdoba', short_name: 'CB', types: ['administrative_area_level_1'] }] }] })) as unknown as typeof fetch

    await expect(resolveArgentineAddress({ street: 'CALLE X', number: '1', city: 'X', province: 'Córdoba', streetId: 'x', cityId: 'x', provinceId: '14' }, { apiKey: 'server-key', georefFetcher, googleFetcher })).rejects.toThrow('outside_coverage')
  })
})
