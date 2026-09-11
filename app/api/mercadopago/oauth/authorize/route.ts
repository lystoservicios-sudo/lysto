import { privateJson } from '@/lib/http/api-error'
import { getPricingSession } from '@/lib/pricing/server'
import { marketplaceConfig, oauthBinding, paymentError, sameOrigin } from '@/lib/payments/marketplace-config'
import { marketplaceGateway } from '@/lib/payments/marketplace'
import { approvedProfessional } from '@/lib/payments/marketplace-session'
export const runtime = 'nodejs'
export async function POST(request:Request) {
  try {
    const session=await getPricingSession(), pro=await approvedProfessional(session), config=marketplaceConfig()
    sameOrigin(request)
    const {url}=await marketplaceGateway().oauth.createAuthorizationUrl({sellerId:pro})
    const state=new URL(url).searchParams.get('state')
    if(!state)throw new Error('oauth_invalid')
    const response=privateJson({url})
    response.cookies.set('lysto_mp_oauth',oauthBinding(state,session.userId,pro,config.encryptionKey),{httpOnly:true,secure:true,sameSite:'lax',path:'/api/mercadopago/oauth',maxAge:600})
    response.headers.set('Cache-Control','no-store')
    return response
  }catch(error){return paymentError(error)}
}
