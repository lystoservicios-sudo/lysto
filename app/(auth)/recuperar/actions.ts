'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { accountFormText, assertAccountMutationOrigin } from '@/lib/auth/account-server'
import { authOrigin, recoverAccount, type AccountResult } from '@/lib/auth/account-lifecycle'

export async function recoverAction(_previous: AccountResult, form: FormData): Promise<AccountResult> {
  try {
    await assertAccountMutationOrigin()
    const client = await createServerSupabaseClient()
    return await recoverAccount(accountFormText(form,'email'),{ reset: email => client.auth.resetPasswordForEmail(email,{redirectTo:`${authOrigin(process.env.NEXT_PUBLIC_APP_URL)}/restablecer`}) })
  } catch { return {status:'error',message:'Recargá la página e intentá nuevamente.'} }
}
