import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { marketplaceConfig, oauthBinding, checkOAuthBinding, paymentError } from '@/lib/payments/marketplace-config'
import { marketplaceOAuth } from '@/lib/payments/marketplace'
import { onboardingMarketplaceProfessional } from '@/lib/payments/marketplace-session'
export const runtime='nodejs'
function finish(response: NextResponse) {
  for (const name of ['lysto_mp_oauth','lysto_mp_oauth_return']) response.cookies.set(name,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/api/mercadopago/oauth',maxAge:0})
  response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer')
  return response
}
export async function GET(request:Request){
  let onboardingFailureDestination: string | null = null
  try {
    const session=await onboardingMarketplaceProfessional(),pro=session.professionalId,config=marketplaceConfig()
    const url=new URL(request.url),state=url.searchParams.get('state'),code=url.searchParams.get('code'),error=url.searchParams.get('error')
    if(!state || state.length>1024 || (code?.length??0)>4096 || (error && error!=='access_denied') || (!error&&!code) || (error&&code))throw new Error('oauth_invalid')
    const store=await cookies()
    if(!checkOAuthBinding(store.get('lysto_mp_oauth')?.value,oauthBinding(state,session.userId,pro,config.encryptionKey)))throw new Error('oauth_invalid')
    const returnValue=store.get('lysto_mp_oauth_return')?.value
    const onboarding=returnValue?.startsWith('onboarding.') && checkOAuthBinding(returnValue.slice('onboarding.'.length),oauthBinding(`${state}:onboarding`,session.userId,pro,config.encryptionKey))
    // A provider/network failure may return to onboarding only after both
    // transaction/session and allowlisted destination signatures were verified.
    if(onboarding)onboardingFailureDestination=`${config.origin}/pro/onboarding?conexion=fallida`
    if(!error)await marketplaceOAuth().completeAuthorization({code:code!,state})
    const response=NextResponse.redirect(`${config.origin}/pro/${onboarding?'onboarding':'dashboard'}?conexion=${error?'cancelada':'actualizada'}`)
    return finish(response)
  }catch(error){return finish(onboardingFailureDestination?NextResponse.redirect(onboardingFailureDestination):paymentError(error))}
}
