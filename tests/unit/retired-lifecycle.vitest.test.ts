import { describe, expect, it } from 'vitest'
import { POST as advance } from '@/app/api/jobs/advance/route'
import { POST as update } from '@/app/api/jobs/update-status/route'
import { POST as assign } from '@/app/api/admin/assign-professional/route'
import { POST as webhook } from '@/app/api/payments/webhook/apply/route'

describe('retired simulated lifecycle commands', () => {
  it.each([['advance', advance], ['update', update], ['webhook', webhook], ['assign', assign]] as const)('%s cannot claim a mutation from caller supplied state', async (_, post) => {
    const result = await post(new Request('https://lysto.test/api', { method: 'POST', body: JSON.stringify({ current: 'confirmed', next: 'technician_on_way', currentStatus: 'pending', event: { id: 'e', type: 'payment', status: 'approved' } }) }))
    expect(result.status).toBe(410)
    expect(await result.json()).toMatchObject({ error: 'endpoint_retired' })
  })
})
