import { NextResponse } from 'next/server'
import { handleMarketplaceWebhook } from '@/lib/payments/marketplace'
import { InvalidWebhookSignatureError, ValidationError } from '@waltergaltieri/mercadopago-split'
export const runtime='nodejs'
export async function POST(request:Request){
  try {
    if(Number(request.headers.get('content-length')??0)>65536)return NextResponse.json({error:'Payload too large'},{status:413})
    const text=await request.text()
    if(text.length>65536)return NextResponse.json({error:'Payload too large'},{status:413})
    const params=new URL(request.url).searchParams
    if([...new Set(params.keys())].some(key=>params.getAll(key).length>1))return NextResponse.json({error:'Invalid query'},{status:400})
    const result=await handleMarketplaceWebhook({headers:Object.fromEntries(request.headers),query:Object.fromEntries(params),body:JSON.parse(text)})
    // An active lease is not successful delivery: let the provider retry.
    return NextResponse.json(result,{status:result.outcome==='in_progress'?503:200})
  }catch(error){
    const invalid=error instanceof InvalidWebhookSignatureError || error instanceof ValidationError || error instanceof SyntaxError
    return NextResponse.json({received:false,error:invalid?'Invalid notification':'Notification processing unavailable'},{status:invalid?400:503})
  }
}
