import type { SupabaseClient } from '@supabase/supabase-js'
import type { createClient } from '../../lib/supabase/client.ts'
import type { createServerSupabaseClient } from '../../lib/supabase/server.ts'

type ClientDatabase<TClient> = TClient extends SupabaseClient<infer TDatabase>
  ? TDatabase
  : never
type IsAny<TValue> = 0 extends (1 & TValue) ? true : false
type ExpectFalse<TValue extends false> = TValue

export type BrowserSchemaIsTyped = ExpectFalse<
  IsAny<ClientDatabase<ReturnType<typeof createClient>>>
>

export type ServerSchemaIsTyped = ExpectFalse<
  IsAny<ClientDatabase<Awaited<ReturnType<typeof createServerSupabaseClient>>>>
>
