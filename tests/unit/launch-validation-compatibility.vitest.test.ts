import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { geocodeOpenRouteAddress } from '@/lib/location/openrouteservice'

describe('patched validation compatibility', () => {
  it('rejects an oversized bounded collection before validating its elements', () => {
    let visited = 0
    const schema = z.array(z.string().refine(() => { visited += 1; return true })).max(2)
    expect(schema.safeParse(['a', 'b', 'c']).success).toBe(false)
    expect(visited).toBe(0)
  })

  it('keeps exact CABA address verification when optional provider locality fields are absent', async () => {
    const fetcher = vi.fn(async () => Response.json({ features: [{
      geometry: { type: 'Point', coordinates: [-58.397, -34.622] },
      properties: {
        label: 'Pavón 2012, CABA', layer: 'address', housenumber: '2012', street: 'Pavón',
        country_a: 'ARG', region_a: 'C', confidence: 1, accuracy: 'point', match_type: 'exact'
      }
    }] }))
    await expect(geocodeOpenRouteAddress('Pavón 2012, CABA, Argentina', 'synthetic-key', fetcher))
      .resolves.toMatchObject({ province: 'CABA', precision: 'rooftop', longitude: -58.397, latitude: -34.622 })
  })

  it('continues rejecting malformed UUID variants', () => {
    expect(z.string().uuid().safeParse('11111111-1111-1111-1111-111111111111').success).toBe(false)
    expect(z.string().uuid().safeParse('11111111-1111-4111-8111-111111111111').success).toBe(true)
  })
})
