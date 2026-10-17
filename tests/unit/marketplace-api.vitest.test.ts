// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({session:vi.fn(),prepare:vi.fn(),create:vi.fn(),handle:vi.fn(),handleIpn:vi.fn(),actor:vi.fn(),visible:vi.fn(),reconcile:vi.fn(),renew:vi.fn()}))
vi.mock('@/lib/pricing/server',()=>({getPricingSession:mocks.session}))
vi.mock('@/lib/payments/marketplace-ledger',()=>({prepareCheckout:mocks.prepare}))
vi.mock('@/lib/payments/marketplace',()=>({createCheckoutPreference:mocks.create,handleMarketplaceWebhook:mocks.handle,handleMarketplaceIpn:mocks.handleIpn,reconcileCheckout:mocks.reconcile,renewCheckout:mocks.renew}))
vi.mock('@/lib/payments/marketplace-session',()=>({paymentActor:mocks.actor,visibleCheckout:mocks.visible}))
import { POST } from '@/app/api/mercadopago/create-preference/route'
import { POST as webhook } from '@/app/api/mercadopago/webhook/route'
import { POST as checkouts } from '@/app/api/mercadopago/checkouts/route'
import { sameOrigin } from '@/lib/payments/marketplace-config'

it('bounds webhook payloads by actual UTF-8 bytes even without Content-Length', async () => {
  const response = await webhook(new Request('https://lysto.test/api/mercadopago/webhook', {
    method: 'POST', body: JSON.stringify({ data: 'é'.repeat(33000) })
  }))
  expect(response.status).toBe(413)
  expect(mocks.handle).not.toHaveBeenCalled()
})
it('stops and cancels an oversized chunked webhook body', async () => {
  const cancel = vi.fn()
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(32768)) }, cancel })
  const input = new Request('https://lysto.test/api/mercadopago/webhook', { method: 'POST', body, duplex: 'half' } as RequestInit)
  expect((await webhook(input)).status).toBe(413)
  expect(cancel).toHaveBeenCalledTimes(1)
  expect(mocks.handle).not.toHaveBeenCalled()
})
it('times out a stalled webhook stream without calling the payment processor', async () => {
  vi.useFakeTimers()
  try {
    const cancel = vi.fn()
    const body = new ReadableStream({ start() {}, cancel })
    const input = new Request('https://lysto.test/api/mercadopago/webhook', { method: 'POST', body, duplex: 'half' } as RequestInit)
    const result = webhook(input)
    await vi.advanceTimersByTimeAsync(3001)
    expect((await result).status).toBe(408)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(mocks.handle).not.toHaveBeenCalled()
  } finally { vi.useRealTimers() }
})
const job='92000000-0000-0000-0000-000000000001'
const request=(body:unknown,origin='https://lysto.test')=>new Request('https://lysto.test/api/mercadopago/create-preference',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)})
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('PAYMENTS_PROVIDER','mercadopago_split');vi.stubEnv('MERCADOPAGO_MARKETPLACE_CLIENT_ID','123');vi.stubEnv('MERCADOPAGO_MARKETPLACE_CLIENT_SECRET','test-secret');vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET','test-hook');vi.stubEnv('MERCADOPAGO_ENCRYPTION_KEY',Buffer.alloc(32,1).toString('base64'));vi.stubEnv('MERCADOPAGO_DATABASE_URL','postgres://unused');vi.stubEnv('NEXT_PUBLIC_APP_URL','https://lysto.test');vi.stubEnv('MERCADOPAGO_MODE','test')
 mocks.session.mockResolvedValue({role:'customer',customerId:'trusted-customer'});mocks.prepare.mockResolvedValue({id:'checkout',status:'creating'});mocks.create.mockResolvedValue({id:'checkout',status:'ready',live_mode:false,init_point:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test-account',sandbox_init_point:'https://sandbox.example'})
 mocks.actor.mockResolvedValue({role:'customer',profileId:'trusted-profile',customerId:'trusted-customer'});mocks.visible.mockResolvedValue({id:job,status:'ready'})
})
it('requires login before touching money or provider',async()=>{mocks.session.mockRejectedValue(new Error('unauthorized'));expect((await POST(request({jobId:job}))).status).toBe(401);expect(mocks.prepare).not.toHaveBeenCalled()})
it.each([{amount:1},{marketplaceFee:0},{professionalId:job},{customerId:job}])('rejects browser-supplied financial or recipient fields %o',async fields=>{expect((await POST(request({jobId:job,...fields}))).status).toBe(400);expect(mocks.prepare).not.toHaveBeenCalled()})
it('rejects cross-origin checkout creation',async()=>{expect((await POST(request({jobId:job},'https://attacker.test'))).status).toBe(403);expect(mocks.create).not.toHaveBeenCalled()})
it('creates a checkout behind a proxy using the configured public origin',async()=>{
  const input=new Request('http://localhost:3175/api/mercadopago/create-preference',{method:'POST',headers:{Origin:'https://lysto.test','Content-Type':'application/json'},body:JSON.stringify({jobId:job})})
  const response=await POST(input)
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toContain('no-store')
  expect(mocks.prepare).toHaveBeenCalledWith('trusted-customer',job,undefined,false)
  expect((await response.json()).initPoint).toContain('pref_id=test-account')
})
it('reconciles a provider return behind a proxy using the configured public origin',async()=>{
  const input=new Request('http://localhost:3175/api/mercadopago/checkouts',{method:'POST',headers:{Origin:'https://lysto.test','Content-Type':'application/json'},body:JSON.stringify({checkoutId:job,action:'reconcile_return'})})
  const response=await checkouts(input)
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toContain('no-store')
  expect(mocks.reconcile).toHaveBeenCalledWith(expect.objectContaining({id:job}),true)
})
it.each([
  {name:'create-preference',handler:POST,body:{jobId:job}},
  {name:'checkouts',handler:checkouts,body:{checkoutId:job,action:'reconcile_return'}}
])('rejects a foreign origin matching the internal request host before reading $name',async({name,handler,body})=>{
  const input=new Request(`https://attacker.test/api/mercadopago/${name}`,{method:'POST',headers:{Origin:'https://attacker.test','Content-Type':'application/json'},body:JSON.stringify(body)})
  const json=vi.spyOn(input,'json')
  const response=await handler(input)
  expect(response.status).toBe(403)
  expect(await response.json()).toMatchObject({code:'payment_forbidden'})
  expect(json).not.toHaveBeenCalled()
  expect(mocks.prepare).not.toHaveBeenCalled()
  expect(mocks.visible).not.toHaveBeenCalled()
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.reconcile).not.toHaveBeenCalled()
})
it.each([
  {name:'create-preference',handler:POST,body:{jobId:job}},
  {name:'checkouts',handler:checkouts,body:{checkoutId:job,action:'reconcile_return'}}
])('rejects a missing origin before reading $name',async({name,handler,body})=>{
  const input=new Request(`https://lysto.test/api/mercadopago/${name}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  const json=vi.spyOn(input,'json')
  const response=await handler(input)
  expect(response.status).toBe(403)
  expect(json).not.toHaveBeenCalled()
  expect(mocks.prepare).not.toHaveBeenCalled()
  expect(mocks.visible).not.toHaveBeenCalled()
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.reconcile).not.toHaveBeenCalled()
})
it.each([undefined,'not-a-url','https://lysto.test/path','https://lysto.test?unexpected=1','https://lysto.test#unexpected'])('does not fall back to the request host for missing or invalid configured origin (%s)',configured=>{
  vi.stubEnv('NEXT_PUBLIC_APP_URL',configured)
  expect(()=>sameOrigin(request({jobId:job}))).toThrow('payment_forbidden')
})
it('derives the owner from session and uses init_point for a test-account preference',async()=>{const response=await POST(request({jobId:job}));expect(response.status).toBe(200);expect(mocks.prepare).toHaveBeenCalledWith('trusted-customer',job,undefined,false);expect((await response.json()).initPoint).toBe('https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test-account')})
it('returns the Orders checkout URL for a new split checkout',async()=>{mocks.create.mockResolvedValue({id:'checkout',status:'ready',live_mode:false,checkout_protocol:'orders',order_id:'ORDTST01ABC',checkout_url:'https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=ORDTST01ABC'});const response=await POST(request({jobId:job}));expect(response.status).toBe(200);expect((await response.json()).initPoint).toContain('ORDTST01ABC')})
it('does not return an Orders link if finance moved the checkout into review during creation',async()=>{mocks.create.mockResolvedValue({id:'checkout',status:'review',checkout_protocol:'orders',order_id:'ORDTST01ABC',checkout_url:'https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=ORDTST01ABC'});const response=await POST(request({jobId:job}));expect(response.status).toBe(400);expect((await response.json()).initPoint).toBeUndefined()})
it('never returns a production order in test mode',async()=>{mocks.create.mockResolvedValue({id:'checkout',status:'ready',checkout_protocol:'orders',order_id:'ORD01ABC',checkout_url:'https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=ORD01ABC'});expect((await POST(request({jobId:job}))).status).toBe(400)})
it('does not substitute sandbox_init_point when the normal preference URL is absent',async()=>{mocks.create.mockResolvedValue({id:'checkout',status:'ready',live_mode:false,sandbox_init_point:'https://sandbox.example'});expect((await POST(request({jobId:job}))).status).toBe(400)})
it.each(['test','live'])('rejects a checkout stored in a different payment mode (%s)',async mode=>{vi.stubEnv('MERCADOPAGO_MODE',mode);mocks.create.mockResolvedValue({id:'checkout',status:'ready',live_mode:mode!=='live',init_point:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=wrong-mode',sandbox_init_point:'https://sandbox.example'});const response=await POST(request({jobId:job}));expect(response.status).toBe(400);expect((await response.json()).code).toBe('payment_mode_mismatch')})
it('keeps the normal preference URL for a live-mode checkout',async()=>{vi.stubEnv('MERCADOPAGO_MODE','live');mocks.create.mockResolvedValue({id:'checkout',status:'ready',live_mode:true,init_point:'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=live-account'});const response=await POST(request({jobId:job}));expect(response.status).toBe(200);expect((await response.json()).initPoint).toContain('pref_id=live-account')})
it('rejects a stale explicit customer actor before preparing money',async()=>{mocks.session.mockResolvedValue({role:'customer',customerId:'92000000-0000-4000-8000-000000000002'});const input=request({jobId:job});input.headers.set('X-Lysto-Customer-Id','92000000-0000-4000-8000-000000000003');expect((await POST(input)).status).toBe(403);expect(mocks.prepare).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled()})
it('does not prepare a second preference after approval',async()=>{mocks.prepare.mockResolvedValue({id:'checkout',status:'approved'});expect((await POST(request({jobId:job}))).status).toBe(200);expect(mocks.create).not.toHaveBeenCalled()})
it('does not acknowledge a webhook whose processing lease is active',async()=>{mocks.handle.mockResolvedValue({outcome:'in_progress'});expect((await webhook(new Request('https://lysto.test/api/mercadopago/webhook',{method:'POST',body:'{}'}))).status).toBe(503)})
it('rejects ambiguous duplicate webhook query parameters',async()=>{expect((await webhook(new Request('https://lysto.test/api/mercadopago/webhook?data.id=1&data.id=2',{method:'POST',body:'{}'}))).status).toBe(400);expect(mocks.handle).not.toHaveBeenCalled()})
it('routes unsigned IPN to canonical reconciliation instead of treating it as a signed webhook',async()=>{
  mocks.handleIpn.mockResolvedValue({outcome:'processed'})
  const response=await webhook(new Request(`https://lysto.test/api/mercadopago/webhook?source_news=ipn&checkout=92000000-0000-0000-0000-000000000001&token=${'a'.repeat(64)}&topic=payment&id=123`,{method:'POST',body:''}))
  expect(response.status).toBe(200)
  expect(mocks.handleIpn).toHaveBeenCalledWith(expect.objectContaining({checkoutId:'92000000-0000-0000-0000-000000000001',topic:'payment',resourceId:'123'}))
  expect(mocks.handle).not.toHaveBeenCalled()
})
it('forces a fresh canonical lookup on provider return even after a recent manual check',async()=>{
  const response=await checkouts(new Request('https://lysto.test/api/mercadopago/checkouts',{method:'POST',headers:{Origin:'https://lysto.test','Content-Type':'application/json'},body:JSON.stringify({checkoutId:job,action:'reconcile_return'})}))
  expect(response.status).toBe(200)
  expect(mocks.reconcile).toHaveBeenCalledWith(expect.objectContaining({id:job}),true)
})
it('reports when a manual check was throttled instead of claiming it refreshed',async()=>{
  mocks.reconcile.mockResolvedValue(false)
  const response=await checkouts(new Request('https://lysto.test/api/mercadopago/checkouts',{method:'POST',headers:{Origin:'https://lysto.test','Content-Type':'application/json'},body:JSON.stringify({checkoutId:job,action:'reconcile'})}))
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({updated:false,retryAfterSeconds:30})
})
it('rejects a stale actor before reconciling a payment',async()=>{
  mocks.actor.mockResolvedValue({role:'customer',customerId:'92000000-0000-4000-8000-000000000002'})
  const response=await checkouts(new Request('https://lysto.test/api/mercadopago/checkouts',{method:'POST',headers:{Origin:'https://lysto.test','Content-Type':'application/json','X-Lysto-Customer-Id':'92000000-0000-4000-8000-000000000003'},body:JSON.stringify({checkoutId:job,action:'reconcile_return'})}))
  expect(response.status).toBe(403);expect(mocks.visible).not.toHaveBeenCalled();expect(mocks.reconcile).not.toHaveBeenCalled()
})
