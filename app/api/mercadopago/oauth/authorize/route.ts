import { ApiError, privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { marketplaceConfig, oauthBinding, paymentError, sameOrigin } from '@/lib/payments/marketplace-config'
import { marketplaceOAuth } from '@/lib/payments/marketplace'
import { onboardingMarketplaceProfessional } from '@/lib/payments/marketplace-session'
export const runtime = 'nodejs'
export async function POST(request:Request) {
  try {
    const session=await onboardingMarketplaceProfessional(), pro=session.professionalId, config=marketplaceConfig()
    sameOrigin(request)
    // Legacy callers send a bodyless POST; supplied JSON is bounded while read.
    const input: unknown = request.body ? await readPrivateJsonBody(request,256) : {}
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some(key => key !== 'returnTo')
      || ('returnTo' in input && input.returnTo !== 'onboarding')) throw new ApiError('invalid_input')
    const onboarding = 'returnTo' in input && input.returnTo === 'onboarding'
    const {url}=await marketplaceOAuth().createAuthorizationUrl({sellerId:pro})
    const state=new URL(url).searchParams.get('state')
    if(!state)throw new Error('oauth_invalid')
    const response=privateJson({url})
    response.cookies.set('lysto_mp_oauth',oauthBinding(state,session.userId,pro,config.encryptionKey),{httpOnly:true,secure:true,sameSite:'lax',path:'/api/mercadopago/oauth',maxAge:600})
    // The return destination is allowlisted and signed for this exact OAuth
    // transaction. A prior authorization cannot change the new one's return.
    response.cookies.set('lysto_mp_oauth_return', onboarding
      ? `onboarding.${oauthBinding(`${state}:onboarding`,session.userId,pro,config.encryptionKey)}` : '',
    {httpOnly:true,secure:true,sameSite:'lax',path:'/api/mercadopago/oauth',maxAge:onboarding?600:0})
    response.headers.set('Cache-Control','no-store')
    return response
  }catch(error){return paymentError(error)}
}
