import 'server-only'
import type { Session } from './session'

export type AccountIdentity = { name: string; email: string }
export async function readAccountIdentity(session: Session): Promise<AccountIdentity> {
  const { data, error } = await session.client.from('profiles').select('first_name,last_name,email').eq('id',session.profileId).single()
  if (error || !data) throw new Error('Account identity could not be loaded')
  return { name: [data.first_name,data.last_name].filter(Boolean).join(' ') || data.email, email: data.email }
}
