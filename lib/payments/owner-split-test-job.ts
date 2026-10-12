import { z } from 'zod'
import { quoteWriter } from '@/lib/pricing/server'

type OwnerSplitTestJobInput = {
  actorUserId: string
  actorSessionId: string
  customerId: string
  professionalId: string
  quote: unknown
}

export async function createOwnerSplitTestJob(input: OwnerSplitTestJobInput) {
  const writer = quoteWriter() as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{
      data: unknown
      error: { code?: string; message: string } | null
    }>
  }
  const { data, error } = await writer.rpc('create_owner_marketplace_split_test_job', {
    p_actor_user_id: input.actorUserId,
    p_actor_session_id: input.actorSessionId,
    p_customer_id: input.customerId,
    p_professional_id: input.professionalId,
    p_quote: input.quote
  })
  if (error) throw new Error(`owner_split_test_job:${error.code ?? 'write_failed'}`)
  return z.string().uuid().parse(data)
}
