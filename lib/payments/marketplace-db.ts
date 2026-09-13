import { Pool, type PoolClient } from 'pg'

let pool: Pool | undefined
export function paymentDatabase() {
  const connectionString = process.env.MERCADOPAGO_DATABASE_URL
  if (!connectionString) throw new Error('payments_not_configured')
  return pool ??= new Pool({ connectionString, max: 4, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 })
}
export async function paymentTransaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await paymentDatabase().connect()
  try { await client.query('begin'); const result = await work(client); await client.query('commit'); return result }
  catch (error) { await client.query('rollback'); throw error }
  finally { client.release() }
}
export type CheckoutRow = {
  id: string; job_id: string; extra_id: string | null; customer_id: string; professional_id: string;
  seller_account_id: string; amount: string; marketplace_fee: string; professional_amount: string;
  live_mode: boolean; status: string; preference_id: string | null; init_point: string | null; sandbox_init_point: string | null;
  expires_at: Date; created_at: Date; lease_until: Date | null; lease_token: string | null; review_reason: string | null;
}
