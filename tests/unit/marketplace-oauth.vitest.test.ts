// @vitest-environment node
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { marketplaceOAuthHttp } from '@/lib/payments/marketplace'
import { checkOAuthBinding,oauthBinding } from '@/lib/payments/marketplace-config'
const mockFetch=vi.fn()
beforeEach(()=>{vi.stubGlobal('fetch',mockFetch);vi.stubEnv('PAYMENTS_PROVIDER','mercadopago_split');vi.stubEnv('MERCADOPAGO_MARKETPLACE_CLIENT_ID','123');vi.stubEnv('MERCADOPAGO_MARKETPLACE_CLIENT_SECRET','secret');vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET','hook');vi.stubEnv('MERCADOPAGO_ENCRYPTION_KEY',Buffer.alloc(32,1).toString('base64'));vi.stubEnv('MERCADOPAGO_DATABASE_URL','postgres://unused');vi.stubEnv('NEXT_PUBLIC_APP_URL','https://lysto.test');vi.stubEnv('MERCADOPAGO_MODE','test');mockFetch.mockReset()})
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()})
const request={clientId:'123',clientSecret:'secret',grantType:'authorization_code' as const,code:'code',redirectUri:'https://lysto.test/callback'}
const response=(live_mode:boolean)=>new Response(JSON.stringify({access_token:live_mode?'APP_USR-fake':'TEST-fake',refresh_token:'refresh-fake',user_id:123,expires_in:3600,live_mode}),{status:200})
it('binds OAuth state to the same user and professional session',()=>{const binding=oauthBinding('state','user','pro','key');expect(checkOAuthBinding(binding,oauthBinding('state','user','pro','key'))).toBe(true);expect(checkOAuthBinding(binding,oauthBinding('state','other','pro','key'))).toBe(false);expect(checkOAuthBinding(undefined,binding)).toBe(false)})
it('requests test tokens explicitly and retains upstream validation',async()=>{mockFetch.mockResolvedValue(response(false));expect((await marketplaceOAuthHttp().exchangeAuthorizationCode(request)).accessToken).toBe('TEST-fake');expect(new URLSearchParams(mockFetch.mock.calls[0][1].body).get('test_token')).toBe('true')})
it('rejects production tokens in a test environment before storing them',async()=>{mockFetch.mockResolvedValue(response(true));await expect(marketplaceOAuthHttp().exchangeAuthorizationCode(request)).rejects.toThrow()})
it('rejects test tokens in production',async()=>{vi.stubEnv('MERCADOPAGO_MODE','live');mockFetch.mockResolvedValue(response(false));await expect(marketplaceOAuthHttp().exchangeAuthorizationCode(request)).rejects.toThrow()})
it('also checks token mode during refresh',async()=>{mockFetch.mockResolvedValue(response(true));await expect(marketplaceOAuthHttp().refreshAccessToken({clientId:'123',clientSecret:'secret',grantType:'refresh_token',refreshToken:'fake'})).rejects.toThrow()})
