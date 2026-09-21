'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getRegistrationPolicy } from '@/lib/auth/account-policy'
import { accountFormText, assertAccountMutationOrigin } from '@/lib/auth/account-server'
import { authOrigin, registerCustomer, type AccountResult } from '@/lib/auth/account-lifecycle'
import { enforceRateLimit, serverActionSubject } from '@/lib/security/rate-limit'

export async function registerAction(
  _previous: AccountResult,
  form: FormData
): Promise<AccountResult> {
  try {
    await assertAccountMutationOrigin()
    await enforceRateLimit(
      'registration',
      await serverActionSubject(accountFormText(form, 'email'))
    )
    const client = await createServerSupabaseClient()
    return await registerCustomer(
      {
        email: accountFormText(form, 'email'),
        password: accountFormText(form, 'password'),
        repeatPassword: accountFormText(form, 'repeatPassword'),
        firstName: accountFormText(form, 'firstName'),
        lastName: accountFormText(form, 'lastName'),
        phone: accountFormText(form, 'phone'),
        accepted: form.get('accepted') === 'on',
        termsVersion: accountFormText(form, 'termsVersion'),
        privacyVersion: accountFormText(form, 'privacyVersion')
      },
      await getRegistrationPolicy(),
      {
        async signUp(input) {
          return client.auth.signUp({
            email: input.email,
            password: input.password,
            options: {
              emailRedirectTo: `${authOrigin(process.env.NEXT_PUBLIC_APP_URL)}/auth/confirm`,
              data: {
                first_name: input.firstName,
                last_name: input.lastName,
                phone: input.phone,
                accepted: true,
                terms_version: input.termsVersion,
                privacy_version: input.privacyVersion
              }
            }
          })
        }
      }
    )
  } catch {
    return {
      status: 'error',
      message: 'No pudimos procesar la solicitud. Recargá la página e intentá nuevamente.'
    }
  }
}
