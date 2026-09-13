// @vitest-environment node
import { createHmac,randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { createMercadoPagoSplit } from '@waltergaltieri/mercadopago-split'
import { PrismaStorage } from '@waltergaltieri/mercadopago-split/prisma'
import { describe,expect,it,vi } from 'vitest'

describe.skipIf(!process.env.LYSTO_TEST_DATABASE_URL)('vendored package with real Prisma storage',()=>{
 it('encrypts OAuth credentials, consumes state once and verifies/deduplicates signed notifications',async()=>{
  const url=new URL(process.env.LYSTO_TEST_DATABASE_URL!);if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Local database required')
  const client=new Client({connectionString:url.toString()}),storage=new PrismaStorage({databaseUrl:url.toString()})
  await client.connect();const sellerId=`integration-${randomUUID()}`,userId=String(Date.now()),eventId=randomUUID(),onApproved=vi.fn()
  const secret='local-test-webhook-secret',token={accessToken:'TEST-fake-token-not-real',refreshToken:'fake-refresh',userId,expiresIn:3600}
  const split=createMercadoPagoSplit({clientId:'123',clientSecret:'test-client-secret',redirectUri:'https://lysto.test/callback',webhookSecret:secret,encryptionKey:Buffer.alloc(32,2).toString('base64'),storage,oauthHttpClient:{exchangeAuthorizationCode:async()=>token,refreshAccessToken:async()=>token},callbacks:{onPaymentApproved:onApproved},webhookResourceClientFactory:()=>({getPayment:async()=>({id:444,collector_id:userId,status:'approved',status_detail:'accredited',external_reference:'reference-test',transaction_amount:130000,currency_id:'ARS',fee_details:[{type:'application_fee',amount:23400}],transaction_details:{net_received_amount:106600},date_approved:new Date().toISOString()}),getMerchantOrder:async()=>({})})})
  try{
   const {url:authorization}=await split.oauth.createAuthorizationUrl({sellerId});const state=new URL(authorization).searchParams.get('state')!;await split.oauth.completeAuthorization({state,code:'test-code'})
   const stored=await storage.getConnectedAccount(sellerId);expect(stored?.mercadoPagoUserId).toBe(userId);expect(stored?.encryptedAccessToken).not.toContain(token.accessToken);await expect(split.oauth.completeAuthorization({state,code:'test-code'})).rejects.toThrow()
   const ts=String(Math.floor(Date.now()/1000)),requestId=randomUUID(),sig=createHmac('sha256',secret).update(`id:444;request-id:${requestId};ts:${ts};`).digest('hex')
   const notification={headers:{'x-signature':`ts=${ts},v1=${sig}`,'x-request-id':requestId},query:{'data.id':'444'},body:{id:eventId,type:'payment',action:'payment.updated',user_id:userId,data:{id:'444'}}}
   expect((await split.webhooks.handle(notification)).outcome).toBe('processed');expect(onApproved).toHaveBeenCalledTimes(1)
   expect((await split.webhooks.handle(notification)).outcome).toBe('duplicate');expect(onApproved).toHaveBeenCalledTimes(1)
   await expect(split.webhooks.handle({...notification,headers:{...notification.headers,'x-signature':`ts=${ts},v1=${'0'.repeat(64)}`}})).rejects.toThrow();expect(onApproved).toHaveBeenCalledTimes(1)
  }finally{
   await client.query('delete from public.mp_split_webhook_events where event_key=$1',[`notification:${eventId}`]);await client.query('delete from public.mp_split_oauth_states where seller_id=$1',[sellerId]);await client.query('delete from public.mp_split_connected_accounts where seller_id=$1',[sellerId]);await storage.close();await client.end()
  }
 })
})
