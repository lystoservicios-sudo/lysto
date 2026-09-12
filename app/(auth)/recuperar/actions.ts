'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { accountFormText, assertAccountMutationOrigin } from '@/lib/auth/account-server'
import { authOrigin, recoverAccount, type AccountResult } from '@/lib/auth/account-lifecycle'
import { enforceRateLimit, serverActionSubject } from '@/lib/security/rate-limit'

export async function recoverAction(
  _previous: AccountResult,
  form: FormData
): Promise<AccountResult> {
  try {
    await assertAccountMutationOrigin()
    await enforceRateLimit('recovery', await serverActionSubject(accountFormText(form, 'email')))
    const client = await createServerSupabaseClient()
    return await recoverAccount(accountFormText(form, 'email'), {
      reset: (email) =>
        client.auth.resetPasswordForEmail(email, {
          redirectTo: `${authOrigin(process.env.NEXT_PUBLIC_APP_URL)}/restablecer`
        })
    })
  } catch {
    return { status: 'error', message: 'Recargá la página e intentá nuevamente.' }
  }
}
