import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { createSessionReadRepository } from './supabase/read-repository'
export const createAdminQueries = (client: SupabaseClient<Database>) =>
  createSessionReadRepository(client, 'admin')
