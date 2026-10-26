import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync('supabase/migrations/20261025235512_launch_notification_scheduler.sql', 'utf8')

test('production scheduler is installed paused in one transaction and cannot accidentally run during migration', () => {
  assert.match(sql, /^begin;/i)
  assert.match(sql, /commit;\s*$/i)
  assert.equal((sql.match(/cron\.schedule\(/g) ?? []).length, 1)
  assert.match(sql, /cron\.schedule\(\s*'lysto-production-outbox-v1',\s*'\* \* \* \* \*',\s*'select private\.invoke_production_outbox_worker\(\);'\s*\)/s)
  assert.match(sql, /cron\.alter_job\(v_job_id, active := false\)/)
  assert.doesNotMatch(sql, /active\s*:?=\s*true|vault\.create_secret|vault\.update_secret/i)
})

test('scheduler can call only the fixed production worker with a validated Vault secret and bounded timeout', () => {
  assert.match(sql, /create or replace function private\.invoke_production_outbox_worker\(\)/)
  assert.match(sql, /returns integer\s+language plpgsql\s+security definer\s+set search_path = ''/s)
  assert.match(sql, /from vault\.decrypted_secrets[\s\S]*name = 'lysto_production_outbox_worker_secret'/)
  assert.match(sql, /\^\[A-Za-z0-9_-\]\{32,128\}\$/)
  assert.match(sql, /outbox_scheduler_secret_not_provisioned/)
  assert.match(sql, /'https:\/\/lystohogar\.com\/api\/internal\/outbox'/)
  assert.match(sql, /private_outbox_http\.http_header\('Authorization', 'Bearer ' \|\| v_secret\)/)
  assert.match(sql, /from private_outbox_http\.http\(/)
  assert.match(sql, /'application\/json'/)
  assert.match(sql, /jsonb_build_object\('batchSize', 5, 'inAppOnly', true\)::text/)
  assert.match(sql, /private_outbox_http\.http_set_curlopt\('CURLOPT_TIMEOUT_MS', '55000'\)/)
  assert.match(sql, /private_outbox_http\.http_set_curlopt\('CURLOPT_CONNECTTIMEOUT_MS', '10000'\)/)
  assert.ok((sql.match(/perform private_outbox_http\.http_reset_curlopt\(\)/g) ?? []).length >= 3)
  assert.doesNotMatch(sql, /set http\.curlopt_/)
  assert.match(sql, /v_status is distinct from 200/)
  assert.match(sql, /outbox_scheduler_transport_failed/)
  assert.match(sql, /outbox_scheduler_http_failed/)
  assert.doesNotMatch(sql, /r\.content|r\.headers|net\.http|create extension if not exists pg_net/)
  assert.doesNotMatch(sql, /raise\s+(?:notice|log|warning)|execute\s+v_secret|https:\/\/(?!lystohogar\.com)/i)
})

test('application roles cannot execute the scheduler or resolve its private synchronous HTTP extension', () => {
  assert.match(sql, /revoke all on function private\.invoke_production_outbox_worker\(\)\s+from public, anon, authenticated, service_role/)
  assert.match(sql, /create schema if not exists private_outbox_http/)
  assert.match(sql, /revoke all on schema private_outbox_http\s+from public, anon, authenticated, service_role/)
  assert.match(sql, /create extension if not exists http with schema private_outbox_http/)
  assert.match(sql, /outbox_http_extension_must_be_private/)
  assert.match(sql, /rolname like 'lysto\\_%' escape '\\'/)
  assert.match(sql, /revoke all on function private\.invoke_production_outbox_worker\(\) from %I/)
  assert.match(sql, /revoke all on schema private_outbox_http from %I/)
  assert.doesNotMatch(sql, /grant[^;]+to (?:public|anon|authenticated|service_role|lysto_)/i)
})

test('infrastructure migration preserves existing notification rows and does not enable an email transport', () => {
  assert.match(sql, /create extension if not exists pg_cron/)
  assert.match(sql, /create extension if not exists http/)
  assert.doesNotMatch(sql, /(?:insert into|update|delete from|truncate|drop table)\s+(?:private|public)\./i)
  assert.doesNotMatch(sql, /RESEND_API_KEY|NOTIFICATIONS_EMAIL_ENABLED\s*=\s*true|OUTBOX_WORKER_ENABLED\s*=\s*true/)
})
