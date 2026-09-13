import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getPricingSession } from '@/lib/pricing/server'
import { marketplaceConfig, oauthBinding, checkOAuthBinding, paymentError } from '@/lib/payments/marketplace-config'
import { marketplaceGateway } from '@/lib/payments/marketplace'
import { approvedProfessional } from '@/lib/payments/marketplace-session'
export const runtime='nodejs'
export async function GET(request:Request){
  try {
    const session=await getPricingSession(),pro=await approvedProfessional(session),config=marketplaceConfig()
    const url=new URL(request.url),state=url.searchParams.get('state'),code=url.searchParams.get('code')
    if(!state || !code || state.length>1024 || code.length>4096)throw new Error('oauth_invalid')
    const store=await cookies()
    if(!checkOAuthBinding(store.get('lysto_mp_oauth')?.value,oauthBinding(state,session.userId,pro,config.encryptionKey)))throw new Error('oauth_invalid')
    await marketplaceGateway().oauth.completeAuthorization({code,state})
    const response=NextResponse.redirect(`${config.origin}/pro/mercadopago?conexion=actualizada`)
    response.cookies.set('lysto_mp_oauth','',{httpOnly:true,secure:true,sameSite:'lax',path:'/api/mercadopago/oauth',maxAge:0})
    response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer')
    return response
  }catch(error){return paymentError(error)}
}
