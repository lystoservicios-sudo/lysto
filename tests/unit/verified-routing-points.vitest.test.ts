import { beforeEach, expect, it, vi } from 'vitest'
import { geocodeSavedRoutingAddress, rememberResolvedAddress, routingAddressKey } from '@/lib/location/verified-points'

const state = vi.hoisted(() => ({ rpc: vi.fn(), geocode: vi.fn() }))
vi.mock('@/lib/pricing/server', () => ({ quoteWriter: () => ({ rpc: state.rpc }) }))
vi.mock('@/lib/location/routing-geocoding', () => ({ geocodeRoutingAddress: state.geocode }))
const point = { formattedAddress: 'Pavón 2012, San Cristóbal, CABA', latitude: -34.62658, longitude: -58.39343,
  province: 'CABA', precision: 'range_interpolated', coordinateSource: 'georef' }
beforeEach(() => { state.rpc.mockReset(); state.geocode.mockReset() })
it('reuses the verified point without another provider lookup', async () => {
  state.rpc.mockResolvedValue({data:point,error:null})
  expect(await geocodeSavedRoutingAddress('Pavón 2012, San Cristóbal, CABA, Argentina','key')).toEqual(point)
  expect(state.geocode).not.toHaveBeenCalled()
})
it('stores coordinates verified during address selection under the same routing key', async () => {
  state.rpc.mockResolvedValue({data:null,error:null})
  await rememberResolvedAddress({street:'PAVON',number:'2012',city:'San Cristóbal',province:'CABA',provinceId:'02',cityId:'0202101002',streetId:'02021',
    formattedAddress:point.formattedAddress,latitude:point.latitude,longitude:point.longitude,precision:'range_interpolated',source:'georef'})
  expect(state.rpc).toHaveBeenCalledWith('store_verified_routing_point', expect.objectContaining({
    p_key:routingAddressKey('Pavón 2012, San Cristóbal, CABA, Argentina'),p_point:point
  }))
})
it('keeps different house numbers and localities in different records', () => {
  expect(routingAddressKey('Calle 23 5871, Berazategui, Buenos Aires')).not.toBe(routingAddressKey('Calle 23 5871, La Plata, Buenos Aires'))
  expect(routingAddressKey('Pavon 2012, CABA')).not.toBe(routingAddressKey('Pavon 2014, CABA'))
})
it('looks up legacy addresses once and stores only a successful verification', async () => {
  state.rpc.mockResolvedValue({data:null,error:null}); state.geocode.mockResolvedValue(point)
  expect(await geocodeSavedRoutingAddress('Pavon 2012, San Cristóbal, CABA','key')).toEqual(point)
  expect(state.rpc).toHaveBeenLastCalledWith('store_verified_routing_point',expect.objectContaining({p_point:point}))
  state.rpc.mockClear(); state.geocode.mockRejectedValue(new Error('address_ambiguous'))
  await expect(geocodeSavedRoutingAddress('Calle 23 5871, Berazategui, Buenos Aires','key')).rejects.toThrow('address_ambiguous')
  expect(state.rpc).toHaveBeenCalledTimes(1)
})
it('does not trust malformed stored coordinates', async () => {
  state.rpc.mockResolvedValue({data:{...point,latitude:999},error:null}); state.geocode.mockResolvedValue(point)
  await geocodeSavedRoutingAddress('Pavon 2012, San Cristóbal, CABA','key')
  expect(state.geocode).toHaveBeenCalledTimes(1)
})
