import { expect, it, vi } from 'vitest'
import { geocodeRoutingAddress } from '@/lib/location/routing-geocoding'
const reply = (value: unknown) => new Response(JSON.stringify(value))
function official(lon: number | null = -58.3934) {
  return { altura: { unidad: null, valor: 2012 }, calle: { categoria: 'AVENIDA', id: '02021', nombre: 'AV PAVON' },
    calle_cruce_1: { id: null, nombre: null, categoria: null }, calle_cruce_2: { id: null, nombre: null, categoria: null },
    departamento: { id: '02021', nombre: 'Comuna 3' }, localidad: { id: '0202101002', nombre: 'San Cristóbal' },
    localidad_censal: { id: '02', nombre: 'CABA' }, provincia: { id: '02', nombre: 'Ciudad Autónoma de Buenos Aires' },
    nomenclatura: 'AV PAVON 2012, San Cristóbal, Ciudad Autónoma de Buenos Aires', piso: null,
    ubicacion: { lat: lon === null ? null : -34.6265, lon } }
}
const geoReply = (direcciones: unknown[]) => ({ cantidad: direcciones.length, total: direcciones.length, inicio: 0, parametros: {}, direcciones })
it('uses an official exact address point when ORS only returns a city centroid', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(reply({ features: [] })).mockResolvedValueOnce(reply(geoReply([official(), official(null)])))
  const result = await geocodeRoutingAddress('Pavon 2012, CABA, Argentina', 'test', fetcher)
  expect(result).toMatchObject({ latitude: -34.6265, longitude: -58.3934, province: 'CABA' })
  expect(String(fetcher.mock.calls[1][0])).toContain('apis.datos.gob.ar')
  expect(new URL(fetcher.mock.calls[1][0]).searchParams.get('provincia')).toBe('02')
})
it.each(['missing-point','wrong-street','wrong-house','ambiguous'])('never substitutes an imprecise official result (%s)', async kind => {
  const candidate = official(kind === 'missing-point' ? null : -58.4)
  if(kind === 'wrong-street') candidate.calle.nombre = 'AV BELGRANO'
  if(kind === 'wrong-house') candidate.altura.valor = 2014
  const candidates = kind === 'ambiguous' ? [candidate, official(-58.9)] : [candidate]
  const fetcher = vi.fn().mockResolvedValueOnce(reply({ features: [] })).mockResolvedValueOnce(reply(geoReply(candidates))).mockImplementation(async () => reply({features:[]}))
  await expect(geocodeRoutingAddress('Pavon 2012, CABA, Argentina', 'test', fetcher)).rejects.toThrow('address_ambiguous')
})
it('retries ORS with separate street, locality and province when GeoRef has no point', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(reply({features:[]})).mockResolvedValueOnce(reply(geoReply([official(null)])))
    .mockResolvedValueOnce(reply({features:[{geometry:{type:'Point',coordinates:[-58.4,-34.6]},properties:{label:'Pavon 2012, San Cristóbal, CABA',layer:'address',housenumber:'2012',country_a:'ARG',region:'Autonomous City of Buenos Aires',accuracy:'point',confidence:1}}]}))
  expect((await geocodeRoutingAddress('Pavon 2012, San Cristóbal, CABA, Argentina','test',fetcher)).coordinateSource).toBe('openrouteservice')
  const url = new URL(fetcher.mock.calls[2][0])
  expect(url.pathname).toBe('/geocode/search/structured')
  expect(url.searchParams.get('address')).toBe('2012 Pavon')
  expect(url.searchParams.get('locality')).toBe('San Cristóbal')
})
it('does not hide an invalid ORS credential with a different geocoder', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', {status:403}))
  await expect(geocodeRoutingAddress('Pavon 2012, CABA, Argentina', 'test', fetcher)).rejects.toThrow('ors_geocoding_http_403')
  expect(fetcher).toHaveBeenCalledTimes(1)
})
