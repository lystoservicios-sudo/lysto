import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID, createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { Client } from 'pg'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { combineChunks, stringFromBase64URL } from '@supabase/ssr'
import type { Database } from '../../lib/supabase/database.types'
import { assertTestEnvironment, readTestIdentity } from '../../scripts/lib/test-environment.mjs'
import { startTestApp } from './http'

function decodeHtml(value: string) { return value.replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&') }
function attrs(tag: string) { return Object.fromEntries([...tag.matchAll(/([^\s=<>]+)="([^"]*)"/g)].map(match => [match[1],decodeHtml(match[2])])) }

describe('customer lifecycle with real Auth, email delivery and HTTP cookies', () => {
  const runId = randomUUID()
  const email = `t07-customer.${runId}@lysto.test`, expiredEmail = `t07-expired.${runId}@lysto.test`
  const ownedEmails = [email,expiredEmail]
  const password = `Initial-${randomUUID()}-aA1!`, newPassword = `Changed-${randomUUID()}-aA1!`
  const termsVersion = `test-only-terms-${runId}`, privacyVersion = `test-only-privacy-${runId}`
  const jar = new Map<string,string>(), messageIds = new Set<string>()
  let database: Client, admin: SupabaseClient<Database>, userClient: SupabaseClient<Database>
  let app: Awaited<ReturnType<typeof startTestApp>> | undefined, pendingApp: ReturnType<typeof startTestApp> | undefined
  let oldPolicy: Record<string,unknown> | undefined, mailOrigin: string, authId: string | undefined
  let confirmationToken: string, recoveryToken: string
  const manifest = `output/integration/account-lifecycle-${runId}.json`
  function record(status: string) { mkdirSync('output/integration',{recursive:true}); writeFileSync(manifest,JSON.stringify({runId,status,emails:ownedEmails,authId:authId ?? null,messageIds:[...messageIds]},null,2)) }
  const cookieHeader = () => [...jar].map(([name,value]) => `${name}=${value}`).join('; ')
  function takeCookies(response: Response) {
    for (const cookie of response.headers.getSetCookie()) {
      const separator = cookie.indexOf('='), name = cookie.slice(0,separator), value = cookie.slice(separator+1).split(';')[0]
      if (/max-age=0/i.test(cookie) || !value) jar.delete(name); else jar.set(name,value)
    }
  }
  async function request(path: string, options: RequestInit = {}) {
    const response = await fetch(new URL(path,app!.baseURL),{...options,redirect:'manual',headers:{Origin:app!.baseURL,Cookie:cookieHeader(),...options.headers},signal:AbortSignal.timeout(180_000)})
    takeCookies(response)
    return response
  }
  async function submit(path: string, values: Record<string,string>) {
    const page = await request(path)
    if (!page.ok) throw new Error(`Account form unavailable: HTTP ${page.status}`)
    const html = await page.text()
    const forms = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)]
    const form = forms.find(value => value[1].includes(`name="${Object.keys(values)[0]}"`))
    if (!form) throw new Error(`Expected account form was not rendered at ${path}`)
    const data = new FormData()
    for (const match of form[1].matchAll(/<input\b[^>]*>/g)) {
      const input = attrs(match[0]); if (input.type === 'hidden' && input.name) data.append(input.name,input.value ?? '')
    }
    for (const [name,value] of Object.entries(values)) data.set(name,value)
    const formAttributes = attrs(form[0].split('>')[0])
    const action = formAttributes.action || path
    if (new URL(action,app!.baseURL).origin !== app!.baseURL) throw new Error('Unexpected form action origin')
    return request(action,{method:'POST',body:data})
  }
  async function completeCustomerProfile() {
    const blocked = await request('/app')
    expect(blocked.status).toBe(307)
    expect(new URL(blocked.headers.get('location')!, app!.baseURL).pathname).toBe('/completar-perfil')
    const completed = await submit('/completar-perfil?next=%2Fapp', {
      street: 'Calle de Prueba', number: '123', city: 'Buenos Aires', province: 'Buenos Aires', property_type: 'house'
    })
    expect(completed.status).toBe(303)
    expect(new URL(completed.headers.get('location')!, app!.baseURL).pathname).toBe('/app')
    expect((await database.query(
      'select a.street,a.number,a.property_type from public.customer_addresses a join public.customer_profiles cp on cp.id=a.customer_id join public.profiles p on p.id=cp.profile_id where p.auth_user_id=$1 and a.archived_at is null',
      [authId]
    )).rows).toEqual([expect.objectContaining({ street: 'Calle de Prueba', number: '123', property_type: 'house' })])
  }
  async function mailbox(emailAddress: string) {
    const response = await fetch(`${mailOrigin}/api/v1/search?query=${encodeURIComponent(`to:${emailAddress}`)}`,{redirect:'error',signal:AbortSignal.timeout(10_000)})
    if (!response.ok) throw new Error('Disposable email search failed')
    return await response.json() as {messages:Array<{ID:string;Subject:string}>}
  }
  async function mailToken(emailAddress: string, subject: string, except = new Set<string>()) {
    const deadline = Date.now()+30_000
    while (Date.now()<deadline) {
      const matches = (await mailbox(emailAddress)).messages.filter(value => value.Subject.includes(subject) && !except.has(value.ID))
      if (matches.length) {
        const found = matches[0]
        messageIds.add(found.ID); record('running')
        const response = await fetch(`${mailOrigin}/api/v1/message/${encodeURIComponent(found.ID)}`,{redirect:'error',signal:AbortSignal.timeout(10_000)})
        const message = await response.json() as {HTML:string;To:Array<{Address:string}>}
        if (!message.To.some(to => to.Address.toLowerCase() === emailAddress)) throw new Error('Unexpected email recipient')
        const href = [...message.HTML.matchAll(/href="([^"]+)"/g)].map(match=>decodeHtml(match[1])).find(value=>value.includes('token_hash='))
        if (!href || new URL(href).origin !== app!.baseURL) throw new Error('Email did not contain a local application confirmation link')
        return new URL(href).searchParams.get('token_hash')!
      }
      await new Promise(resolve=>setTimeout(resolve,250))
    }
    throw new Error('Auth email was not delivered to the disposable mailbox')
  }
  beforeAll(async () => {
    const target = assertTestEnvironment(process.env,readTestIdentity(process.env))
    const api = new URL(target.apiUrl)
    mailOrigin = `${api.protocol}//${api.hostname}:${target.projectId === 'lysto_production_check' ? 56324 : 54324}`
    const options = {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input: RequestInfo | URL,init?: RequestInit)=>fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(30_000)})}}
    admin = createClient<Database>(target.apiUrl,process.env.LYSTO_TEST_SERVICE_ROLE_KEY!,options)
    userClient = createClient<Database>(target.apiUrl,process.env.LYSTO_TEST_ANON_KEY!,options)
    database = new Client({connectionString:target.databaseUrl,connectionTimeoutMillis:5_000,statement_timeout:15_000})
    await database.connect()
    oldPolicy = (await database.query('select * from private.account_registration_policy where singleton=true')).rows[0]
    record('creating')
    const base = process.env.LYSTO_E2E_BASE_URL ?? 'http://127.0.0.1:3100'
    for (const [kind,version] of [['terms',termsVersion],['privacy',privacyVersion]]) {
      const content = `DOCUMENTO EXCLUSIVO DE ENSAYO: ${kind}. No contiene condiciones legales aprobadas ni habilita servicios reales.`
      await database.query('insert into private.account_legal_documents(kind,version,document_url,content_sha256,test_only) values($1,$2,$3,$4,true)',[kind,version,`${base}/documentos-prueba/${kind}`,createHash('sha256').update(content).digest('hex')])
    }
    await database.query('update private.account_registration_policy set enabled=true,terms_version=$1,privacy_version=$2 where singleton=true',[termsVersion,privacyVersion])
    pendingApp = startTestApp(); app = await pendingApp
  },300_000)
  afterAll(async () => {
    const errors: unknown[] = []
    try { await (app ?? await pendingApp?.catch(()=>undefined))?.stop() } catch(error) { errors.push(error) }
    if (database) {
      try {
        await userClient?.auth.signOut({scope:'global'})
        const owned = await database.query('select id,email from auth.users where email=any($1::text[])',[ownedEmails])
        for (const user of owned.rows) {
          if (!ownedEmails.includes(user.email) || !user.email.includes(runId)) throw new Error('Cleanup ownership mismatch')
          const result = await admin.auth.admin.deleteUser(user.id)
          if (result.error) throw new Error('Synthetic Auth cleanup failed')
        }
        if (oldPolicy) await database.query('update private.account_registration_policy set enabled=$1,terms_version=$2,privacy_version=$3 where singleton=true',[oldPolicy.enabled,oldPolicy.terms_version,oldPolicy.privacy_version])
        await database.query('delete from private.account_legal_documents where version=any($1::text[])',[ [termsVersion,privacyVersion] ])
        for (const address of ownedEmails) for (const message of (await mailbox(address)).messages) messageIds.add(message.ID)
        if (messageIds.size) {
          const response = await fetch(`${mailOrigin}/api/v1/messages`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({IDs:[...messageIds]}),redirect:'error',signal:AbortSignal.timeout(10_000)})
          if (!response.ok) throw new Error('Scoped test email cleanup failed')
        }
      } catch(error) { errors.push(error) }
      finally { await database.end() }
    }
    record(errors.length ? 'cleanup_failed' : 'cleaned')
    if (errors.length) throw new AggregateError(errors,'Account lifecycle cleanup failed')
  },180_000)

  it('registers through the real form with immutable terms and a customer role', async () => {
    const response = await submit('/registro',{email,password,repeatPassword:password,firstName:'Cliente',lastName:'Real',phone:'+541112345678',accepted:'on',termsVersion,privacyVersion})
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Si el correo puede registrarse')
    const users = await database.query('select id,raw_app_meta_data,email_confirmed_at from auth.users where email=$1',[email])
    expect(users.rows).toHaveLength(1); authId=users.rows[0].id; record('running')
    expect(users.rows[0].raw_app_meta_data.app_role).toBe('customer')
    expect(users.rows[0].email_confirmed_at).toBeNull()
    expect((await database.query('select terms_version from private.customer_registration_acceptances where auth_user_id=$1',[authId])).rows[0].terms_version).toBe(termsVersion)
    confirmationToken = await mailToken(email,'Confirmá')
  },180_000)
  it('blocks login before verification and keeps scanner GET harmless', async () => {
    expect((await userClient.auth.signInWithPassword({email,password})).error?.code).toBe('email_not_confirmed')
    expect((await request(`/auth/confirm?token_hash=${confirmationToken}`)).status).toBe(200)
    expect((await database.query('select email_confirmed_at from auth.users where id=$1',[authId])).rows[0].email_confirmed_at).toBeNull()
    expect([...jar.keys()].filter(name=>/-auth-token(?:\.\d+)?$/.test(name))).toEqual([])
    expect((await request('/app')).headers.get('location')).toContain('/login')
  },180_000)
  it('confirms via POST, creates both profiles and authenticates the customer panel', async () => {
    const response = await request('/auth/confirm',{method:'POST',body:new URLSearchParams({token_hash:confirmationToken})})
    expect(response.status).toBe(303); expect(response.headers.get('location')).toBe(app!.baseURL+'/app')
    expect(jar.size).toBeGreaterThan(0)
    await completeCustomerProfile()
    const panel=await request('/app'); expect(panel.status).toBe(200)
    expect(await panel.text()).toContain('Cliente Real')
    expect((await database.query('select cp.id from public.customer_profiles cp join public.profiles p on p.id=cp.profile_id where p.auth_user_id=$1',[authId])).rowCount).toBe(1)
  },180_000)
  it('rejects reusing the confirmation token', async () => { expect((await request('/auth/confirm',{method:'POST',body:new URLSearchParams({token_hash:confirmationToken})})).status).toBe(400) },180_000)
  it('GET cannot log out; cross-origin POST fails; real logout clears browser access', async () => {
    const key=[...jar.keys()].find(name=>/-auth-token(?:\.\d+)?$/.test(name))?.replace(/\.\d+$/,'')
    expect(key).toBeTruthy()
    const encoded=await combineChunks(key!,name=>jar.get(name) ? decodeURIComponent(jar.get(name)!) : undefined)
    const session=JSON.parse(encoded!.startsWith('base64-') ? stringFromBase64URL(encoded!.slice(7)) : encoded!) as {refresh_token:string}
    expect((await request('/auth/logout')).status).toBe(405)
    expect((await request('/auth/logout',{method:'POST',headers:{Origin:'https://evil.test'}})).status).toBe(403)
    expect((await request('/auth/logout',{method:'POST'})).status).toBe(303)
    expect([...jar.keys()].filter(name=>/-auth-token(?:\.\d+)?$/.test(name))).toEqual([])
    expect((await request('/app')).headers.get('location')).toContain('/login')
    expect((await userClient.auth.refreshSession({refresh_token:session.refresh_token})).error).not.toBeNull()
  },180_000)
  it('repairs missing customer state at real login without registering another Auth account', async () => {
    await database.query('delete from public.customer_profiles where profile_id in (select id from public.profiles where auth_user_id=$1)',[authId])
    const response = await submit('/login',{email,password})
    expect(response.status).toBe(303)
    expect(new URL(response.headers.get('location')!, app!.baseURL).pathname).toBe('/completar-perfil')
    expect((await database.query('select count(*)::int n from auth.users where email=$1',[email])).rows[0].n).toBe(1)
    await completeCustomerProfile()
    expect((await request('/app')).status).toBe(200)
  },180_000)
  it('handles concurrent bootstrap requests with stable identity', async () => {
    const signed=await userClient.auth.signInWithPassword({email,password}); expect(signed.error).toBeNull()
    await database.query('delete from public.customer_profiles where profile_id in (select id from public.profiles where auth_user_id=$1)',[authId])
    const results=await Promise.all(Array.from({length:4},()=>userClient.rpc('bootstrap_customer_account')))
    for(const result of results) { expect(result.error).toBeNull(); expect(result.data).toEqual(results[0].data) }
    expect((await database.query('select cp.id from public.customer_profiles cp join public.profiles p on p.id=cp.profile_id where p.auth_user_id=$1',[authId])).rowCount).toBe(1)
  },180_000)
  it('sends recovery with generic response and scanner-safe links', async () => {
    await request('/auth/logout',{method:'POST'})
    const existing=await submit('/recuperar',{email})
    const missing=await submit('/recuperar',{email:`missing.${runId}@lysto.test`})
    expect(await existing.text()).toContain('Si existe una cuenta habilitada')
    expect(await missing.text()).toContain('Si existe una cuenta habilitada')
    recoveryToken=await mailToken(email,'Recuperá')
    expect((await request(`/restablecer?token_hash=${recoveryToken}`)).status).toBe(200)
    expect([...jar.keys()].filter(name=>/-auth-token(?:\.\d+)?$/.test(name))).toEqual([])
    expect((await request('/app')).headers.get('location')).toContain('/login')
  },180_000)
  it('changes password using a recovery token then rejects its reuse and the old password', async () => {
    const values={token_hash:recoveryToken,password:newPassword,repeatPassword:newPassword}
    expect((await request('/auth/reset-password',{method:'POST',body:new URLSearchParams(values)})).status).toBe(303)
    expect((await request('/auth/reset-password',{method:'POST',body:new URLSearchParams(values)})).status).toBe(400)
    expect((await userClient.auth.signInWithPassword({email,password})).error?.code).toBe('invalid_credentials')
    expect((await userClient.auth.signInWithPassword({email,password:newPassword})).error).toBeNull()
  },180_000)
  it('returns a generic duplicate registration result without creating a second account', async () => {
    const response=await submit('/registro',{email,password,repeatPassword:password,firstName:'Duplicado',lastName:'Real',phone:'+541112345678',accepted:'on',termsVersion,privacyVersion})
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Si el correo puede registrarse')
    expect((await database.query('select count(*)::int n from auth.users where email=$1',[email])).rows[0].n).toBe(1)
  },180_000)
  it('rejects a genuinely expired recovery token without changing the password', async () => {
    await database.query("update auth.users set recovery_sent_at=now()-interval '2 hours' where id=$1",[authId])
    const previouslySeen=new Set(messageIds)
    await submit('/recuperar',{email})
    const expiredRecovery=await mailToken(email,'Recuperá',previouslySeen)
    await database.query("update auth.users set recovery_sent_at=now()-interval '2 hours' where id=$1",[authId])
    expect((await request('/auth/reset-password',{method:'POST',body:new URLSearchParams({token_hash:expiredRecovery,password,repeatPassword:password})})).status).toBe(400)
    expect((await userClient.auth.signInWithPassword({email,password:newPassword})).error).toBeNull()
  },180_000)
  it('rejects an actually expired confirmation token from the local mailbox', async () => {
    const response=await submit('/registro',{email:expiredEmail,password,repeatPassword:password,firstName:'Caducado',lastName:'Real',phone:'+541112345678',accepted:'on',termsVersion,privacyVersion})
    expect(response.status).toBe(200)
    const expiredToken=await mailToken(expiredEmail,'Confirmá')
    await database.query("update auth.users set confirmation_sent_at=now()-interval '2 hours' where email=$1",[expiredEmail])
    expect((await request('/auth/confirm',{method:'POST',body:new URLSearchParams({token_hash:expiredToken})})).status).toBe(400)
    expect((await database.query('select email_confirmed_at from auth.users where email=$1',[expiredEmail])).rows[0].email_confirmed_at).toBeNull()
  },180_000)
})
