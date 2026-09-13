import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { cleanupExpiredUploads } from '../lib/uploads/cleanup.ts'
import { assertTestEnvironment, readTestIdentity } from './lib/test-environment.mjs'

// Local rehearsal only. The production worker is connected and approved in T24/T36.
const require=createRequire(import.meta.url)
try {
  const [flag,workdir,apply]=process.argv.slice(2)
  if(flag!=='--local-workdir'||!workdir||apply!=='--apply'||process.argv.length!==5) throw Error('Usage: node --experimental-strip-types scripts/cleanup-upload-orphans.mjs --local-workdir <disposable-directory> --apply')
  const env={...process.env,LYSTO_TEST_IDENTITY_FILE:resolve(workdir,'DISPOSABLE.json')}
  const identity=readTestIdentity(env)
  Object.assign(env,{LYSTO_TEST_PROJECT_ID:identity.projectId,LYSTO_TEST_ENVIRONMENT:'disposable',LYSTO_TEST_SUPABASE_URL:`http://127.0.0.1:${identity.apiPort}`,LYSTO_TEST_DATABASE_URL:`postgresql://postgres:postgres@127.0.0.1:${identity.databasePort}/postgres`,LYSTO_TEST_ANON_KEY:'preflight',LYSTO_TEST_SERVICE_ROLE_KEY:'preflight',MERCADOPAGO_MODE:'test'})
  assertTestEnvironment(env,identity)
  const status=JSON.parse(execFileSync(process.execPath,[require.resolve('supabase/dist/supabase.js'),'status','--output','json','--workdir',workdir],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
  if(status.API_URL!==env.LYSTO_TEST_SUPABASE_URL) throw Error('Disposable API mismatch')
  const client=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}})
  const result=await cleanupExpiredUploads(client)
  console.log(JSON.stringify({project:identity.projectId,...result}))
  if(result.failed) process.exitCode=1
} catch { console.error('Orphan cleanup failed; no credentials or provider response are logged.'); process.exitCode=1 }
