import { createServerSupabaseClient } from '@/lib/supabase/server'
import { accountRedirect, accountResponse, checkAccountOrigin } from '@/lib/auth/account-response'

export async function POST(request: Request) {
  if (!checkAccountOrigin(request)) return accountResponse(new Response('Origen no permitido.',{status:403}))
  try {
    const client = await createServerSupabaseClient()
    const { data: { user }, error: identityError } = await client.auth.getUser()
    if (identityError || !user) return accountResponse(new Response('Iniciá sesión para continuar.',{status:401}))
    const { error } = await client.auth.signOut({ scope: 'local' })
    if (error) return accountResponse(new Response('No pudimos cerrar la sesión. Intentá nuevamente.',{status:503}))
    return accountRedirect('/login?logout=success')
  } catch { return accountResponse(new Response('No pudimos cerrar la sesión. Intentá nuevamente.',{status:503})) }
}
