// @vitest-environment node
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { OAuthManager } from '@waltergaltieri/mercadopago-split'
import { renewCheckout } from '@/lib/payments/marketplace'
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
const state=vi.hoisted(()=>({client:null as unknown as Client}))
vi.mock('@/lib/payments/marketplace-db',()=>({paymentDatabase:()=>state.client,paymentTransaction:async(work:(db:Client)=>Promise<unknown>)=>{await state.client.query('savepoint payment_operation');try{const result=await work(state.client);await state.client.query('release savepoint payment_operation');return result}catch(e){await state.client.query('rollback to savepoint payment_operation');throw e}}}))
import { applyCanonicalPayment,claimCheckout,prepareCheckout } from '@/lib/payments/marketplace-ledger'
const customer='85000000-0000-0000-0000-000000000001'
let checkout:Awaited<ReturnType<typeof prepareCheckout>>
const payment=(overrides:Record<string,unknown>={})=>({id:444,collector_id:456789,external_reference:checkout.id,currency_id:'ARS',transaction_amount:130000,transaction_amount_refunded:0,live_mode:false,status:'approved',date_last_updated:'2026-09-10T12:00:00Z',fee_details:[{type:'application_fee',amount:23400},{type:'mercadopago_fee',amount:7800}],transaction_details:{net_received_amount:98800},...overrides})
describe.skipIf(!process.env.LYSTO_TEST_DATABASE_URL)('marketplace ledger against PostgreSQL (rolled back)',()=>{
 beforeEach(async()=>{const url=new URL(process.env.LYSTO_TEST_DATABASE_URL!);if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Tests require local PostgreSQL');state.client=new Client({connectionString:url.toString()});await state.client.connect();await state.client.query('begin');await state.client.query(readFileSync('supabase/tests/fixtures/marketplace.sql.inc','utf8'));const jobs=await state.client.query('select id from public.jobs where customer_id=$1',[customer]);checkout=await prepareCheckout(customer,jobs.rows[0].id,undefined,false)})
 afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();if(state.client){await state.client.query('rollback');await state.client.end()}})
 it('persists a stable amount, idempotency key and payload and leases creation',async()=>{
  const first=await claimCheckout(checkout.id,'https://lysto.test');expect(first.spec?.items[0].unitPrice).toBe('130000.00');expect(first.spec?.marketplaceFee).toBe('23400.00');await expect(claimCheckout(checkout.id,'https://lysto.test')).rejects.toThrow('checkout_busy');
  await state.client.query('update public.marketplace_checkouts set lease_until=now()-interval \'1 second\' where id=$1',[checkout.id]);const retry=await claimCheckout(checkout.id,'https://changed.test');expect(retry.spec).toEqual(first.spec)
 })
 it('handles rejection, approval, duplicate delivery, out-of-order updates and refunds',async()=>{
  await applyCanonicalPayment(checkout.id,payment({status:'rejected',fee_details:[],date_last_updated:'2026-09-10T11:00:00Z'}),'reject')
  expect((await state.client.query('select status from public.marketplace_checkouts where id=$1',[checkout.id])).rows[0].status).toBe('rejected')
  expect(await applyCanonicalPayment(checkout.id,payment(),'approve')).toEqual({status:'approved'})
  expect(await applyCanonicalPayment(checkout.id,payment(),'approve')).toEqual({duplicate:true})
  expect(await applyCanonicalPayment(checkout.id,payment({status:'pending',fee_details:[],date_last_updated:'2026-09-10T11:30:00Z'}),'stale')).toEqual({stale:true})
  expect(await applyCanonicalPayment(checkout.id,payment({transaction_amount_refunded:10000,date_last_updated:'2026-09-10T13:00:00Z'}),'partial')).toEqual({status:'partially_refunded'})
  expect(await applyCanonicalPayment(checkout.id,payment({status:'refunded',fee_details:[],transaction_amount_refunded:130000,date_last_updated:'2026-09-10T14:00:00Z'}),'refund')).toEqual({status:'refunded'})
  const rows=await state.client.query('select amount,marketplace_fee,professional_amount,status from public.payments where provider_payment_id=\'444\'');expect(rows.rows).toEqual([{amount:'130000.00',marketplace_fee:'23400.00',professional_amount:'106600.00',status:'refunded'}])
 })
 it('flags a second approved payment for review instead of fulfilling twice',async()=>{
  await applyCanonicalPayment(checkout.id,payment(),'one');expect(await applyCanonicalPayment(checkout.id,payment({id:445}),'two')).toEqual({status:'review'});expect((await state.client.query('select review_reason from public.marketplace_checkouts where id=$1',[checkout.id])).rows[0].review_reason).toContain('multiple_payments')
 })
 it('ignores a foreign seller and quarantines wrong amounts',async()=>{
  expect(await applyCanonicalPayment(checkout.id,payment({collector_id:99}),'foreign')).toEqual({ignored:true});expect((await state.client.query('select count(*) from public.marketplace_payment_observations where checkout_id=$1',[checkout.id])).rows[0].count).toBe('0');expect(await applyCanonicalPayment(checkout.id,payment({transaction_amount:1}),'wrong')).toEqual({status:'review'});expect((await state.client.query('select count(*) from public.payments where customer_id=$1',[customer])).rows[0].count).toBe('0')
 })
 it('blocks another checkout creation while a payment is pending',async()=>{await applyCanonicalPayment(checkout.id,payment({status:'pending',fee_details:[]}),'pending');await expect(claimCheckout(checkout.id,'https://lysto.test')).rejects.toThrow('checkout_pending')})
 it.each([false,true])('renews the same preference only if canonical reconciliation finds no pending payment (pending=%s)',async pending=>{
  vi.stubEnv('PAYMENTS_PROVIDER','mercadopago_split');vi.stubEnv('MERCADOPAGO_MODE','test');vi.stubEnv('MERCADOPAGO_DATABASE_URL',process.env.LYSTO_TEST_DATABASE_URL);vi.stubEnv('NEXT_PUBLIC_APP_URL','https://lysto.test');vi.stubEnv('MERCADOPAGO_MARKETPLACE_CLIENT_ID','123');vi.stubEnv('MERCADOPAGO_MARKETPLACE_CLIENT_SECRET','secret');vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET','hook');vi.stubEnv('MERCADOPAGO_ENCRYPTION_KEY',Buffer.alloc(32,1).toString('base64'));vi.spyOn(OAuthManager.prototype,'getValidAccessToken').mockResolvedValue('TEST-fake')
  await state.client.query("update public.marketplace_checkouts set preference_id='preference-test',status='ready',expires_at=now()-interval '1 minute' where id=$1",[checkout.id])
  const fetcher=vi.fn(async(url:string,options:{method:string})=>new Response(JSON.stringify(url.includes('/search?')?{paging:{total:pending?1:0},results:pending?[{id:444}]:[]}:url.includes('/v1/payments/')?payment({status:'pending',fee_details:[]}):options.method==='PUT'?{id:'preference-test'}:{id:'preference-test',collector_id:456789,external_reference:checkout.id}),{status:200}))
  vi.stubGlobal('fetch',fetcher)
  if(pending){await expect(renewCheckout(checkout)).rejects.toThrow('checkout_review');expect(fetcher.mock.calls.some(c=>c[1].method==='PUT')).toBe(false)}else{await renewCheckout(checkout);const saved=(await state.client.query('select * from public.marketplace_checkouts where id=$1',[checkout.id])).rows[0];expect(saved.preference_id).toBe('preference-test');expect(saved.amount).toBe('130000.00');expect(saved.expires_at.getTime()).toBeGreaterThan(Date.now());expect(fetcher.mock.calls.filter(c=>c[1].method==='PUT')).toHaveLength(1);expect(fetcher.mock.calls.some(c=>c[1].method==='POST')).toBe(false)}
 })
})
