// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({session:vi.fn(),prepare:vi.fn(),create:vi.fn(),handle:vi.fn()}))
vi.mock('@/lib/pricing/server',()=>({getPricingSession:mocks.session}))
vi.mock('@/lib/payments/marketplace-ledger',()=>({prepareCheckout:mocks.prepare}))
vi.mock('@/lib/payments/marketplace',()=>({createCheckoutPreference:mocks.create,handleMarketplaceWebhook:mocks.handle}))
import { POST } from '@/app/api/mercadopago/create-preference/route'
import { POST as webhook } from '@/app/api/mercadopago/webhook/route'
const job='92000000-0000-0000-0000-000000000001'
const request=(body:unknown,origin='https://lysto.test')=>new Request('https://lysto.test/api/mercadopago/create-preference',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)})
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('PAYMENTS_PROVIDER','mercadopago_split');vi.stubEnv('MERCADOPAGO_MARKETPLACE_CLIENT_ID','123');vi.stubEnv('MERCADOPAGO_MARKETPLACE_CLIENT_SECRET','test-secret');vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET','test-hook');vi.stubEnv('MERCADOPAGO_ENCRYPTION_KEY',Buffer.alloc(32,1).toString('base64'));vi.stubEnv('MERCADOPAGO_DATABASE_URL','postgres://unused');vi.stubEnv('NEXT_PUBLIC_APP_URL','https://lysto.test');vi.stubEnv('MERCADOPAGO_MODE','test')
 mocks.session.mockResolvedValue({role:'customer',customerId:'trusted-customer'});mocks.prepare.mockResolvedValue({id:'checkout',status:'creating'});mocks.create.mockResolvedValue({id:'checkout',status:'ready',init_point:'https://live.example',sandbox_init_point:'https://sandbox.example'})
})
it('requires login before touching money or provider',async()=>{mocks.session.mockRejectedValue(new Error('unauthorized'));expect((await POST(request({jobId:job}))).status).toBe(401);expect(mocks.prepare).not.toHaveBeenCalled()})
it.each([{amount:1},{marketplaceFee:0},{professionalId:job},{customerId:job}])('rejects browser-supplied financial or recipient fields %o',async fields=>{expect((await POST(request({jobId:job,...fields}))).status).toBe(400);expect(mocks.prepare).not.toHaveBeenCalled()})
it('rejects cross-origin checkout creation',async()=>{expect((await POST(request({jobId:job},'https://attacker.test'))).status).toBe(403);expect(mocks.create).not.toHaveBeenCalled()})
it('derives the owner from session and returns sandbox URL only in test',async()=>{const response=await POST(request({jobId:job}));expect(response.status).toBe(200);expect(mocks.prepare).toHaveBeenCalledWith('trusted-customer',job,undefined,false);expect((await response.json()).initPoint).toBe('https://sandbox.example')})
it('returns the Orders checkout URL for a new split checkout',async()=>{mocks.create.mockResolvedValue({id:'checkout',status:'ready',checkout_protocol:'orders',order_id:'ORDTST01ABC',checkout_url:'https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=ORDTST01ABC'});const response=await POST(request({jobId:job}));expect(response.status).toBe(200);expect((await response.json()).initPoint).toContain('ORDTST01ABC')})
it('does not return an Orders link if finance moved the checkout into review during creation',async()=>{mocks.create.mockResolvedValue({id:'checkout',status:'review',checkout_protocol:'orders',order_id:'ORDTST01ABC',checkout_url:'https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=ORDTST01ABC'});const response=await POST(request({jobId:job}));expect(response.status).toBe(400);expect((await response.json()).initPoint).toBeUndefined()})
it('never returns a production order in test mode',async()=>{mocks.create.mockResolvedValue({id:'checkout',status:'ready',checkout_protocol:'orders',order_id:'ORD01ABC',checkout_url:'https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=ORD01ABC'});expect((await POST(request({jobId:job}))).status).toBe(400)})
it('never falls back to a live checkout URL during a test',async()=>{mocks.create.mockResolvedValue({id:'checkout',status:'ready',init_point:'https://live.example'});expect((await POST(request({jobId:job}))).status).toBe(400)})
it('does not prepare a second preference after approval',async()=>{mocks.prepare.mockResolvedValue({id:'checkout',status:'approved'});expect((await POST(request({jobId:job}))).status).toBe(200);expect(mocks.create).not.toHaveBeenCalled()})
it('does not acknowledge a webhook whose processing lease is active',async()=>{mocks.handle.mockResolvedValue({outcome:'in_progress'});expect((await webhook(new Request('https://lysto.test/api/mercadopago/webhook',{method:'POST',body:'{}'}))).status).toBe(503)})
it('rejects ambiguous duplicate webhook query parameters',async()=>{expect((await webhook(new Request('https://lysto.test/api/mercadopago/webhook?data.id=1&data.id=2',{method:'POST',body:'{}'}))).status).toBe(400);expect(mocks.handle).not.toHaveBeenCalled()})
