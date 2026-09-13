import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { TokenCipher } from '@waltergaltieri/mercadopago-split'
import { z } from 'zod'

const manifestSchema=z.object({schemaVersion:z.literal(1),source:z.object({backupCreatedAt:z.string().datetime(),latestRecoverableAt:z.string().datetime()}),target:z.object({projectId:z.string().min(3),apiUrl:z.string().url(),production:z.literal(false)}),restore:z.object({startedAt:z.string().datetime(),completedAt:z.string().datetime()}),objectives:z.object({rpoMinutes:z.number().positive(),rtoMinutes:z.number().positive()}),expected:z.object({migrations:z.array(z.string().regex(/^(?:\d{12}|\d{14})$/)).min(1),minimumCounts:z.record(z.enum(['profiles','jobs','marketplace_checkouts','outbox_events']),z.number().int().nonnegative()),storageObjects:z.array(z.object({bucket:z.string().min(1),path:z.string().min(1),sizeBytes:z.number().int().positive(),sha256:z.string().regex(/^[a-f0-9]{64}$/).optional()})).default([]),syntheticAuth:z.boolean().default(false),encryptionCanary:z.object({ciphertext:z.string().min(1),sellerId:z.string().min(1),plaintextSha256:z.string().regex(/^[a-f0-9]{64}$/)}).optional()})}).strict()

export function parseRestoreManifest(value){return manifestSchema.parse(value)}
export function assertRestoreTarget(env,manifest){
  if(!['test','staging'].includes(env.APP_ENV??'')||env.LYSTO_RESTORE_AUTHORIZED!=='yes')throw new Error('restore_target_not_authorized')
  if(env.PAYMENTS_PROVIDER!=='mock'||env.MERCADOPAGO_MODE==='live'||env.NOTIFICATIONS_EMAIL_ENABLED!=='false'||env.OUTBOX_WORKER_ENABLED!=='false'||env.REFUND_WORKER_ENABLED!=='false'||env.LYSTO_ACCEPT_NEW_REQUESTS!=='false'||env.LYSTO_ALLOW_NEW_CHECKOUTS!=='false')throw new Error('restore_target_not_isolated')
  const allowed=new Set((env.LYSTO_RESTORE_ALLOWED_PROJECT_IDS??'').split(',').map(value=>value.trim()).filter(Boolean))
  if(!allowed.has(manifest.target.projectId)||env.LYSTO_RESTORE_API_URL!==manifest.target.apiUrl||manifest.target.production!==false)throw new Error('restore_target_mismatch')
  const url=new URL(manifest.target.apiUrl);if(env.APP_ENV==='test'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('test_restore_must_be_local')
  if(env.APP_ENV==='staging'&&url.protocol!=='https:')throw new Error('staging_restore_requires_https')
}
const sha=value=>createHash('sha256').update(value).digest('hex')
export async function verifyRestore(manifest,env=process.env){
  manifest=parseRestoreManifest(manifest);assertRestoreTarget(env,manifest)
  const db=new Client({connectionString:z.string().url().parse(env.LYSTO_RESTORE_DATABASE_URL),connectionTimeoutMillis:5000,query_timeout:10000,statement_timeout:10000,lock_timeout:3000})
  const result={schemaVersion:1,targetProjectId:manifest.target.projectId,startedAt:new Date().toISOString(),checks:[],rpoMinutes:(Date.parse(manifest.restore.startedAt)-Date.parse(manifest.source.latestRecoverableAt))/60000,rtoMinutes:(Date.parse(manifest.restore.completedAt)-Date.parse(manifest.restore.startedAt))/60000}
  if(result.rpoMinutes<0||result.rpoMinutes>manifest.objectives.rpoMinutes)throw new Error('rpo_objective_failed')
  if(result.rtoMinutes<0||result.rtoMinutes>manifest.objectives.rtoMinutes)throw new Error('rto_objective_failed')
  await db.connect()
  try{
    await db.query('begin transaction read only')
    const migrations=(await db.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(row=>String(row.version))
    if(JSON.stringify(migrations)!==JSON.stringify(manifest.expected.migrations))throw new Error('migration_history_mismatch');result.checks.push('migration-history')
    const counts=await db.query(`select (select count(*)::int from public.profiles) profiles,(select count(*)::int from public.jobs) jobs,(select count(*)::int from public.marketplace_checkouts) marketplace_checkouts,(select count(*)::int from private.outbox_events) outbox_events`)
    for(const [name,minimum] of Object.entries(manifest.expected.minimumCounts))if(counts.rows[0][name]<minimum)throw new Error(`minimum_count_failed:${name}`);result.checks.push('critical-counts')
    const integrity=await db.query(`select (select count(*)::int from public.jobs j left join public.service_requests r on r.id=j.request_id where r.id is null) orphan_jobs,(select count(*)::int from public.receipts r left join public.job_final_reports f on f.id=r.final_report_id where f.id is null) orphan_receipts`)
    if(integrity.rows[0].orphan_jobs||integrity.rows[0].orphan_receipts)throw new Error('referential_integrity_failed');result.checks.push('referential-integrity')
    for(const object of manifest.expected.storageObjects){const found=await db.query(`select (metadata->>'size')::bigint size,(select output_sha256 from private.upload_intents where output_bucket=$1 and output_path=$2 and status='verified') sha256 from storage.objects where bucket_id=$1 and name=$2`,[object.bucket,object.path]);if(found.rowCount!==1||Number(found.rows[0].size)!==object.sizeBytes||(object.sha256&&found.rows[0].sha256!==object.sha256))throw new Error('storage_object_mismatch')};result.checks.push('storage-manifest')
    await db.query('rollback')
  }catch(error){await db.query('rollback').catch(()=>{});throw error}finally{await db.end()}
  if(manifest.expected.syntheticAuth){const client=createClient(manifest.target.apiUrl,z.string().min(1).parse(env.LYSTO_RESTORE_ANON_KEY),{auth:{persistSession:false,autoRefreshToken:false}});const auth=await client.auth.signInWithPassword({email:z.string().email().parse(env.LYSTO_RESTORE_TEST_EMAIL),password:z.string().min(8).parse(env.LYSTO_RESTORE_TEST_PASSWORD)});if(auth.error||!auth.data.user)throw new Error('synthetic_login_failed');await client.auth.signOut();result.checks.push('synthetic-login')}
  if(manifest.expected.encryptionCanary){const key=z.string().min(1).parse(env.MERCADOPAGO_ENCRYPTION_KEY),canary=manifest.expected.encryptionCanary,plain=new TokenCipher(key).decrypt(canary.ciphertext,{sellerId:canary.sellerId,tokenType:'access'});if(sha(plain)!==canary.plaintextSha256)throw new Error('encryption_canary_failed');result.checks.push('encryption-canary')}
  return {...result,status:'passed',completedAt:new Date().toISOString()}
}
export async function readRestoreManifest(path){return parseRestoreManifest(JSON.parse(await readFile(path,'utf8')))}
