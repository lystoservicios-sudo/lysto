import { privateJson } from '@/lib/http/api-error'
import { getPricingSession } from '@/lib/pricing/server'
import { marketplaceConfig, paymentError, sameOrigin } from '@/lib/payments/marketplace-config'
import { marketplaceGateway, marketplaceStorage } from '@/lib/payments/marketplace'
import { approvedProfessional } from '@/lib/payments/marketplace-session'
import { paymentDatabase } from '@/lib/payments/marketplace-db'
export const runtime='nodejs'
export async function GET(){
  try {
    const session=await getPricingSession(),pro=await approvedProfessional(session)
    let config;try{config=marketplaceConfig()}catch{return privateJson({configured:false,linked:null})}
    const account=await marketplaceStorage().getConnectedAccount(pro)
    return privateJson({configured:true,mode:config.liveMode?'live':'test',linked:account?.enabled??false,accountId:account?.mercadoPagoUserId??null},{headers:{'Cache-Control':'no-store'}})
  }catch(error){return paymentError(error)}
}
export async function DELETE(request:Request){
  try{
    const session=await getPricingSession(),pro=await approvedProfessional(session)
    sameOrigin(request)
    const active=await paymentDatabase().query("select 1 from public.marketplace_checkouts where professional_id=$1 limit 1",[pro])
    if(active.rowCount)throw new Error('seller_has_payments')
    await marketplaceGateway().oauth.unlinkSeller(pro)
    return privateJson({linked:false})
  }catch(error){return paymentError(error)}
}
