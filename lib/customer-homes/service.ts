import 'server-only'
import { z } from 'zod'
import type { Session } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'
import type { Json } from '@/lib/supabase/database.types'
import { addressInputSchema } from '@/lib/customer-assets/contracts'
import { customerHomeSchema, type CustomerHomesSnapshot } from './contracts'

const snapshotSchema = z.object({
  homes: z.array(customerHomeSchema),
  addresses: z.array(addressInputSchema.extend({ id: z.string().uuid(), version: z.number().int().positive(), createdAt: z.string(), archivedAt: z.string().nullable() })),
  equipment: z.array(z.object({ id: z.string().uuid(), nickname: z.string(), addressId: z.string().uuid().nullable(), equipmentType: z.string().nullable(), brand: z.string().nullable(), model: z.string().nullable(), serialNumber: z.string().nullable(), frigorias: z.string().nullable(), version: z.number().int().positive(), createdAt: z.string(), archivedAt: z.string().nullable() }))
}).strict()
function assertCustomer(session: Session) {
  if (session.role !== 'customer' || !session.customerId) throw new ApiError('forbidden')
}
function databaseError(code: string): never {
  if (code === '42501') throw new ApiError('forbidden')
  if (code === 'P0002') throw new ApiError('not_found')
  if (['PT409', '40001', '23505'].includes(code)) throw new ApiError('conflict')
  if (['22023', '22P02', '23514', '23503'].includes(code)) throw new ApiError('invalid_input')
  throw new ApiError('service_unavailable')
}
export async function readCustomerHomes(session: Session): Promise<CustomerHomesSnapshot> {
  assertCustomer(session)
  const { data, error } = await session.client.rpc('read_customer_homes')
  if (error) databaseError(error.code)
  const parsed = snapshotSchema.safeParse(data)
  if (!parsed.success) throw new ApiError('service_unavailable')
  return parsed.data
}
export async function writeCustomerHome(session: Session, operation: 'create' | 'save' | 'archive' | 'equipment', data: Json, id: string | null = null, expectedVersion: number | null = null) {
  assertCustomer(session)
  const result = await session.client.rpc('write_customer_home', { p_operation: operation, p_id: id!, p_expected_version: expectedVersion!, p_data: data })
  if (result.error) databaseError(result.error.code)
  if (!result.data) throw new ApiError('service_unavailable')
  return result.data
}
