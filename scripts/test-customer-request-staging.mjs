// Narrow SQL acceptance runner: no HTTP/Auth login/provider/notification calls.
// Importing this module is inert. Default invocation only prepares review files.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const wrapper = 'E:\\Proyectos\\GitHub\\Lysto\\scripts\\supabase-lysto.cmd'
const originalRepository = 'E:\\Proyectos\\GitHub\\Lysto'
const qaRef = 'obksyzasmfwcbbksesqt'
const productionRef = 'dqonlqcurvjnjgsczevu'
const prerequisites = [
  '20261004011254_owner_maintenance_test_price.sql',
  '20261013141601_customer_hogar.sql',
  '20261014023946_customer_request_contract_checkout.sql',
  '20261014213321_customer_request_gross_split.sql',
  '20261014235503_customer_rpc_business_conflicts.sql'
]
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
const fixtureNames = ['pro_user', 'pro_profile', 'professional', 'avatar', 'admin_user', 'admin_profile', 'quote_policy', 'request_policy',
  ...['a', 'b', 'c'].flatMap(actor => ['user', 'profile', 'customer', 'session', 'address', 'equipment', 'command', 'alias'].map(part => `${actor}_${part}`))]
const literal = value => value === null ? 'null' : `'${String(value).replaceAll("'", "''")}'`
const id = (manifest, key) => { const value = manifest.ids[key]; assert.match(value, uuidPattern); return literal(value) }
const group = (manifest, names) => names.map(name => id(manifest, name)).join(',')
const customers = m => group(m, ['a_customer', 'b_customer', 'c_customer'])
const profiles = m => group(m, ['a_profile', 'b_profile', 'c_profile', 'pro_profile', 'admin_profile'])
const users = m => group(m, ['a_user', 'b_user', 'c_user', 'pro_user', 'admin_user'])
const runPrefix = m => `pc_${m.runId.replaceAll('-','')}_`
const header = (m, statement = '40s') => { assertManifest(m); return `-- STAGING ONLY: ${m.projectRef}; run ${m.runId}\nbegin;\nset local application_name='${runPrefix(m)}setup';\nset local lock_timeout='25s';\nset local statement_timeout='${statement}';\nset local idle_in_transaction_session_timeout='45s';\nset local search_path=public,extensions,pg_temp;\n` }
const emptyGuard = `do $empty$ begin
  if exists(select 1 from auth.users) or exists(select 1 from public.customer_profiles)
    or exists(select 1 from public.professional_profiles) or exists(select 1 from public.jobs)
    or exists(select 1 from public.service_requests) or exists(select 1 from public.marketplace_checkouts)
    or exists(select 1 from public.payments) then
    raise exception 'Auth or application data appeared: refusing staging setup';
  end if;
end; $empty$;\n`

export function assertStagingTarget(projectRef) {
  if (projectRef !== qaRef || projectRef === productionRef) throw new Error('Only the explicitly verified empty Lysto QA project is permitted; production/default link forbidden')
  return projectRef
}

export function createManifest(projectRef) {
  assertStagingTarget(projectRef)
  return {
    projectRef, production: false, environment: 'staging', runId: randomUUID(), phase: 'planned',
    ids: Object.fromEntries(fixtureNames.map(name => [name, randomUUID()])),
    sourceHashes: Object.fromEntries(prerequisites.map(name => [name, createHash('sha256').update(readFileSync(join(repository, 'supabase/migrations', name))).digest('hex')]))
  }
}

export function assertManifest(m) {
  assertStagingTarget(m?.projectRef); assert.match(m.runId,uuidPattern)
  assert.equal(m.production,false); assert.equal(m.environment,'staging')
  assert.deepEqual(Object.keys(m.ids).sort(),[...fixtureNames].sort(),'Fixture identity keys must exactly match the reviewed manifest schema')
  const values=Object.values(m.ids); for(const value of values) assert.match(value,uuidPattern)
  assert.equal(new Set(values).size,values.length,'Every fixture identity must be distinct')
  assert.deepEqual(Object.keys(m.sourceHashes).sort(),[...prerequisites].sort())
  for(const value of Object.values(m.sourceHashes)) assert.match(value,/^[a-f0-9]{64}$/)
  assert.ok(['planned','setup-started','fixtures-committed','tests-passed','cleanup-pending','cleanup-started','cleaned','passed-and-cleaned','failed-and-cleaned'].includes(m.phase),'Unknown manifest phase')
  return m
}

export function buildPreflightSql() {
  return `select jsonb_build_object('currentUser',current_user,'migrationCount',(select count(*) from supabase_migrations.schema_migrations),
    'migrationLatest',(select max(version) from supabase_migrations.schema_migrations),
    'hogar',to_regclass('public.customer_homes'),'pedir',to_regclass('private.customer_request_previews'),
    'ownerHelper',to_regprocedure('private.is_owner_maintenance_test_quote(uuid,jsonb,jsonb)'),
    'quoteCurrent',(select to_jsonb(c) from private.quote_policy_current c where singleton),
    'quotePolicyCount',(select count(*) from private.quote_policy_versions),
    'authCount',(select count(*) from auth.users),'profileCount',(select count(*) from public.profiles),
    'customerCount',(select count(*) from public.customer_profiles),'professionalCount',(select count(*) from public.professional_profiles),
    'jobCount',(select count(*) from public.jobs),'requestCount',(select count(*) from public.service_requests),
    'checkoutCount',(select count(*) from public.marketplace_checkouts),'paymentCount',(select count(*) from public.payments),
    'outboxCount',(select count(*) from private.outbox_events),'auditCount',(select count(*) from public.admin_audit_logs),
    'storageCount',(select count(*) from storage.objects),
    'categoryCount',(select count(*) from public.service_categories where slug='aire_acondicionado' and active),
    'issueCount',(select count(*) from public.service_issue_types i join public.service_categories c on c.id=i.category_id where c.slug='aire_acondicionado' and c.active and i.slug='no_enfria' and i.active),
    'avatarBucket',exists(select 1 from storage.buckets where id='public-avatars'),
    'marketplaceRole',exists(select 1 from pg_roles where rolname='lysto_marketplace')
  ) as preflight;`
}

export function buildPrerequisiteSql(m) {
  let sql = header(m, '60s') + `set local lock_timeout='2s';\n` + emptyGuard + `do $migration_baseline$ begin
  if (select count(*) from supabase_migrations.schema_migrations)<>74
    or (select max(version) from supabase_migrations.schema_migrations)<>'20260923154658'
    or exists(select 1 from supabase_migrations.schema_migrations where version in('20261004011254','20261013141601','20261014023946','20261014213321','20261014235503'))
    or to_regclass('public.customer_homes') is not null or to_regclass('private.customer_request_previews') is not null then
    raise exception 'Staging migration baseline changed: refusing setup';
  end if;
end; $migration_baseline$;\n`
  for (const name of prerequisites) {
    const source = readFileSync(join(repository, 'supabase/migrations', name), 'utf8')
    assert.equal(createHash('sha256').update(source).digest('hex'), m.sourceHashes[name], 'Reviewed source changed')
    sql += `\n-- EXACT SOURCE ${name}\n${source}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values(${literal(name.slice(0,14))},${literal(name.slice(15,-4))},array[${literal(source)}]::text[]);\n`
  }
  return sql + `commit;\n`
}

export function buildFixtureSetupSql(m) {
  const avatarSha=m.apiAvatar?.sha256 ?? 'a'.repeat(64)
  assert.match(avatarSha,/^[a-f0-9]{64}$/)
  const fixtureRows = Object.entries(m.ids).map(([name, value]) => `(${literal(name)},${literal(value)}::uuid)`).join(',\n')
  const actorInserts = ['a', 'b', 'c'].map(actor => `
insert into public.customer_profiles(id,profile_id) values(${id(m,`${actor}_customer`)},${id(m,`${actor}_profile`)});
insert into auth.sessions(id,user_id,aal,created_at,updated_at) values(${id(m,`${actor}_session`)},${id(m,`${actor}_user`)},'aal1',now(),now());
insert into public.customer_addresses(id,customer_id,label,street,number,city,province,property_type)
  values(${id(m,`${actor}_address`)},${id(m,`${actor}_customer`)},'Synthetic QA','Calle sintética','1','Pedir QA ${m.runId}','CABA','house');
insert into public.customer_equipment(id,customer_id,address_id,category_id,nickname,equipment_type,frigorias)
  select ${id(m,`${actor}_equipment`)},${id(m,`${actor}_customer`)},${id(m,`${actor}_address`)},id,'Aire sintético QA','on_off','4500'
  from public.service_categories where slug='aire_acondicionado' and active;
`).join('\n')
  return header(m) + emptyGuard + `
do $policy_baseline$ begin
  if exists(select 1 from private.quote_policy_versions) or exists(select 1 from private.customer_request_policy_versions)
    or (select policy_id is not null from private.quote_policy_current where singleton)
    or (select enabled or policy_id is not null or version<>0 from private.customer_request_policy_current where singleton) then
    raise exception 'Staging commercial baseline changed: refusing fixture setup';
  end if;
end; $policy_baseline$;
create temporary table fixture_ids(name text primary key,id uuid not null);
insert into fixture_ids values ${fixtureRows};
create function pg_temp.fixture_id(name text) returns uuid language sql as $$ select id from pg_temp.fixture_ids where fixture_ids.name=$1; $$;
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data)
select id,id::text||'@pedir-concurrency.invalid',now(),jsonb_build_object('app_role',case name when 'pro_user' then 'professional' when 'admin_user' then 'admin' else 'customer' end)
from fixture_ids where name in('a_user','b_user','c_user','pro_user','admin_user');
insert into public.profiles(id,auth_user_id,role,email,first_name,last_name,phone)
select pg_temp.fixture_id(replace(name,'_user','_profile')),id,
  (case name when 'pro_user' then 'professional' when 'admin_user' then 'admin' else 'customer' end)::public.user_role,
  id::text||'@pedir-concurrency.invalid','Synthetic','QA','0000000000'
from fixture_ids where name in('a_user','b_user','c_user','pro_user','admin_user');
${actorInserts}
insert into public.professional_profiles(id,profile_id,status,base_location)
  values(${id(m,'professional')},${id(m,'pro_profile')},'approved','Origen sintético QA: no es una dirección real');
insert into public.professional_service_categories(professional_id,category_id,approved)
  select ${id(m,'professional')},id,true from public.service_categories where slug='aire_acondicionado' and active;
insert into public.professional_tools(professional_id,tool_code,tool_label,has_tool) values(${id(m,'professional')},'qa_synthetic','Synthetic QA',true);
insert into public.professional_service_zones(professional_id,zone_slug,zone_name)
  values(${id(m,'professional')},'qa_${m.runId.replaceAll('-','')}','Pedir QA ${m.runId}');
insert into public.professional_availability(professional_id,weekday,start_time,end_time)
  select ${id(m,'professional')},day,'08:00','23:00' from generate_series(0,6) day;
insert into public.mp_split_connected_accounts(seller_id,mercado_pago_user_id,encrypted_access_token,access_token_expires_at,created_at,updated_at)
  values(${id(m,'professional')}::text,'qa-'||${id(m,'professional')}::text,'synthetic-placeholder-never-send-to-provider',now()+interval '1 hour',now(),now());
insert into private.professional_avatars(professional_id,object_path,output_sha256)
  values(${id(m,'professional')},${id(m,'pro_user')}::text||'/'||${id(m,'avatar')}::text||'.webp',${literal(avatarSha)});
update public.profiles set avatar_url='https://fixture.invalid/storage/v1/object/public/public-avatars/'||${id(m,'pro_user')}::text||'/'||${id(m,'avatar')}::text||'.webp' where id=${id(m,'pro_profile')};
insert into private.quote_policy_versions(id,revision,policy,created_by,reason)
  values(${id(m,'quote_policy')},1,jsonb_build_object('version','qa-${m.runId}','source','Synthetic isolated staging concurrency only',
    'sourceDate',current_date::text,'approvedUntil',(current_date+7)::text,'safetyRate',.3,'platformFeeRate',.18,'paymentCostRate',0,
    'priorityMultiplier',1.25,'laborIndex',1,'perKm',0,'perMinute',0,'minimumTravel',0,'difficultAccess',0,'height',0,'stairs',0,
    'noParking',0,'commercial',0,'office',0,'inverterRate',0,'quoteValidityMinutes',30,'laborOverrides',jsonb_build_object('leak',100000)),
    ${id(m,'admin_profile')},'Synthetic QA tariff; not a human approval or production policy');
update private.quote_policy_current set policy_id=${id(m,'quote_policy')} where singleton;
insert into private.customer_request_policy_versions(id,quote_policy_id,scopes,approved_until,approved_by,reason)
  values(${id(m,'request_policy')},${id(m,'quote_policy')},jsonb_build_object('no_enfria',jsonb_build_object('scenario','leak',
    'label','Mano de obra inicial sintética QA, repuestos por separado','durationMinutes',120,'travelBufferMinutes',30,
    'initialLaborOnly',true,'excludesUnpricedParts',true,'allowsPredictedRepair',true,'allowCustomerEquipmentDeclaration',false)),
    now()+interval '1 hour',${id(m,'admin_profile')},'Synthetic QA scope; not a human approval or production rollout');
update private.customer_request_policy_current set enabled=true,policy_id=${id(m,'request_policy')},version=1 where singleton;
create function pg_temp.make_preview(actor text,days integer) returns jsonb language plpgsql as $preview$
declare v_input jsonb; c jsonb; r jsonb; payload jsonb;
begin
  v_input:=jsonb_build_object('equipmentId',pg_temp.fixture_id(actor||'_equipment'),'expectedEquipmentVersion',1,
    'addressId',pg_temp.fixture_id(actor||'_address'),'issue','no_enfria','timeSince','days','description','Synthetic staging concurrency only',
    'answers','{}'::jsonb,'preferredDate',(current_date+days)::text,'timeWindow','10:00 – 12:00','urgency','flexible','uploadIntentIds','[]'::jsonb);
  c:=private.read_customer_request_context(pg_temp.fixture_id(actor||'_user'),pg_temp.fixture_id(actor||'_session'),pg_temp.fixture_id(actor||'_customer'),v_input);
  if c->>'reason' is not null or jsonb_array_length(c->'candidates')<>1 then raise exception 'Synthetic candidate not uniquely eligible: %',c->>'reason'; end if;
  r:=jsonb_build_object('source','google','origin','PRIVATE SYNTHETIC ORIGIN','destination','Synthetic visit','province','CABA',
    'outboundKm',1,'returnKm',1,'outboundMinutes',1,'returnMinutes',1,'tolls',0,'tollsVerified',true,'measuredAt',now());
  payload:=jsonb_build_object('input',v_input,'context',c->'context','policyId',c->'policy'->>'id','quotePolicyId',c->'quotePolicy'->>'id',
    'quotePolicySnapshot',c->'quotePolicy'->'policy','scope',c->'policy'->'scope','professionalId',pg_temp.fixture_id('professional'),
    'sellerAccountId','qa-'||pg_temp.fixture_id('professional')::text,'origin','Origen sintético QA: no es una dirección real',
    'route',r,'liveMode',false,'expiresAt',now()+interval '25 minutes',
    'calculatedInput',jsonb_build_object('issue','no_enfria','timeSince','days','urgency','flexible','propertyType','house','access','{}'::jsonb,
      'equipment',jsonb_build_object('capacity',4500,'technology','conventional'),'scenario','leak','materials','[]'::jsonb,'materialsConfirmed',false,
      'route',r||jsonb_build_object('origin','Origen del profesional','destination','Dirección de visita')),
    'quote',jsonb_build_object('currency','ARS','version',c->'quotePolicy'->'policy'->>'version','issue','no_enfria','scenario','leak',
      'scope',c->'policy'->'scope'->>'label','contractScope','initial_labor','createdAt',now(),'expiresAt',now()+interval '25 minutes',
      'calculatorSubtotal',100000,'subtotal',100000,'labor',100000,'laborReference',100000,'travel',0,'materials','[]'::jsonb,'materialsAmount',0,
      'safetyRate',.3,'safetyAmount',30000,'total',130000,'platformFeeRate',.18,'platformFee',23400,'professionalAmount',106600,
      'paymentCostBudget',0,'platformContribution',23400,'coverage','covered','reviewReasons','[]'::jsonb,'readyToOffer',true,
      'exclusions',jsonb_build_array('Materiales y repuestos sin cotizar'),'priceKind','preliminary',
      'route',r||jsonb_build_object('origin','Origen del profesional','destination','Dirección de visita')));
  return private.persist_customer_request_preview(pg_temp.fixture_id(actor||'_user'),pg_temp.fixture_id(actor||'_session'),pg_temp.fixture_id(actor||'_customer'),payload);
end; $preview$;
create temporary table fixture_setup_result as select jsonb_build_object('same',pg_temp.make_preview('a',2),'competeB',pg_temp.make_preview('b',3),
  'competeC',pg_temp.make_preview('c',3),'expiry',pg_temp.make_preview('a',4),'approvalFirst',pg_temp.make_preview('a',5)) as setup;
commit;
select setup from fixture_setup_result;
`
}

export function buildWorkerSql(m, { actor, previewId, commandId, marker, holdSeconds = 0 }) {
  assert.ok(['a','b','c'].includes(actor)); assert.match(previewId,uuidPattern); assert.match(commandId,uuidPattern)
  assert.match(marker,/^[a-z0-9_-]{1,60}$/); assert.ok(Number.isInteger(holdSeconds) && holdSeconds >= 0 && holdSeconds <= 20)
  return header(m) + `set local application_name=${literal(marker)};
set local role service_role;
create temporary table worker_result as select pg_backend_pid() as pid,
  public.prepare_customer_request(${id(m,`${actor}_user`)},${id(m,`${actor}_session`)},${id(m,`${actor}_customer`)},${literal(previewId)},${literal(commandId)}) as result;
${holdSeconds ? `select pg_sleep(${holdSeconds});` : ''}
commit;
select pid,result from worker_result;
`
}

export function buildFinancialWorkerSql(m, { operation, jobId, checkoutId, marker, holdSeconds = 0 }) {
  assert.ok(['expire','approve'].includes(operation)); assert.match(jobId,uuidPattern); assert.match(checkoutId,uuidPattern)
  assert.match(marker,/^[a-z0-9_-]{1,60}$/); assert.ok(Number.isInteger(holdSeconds) && holdSeconds >= 0 && holdSeconds <= 20)
  const mutate=operation==='expire'
    ? `select private.expire_schedule_holds(${id(m,'professional')});`
    : `update public.marketplace_checkouts set status='approved' where id=${literal(checkoutId)} and job_id=${literal(jobId)}
        and customer_id=${id(m,'a_customer')} and professional_id=${id(m,'professional')} and live_mode=false;`
  return header(m)+`set local application_name=${literal(marker)};
-- Synthetic database trigger only: this is NOT provider payment evidence.
${mutate}
create temporary table worker_result as select pg_backend_pid() as pid,
  jsonb_build_object('reservation',s.state,'contract',k.state,'status',c.status) as result
  from public.job_schedule_reservations s join private.customer_request_contracts k on k.job_id=s.job_id
    join public.marketplace_checkouts c on c.job_id=s.job_id and c.id=${literal(checkoutId)}
  where s.job_id=${literal(jobId)} and c.customer_id=${id(m,'a_customer')} and c.professional_id=${id(m,'professional')} and c.live_mode=false;
${holdSeconds ? `select pg_sleep(${holdSeconds});` : ''}
commit;
select pid,result from worker_result;
`
}

export function buildCleanupSql(m) {
  assert.ok(m.baseline?.quoteCurrent && m.baseline?.requestCurrent, 'Exact baseline must be captured before setup')
  const quote = m.baseline.quoteCurrent; const request = m.baseline.requestCurrent
  assert.equal(quote.policy_id,null); assert.equal(request.policy_id,null); assert.equal(request.enabled,false); assert.equal(request.version,0)
  return header(m) + `
do $identity$
declare v_request private.customer_request_policy_current%rowtype; v_quote private.quote_policy_current%rowtype;
begin
  if exists(select 1 from storage.objects where bucket_id='public-avatars' and name=${id(m,'pro_user')}::text||'/'||${id(m,'avatar')}::text||'.webp') then
    raise exception 'Synthetic avatar remains: use the scoped Storage API cleanup first'; end if;
  if exists(select 1 from auth.users where id in (${users(m)}) and email is distinct from (id::text||'@pedir-concurrency.invalid')) then
    raise exception 'fixture identity mismatch: refusing cleanup'; end if;
  if exists(select 1 from public.profiles p join (values ${['a','b','c','pro','admin'].map(actor=>`(${id(m,`${actor}_profile`)}::uuid,${id(m,`${actor}_user`)}::uuid)`).join(',')}) f(profile_id,user_id)
    on p.id=f.profile_id where p.auth_user_id is distinct from f.user_id or p.email is distinct from f.user_id::text||'@pedir-concurrency.invalid') then
    raise exception 'profile identity mismatch: refusing cleanup'; end if;
  if exists(select 1 from public.customer_profiles p join (values ${['a','b','c'].map(actor=>`(${id(m,`${actor}_customer`)}::uuid,${id(m,`${actor}_profile`)}::uuid)`).join(',')}) f(customer_id,profile_id)
    on p.id=f.customer_id where p.profile_id is distinct from f.profile_id) then
    raise exception 'customer identity mismatch: refusing cleanup'; end if;
  if exists(select 1 from public.professional_profiles where id=${id(m,'professional')} and profile_id is distinct from ${id(m,'pro_profile')}::uuid) then
    raise exception 'professional identity mismatch: refusing cleanup'; end if;
  -- Match request writer ordering and retain both row locks through cleanup.
  -- A withdrawal or version change by another actor must never be overwritten.
  select * into v_request from private.customer_request_policy_current where singleton for update;
  if not found or (row(v_request.enabled,v_request.policy_id,v_request.version) is distinct from row(false,null::uuid,0)
    and row(v_request.enabled,v_request.policy_id,v_request.version) is distinct from row(true,${id(m,'request_policy')}::uuid,1)) then
    raise exception 'Foreign request policy tuple: refusing cleanup'; end if;
  select * into v_quote from private.quote_policy_current where singleton for update;
  if not found or (row(v_quote.singleton,v_quote.policy_id) is distinct from row(true,null::uuid)
    and row(v_quote.singleton,v_quote.policy_id) is distinct from row(true,${id(m,'quote_policy')}::uuid)) then
    raise exception 'Foreign quote policy tuple: refusing cleanup'; end if;
end; $identity$;
update private.quote_policy_current set policy_id=null where singleton and (policy_id is null or policy_id=${id(m,'quote_policy')});
update private.customer_request_policy_current set enabled=false,policy_id=null,version=0 where singleton
  and (row(enabled,policy_id,version) is not distinct from row(false,null::uuid,0) or row(enabled,policy_id,version) is not distinct from row(true,${id(m,'request_policy')}::uuid,1));
delete from private.outbox_events where recipient_profile_id in (${profiles(m)}) or aggregate_id in (select id from public.jobs where customer_id in (${customers(m)}));
delete from public.admin_audit_logs where actor_profile_id in (${profiles(m)});
delete from public.marketplace_checkouts where customer_id in (${customers(m)});
delete from private.customer_request_contracts where professional_id=${id(m,'professional')} and accepted_by in (${profiles(m)});
delete from public.service_quotes where customer_id in (${customers(m)});
delete from public.jobs where customer_id in (${customers(m)});
delete from public.service_requests where customer_id in (${customers(m)});
delete from private.customer_request_previews where customer_id in (${customers(m)});
delete from private.customer_request_policy_versions where id=${id(m,'request_policy')};
delete from private.quote_policy_versions where id=${id(m,'quote_policy')};
delete from private.professional_avatars where professional_id=${id(m,'professional')};
delete from public.mp_split_connected_accounts where seller_id=${id(m,'professional')}::text;
delete from auth.users where id in (${users(m)});
commit;
`
}

export function assertPairResults(kind, a, b) {
  assert.ok(Number.isInteger(a.pid) && Number.isInteger(b.pid) && a.pid !== b.pid, 'Concurrency requires independent actual PostgreSQL backends')
  if (kind === 'same-command' || kind === 'alias-command') {
    assert.equal(a.result.status,'ready'); assert.deepEqual(b.result,a.result)
  } else if (kind === 'competing-capacity') {
    const statuses=[a.result.status,b.result.status].sort()
    assert.deepEqual(statuses,['ready','unavailable'])
  } else if (kind === 'expiry-approval') {
    assert.deepEqual(a.result,{reservation:'expired',contract:'expired',status:'cancelled'})
    assert.deepEqual(b.result,{reservation:'expired',contract:'payment_review',status:'review'})
  } else if (kind === 'approval-expiry') {
    assert.deepEqual(a.result,{reservation:'confirmed',contract:'paid',status:'approved'})
    assert.deepEqual(b.result,a.result)
  } else throw new Error('Unknown concurrency case')
}

function save(m, directory) { writeFileSync(join(directory,'manifest.json'),JSON.stringify(m,null,2)+'\n') }
function prepareFiles(m, directory) {
  mkdirSync(directory,{recursive:true}); save(m,directory)
  writeFileSync(join(directory,'preflight.sql'),buildPreflightSql())
  writeFileSync(join(directory,'prerequisites.sql'),buildPrerequisiteSql(m))
  writeFileSync(join(directory,'fixtures.sql'),buildFixtureSetupSql(m))
  // The known empty-baseline cleanup is reviewable before any mutation.
  writeFileSync(join(directory,'cleanup.sql'),buildCleanupSql({...m,baseline:{quoteCurrent:{singleton:true,policy_id:null},requestCurrent:{singleton:true,enabled:false,policy_id:null,version:0}}}))
}

async function cli(projectRef, sql, directory, label) {
  assertStagingTarget(projectRef)
  assert.match(label,/^[a-z0-9_-]+$/)
  const path=join(directory,`${label}.sql`)
  if (/["&|<>^%]/.test(path)) throw new Error('Unsafe SQL artifact path')
  writeFileSync(path,sql)
  const args=['/d','/c',wrapper,'db','query','--linked','--project-ref',projectRef,'--file',path,'--output','json']
  return await new Promise((resolvePromise,reject) => {
    const env={...process.env}
    for(const key of Object.keys(env)) if(key==='SUPABASE_ACCESS_TOKEN' || key==='SUPABASE_DB_PASSWORD' || key.startsWith('MERCADOPAGO_') || key==='RESEND_API_KEY') delete env[key]
    const child=spawn('cmd.exe',args,{cwd:originalRepository,env,windowsHide:true,stdio:['ignore','pipe','pipe']})
    const mutation=/^-- STAGING ONLY/.test(sql)
    const failure=message=>Object.assign(new Error(message),{uncertainMutation:mutation})
    let stdout=''; let stderr=''; let timedOut=false; let killFallback
    const timer=setTimeout(()=>{
      timedOut=true
      // Only the process tree created above is terminated. Never target a PID
      // recovered from an older manifest, because Windows may reuse PIDs.
      if(Number.isInteger(child.pid) && child.pid>0) {
        const kill=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'})
        kill.on('error',()=>{})
      }
      killFallback=setTimeout(()=>reject(failure(`Bounded CLI query timed out: ${label}; remote mutation is uncertain and automatic cleanup is forbidden`)),10_000)
    },60_000)
    child.stdout.on('data',chunk=>{stdout+=chunk}); child.stderr.on('data',chunk=>{stderr+=chunk})
    child.on('error',()=>{clearTimeout(timer); clearTimeout(killFallback); reject(new Error(`Unable to start isolated CLI query: ${label}`))})
    // close, not exit: wait until both output streams are fully drained.
    child.on('close',code=>{
      clearTimeout(timer); clearTimeout(killFallback)
      if(timedOut) return reject(failure(`Bounded CLI query timed out: ${label}; remote mutation is uncertain and automatic cleanup is forbidden`))
      if(code!==0){writeFileSync(join(directory,`${label}.error.txt`),stderr); return reject(failure(`Staging SQL query failed: ${label}; inspect exact manifest before recovery`))}
      try { const records=JSON.parse(stdout); writeFileSync(join(directory,`${label}.result.json`),JSON.stringify(records,null,2)); resolvePromise(records) }
      catch {reject(failure(`Invalid staging SQL result: ${label}; inspect exact manifest before recovery`))}
    })
  })
}

export function shouldCleanAutomatically(m) { return m.remoteUncertain !== true }

export function assertReadyStagingMigrations(preflight) {
  assert.equal(preflight?.migrationCount,79,'Reviewed staging migrations are required before fixture writes')
  assert.equal(preflight?.migrationLatest,'20261014235503','Reviewed business-conflict migration must be latest')
}

function avatarPath(m) { assertManifest(m); return `${m.ids.pro_user}/${m.ids.avatar}.webp` }

export function assertQaServiceKey(key) {
  // Never feed credentials into assert APIs: assertion diagnostics echo values.
  try {
    if(typeof key!=='string' || key.split('.').length!==3) throw new Error()
    const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8'))
    if(claims.role!=='service_role' || claims.ref!==qaRef || !Number.isFinite(claims.exp) || claims.exp*1000<=Date.now()) throw new Error()
  } catch { throw new Error('QA service-role credential could not be validated; no Storage request sent') }
}

export function buildStorageOwnershipSql(m) {
  assertManifest(m)
  const path=literal(avatarPath(m))
  const receipt=m.apiAvatar?.id
  if(receipt!==undefined) assert.match(receipt,uuidPattern)
  return `do $storage_owner$ begin
    if exists(select 1 from storage.objects where bucket_id='public-avatars' and name=${path})
      and not exists(select 1 from public.professional_profiles pro join public.profiles p on p.id=pro.profile_id
        join auth.users u on u.id=p.auth_user_id join private.professional_avatars a on a.professional_id=pro.id
        where pro.id=${id(m,'professional')} and pro.profile_id=${id(m,'pro_profile')} and p.auth_user_id=${id(m,'pro_user')}
          and p.email=${id(m,'pro_user')}::text||'@pedir-concurrency.invalid'
          and u.email=${id(m,'pro_user')}::text||'@pedir-concurrency.invalid' and a.object_path=${path})
      ${receipt ? `and not (exists(select 1 from storage.objects where bucket_id='public-avatars' and name=${path} and id=${literal(receipt)}::uuid)
        and not exists(select 1 from auth.users where id=${id(m,'pro_user')})
        and not exists(select 1 from public.profiles where id=${id(m,'pro_profile')})
        and not exists(select 1 from public.professional_profiles where id=${id(m,'professional')}))` : ''}
    then raise exception 'Exact synthetic Storage ownership could not be verified'; end if;
  end; $storage_owner$;
  select exists(select 1 from storage.objects where bucket_id='public-avatars' and name=${path}) as object_exists;`
}

async function readQaServiceKey() {
  // Unlike SQL cli(), this transport NEVER writes stdout/stderr/results/files.
  // The key stays in this process only; no environment variable or tool output.
  const capture=args=>new Promise((resolvePromise,reject)=>{
    const env={...process.env}; delete env.SUPABASE_ACCESS_TOKEN; delete env.SUPABASE_DB_PASSWORD
    const child=spawn('cmd.exe',['/d','/c',wrapper,...args],{cwd:originalRepository,env,windowsHide:true,stdio:['ignore','pipe','pipe']})
    let stdout=''; let timedOut=false; let fallback
    const timer=setTimeout(()=>{
      timedOut=true
      if(Number.isInteger(child.pid) && child.pid>0) spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).on('error',()=>{})
      fallback=setTimeout(()=>{stdout='';reject(new Error('QA credential read timed out; no credential was persisted'))},10_000)
    },30_000)
    child.stdout.on('data',chunk=>{stdout+=chunk})
    // Drain without retaining or exposing stderr, which may contain secrets.
    child.stderr.on('data',()=>{})
    child.on('error',()=>{clearTimeout(timer);clearTimeout(fallback);stdout='';reject(new Error('QA credential transport failed'))})
    child.on('close',code=>{
      clearTimeout(timer);clearTimeout(fallback)
      if(code!==0 || timedOut){stdout='';reject(new Error('QA credential transport failed'));return}
      resolvePromise(stdout);stdout=''
    })
  })
  await capture(['projects','api-keys','--help'])
  let text=await capture(['projects','api-keys','--project-ref',qaRef,'--reveal','--output','json'])
  try {
    const records=JSON.parse(text)
    const key=Array.isArray(records) ? records.find(record=>record.name==='service_role')?.api_key : undefined
    assertQaServiceKey(key)
    return key
  } catch {throw new Error('QA service-role credential could not be obtained safely')}
  finally {text=''}
}

export async function mutateSyntheticAvatar(m,directory,operation,{query=cli,readKey=readQaServiceKey,clientFactory=createClient}={}) {
  assertManifest(m);const path=avatarPath(m)
  if(operation==='remove') {
    const ownership=(await query(m.projectRef,buildStorageOwnershipSql(m),directory,'avatar-ownership-before'))[0]
    if(ownership?.object_exists===false) return
    if(ownership?.object_exists!==true) throw new Error('Exact avatar ownership result is invalid; no Storage request sent')
  } else if(operation==='upload') {
    const check=emptyGuard+`do $empty_storage$ begin if exists(select 1 from storage.objects) then raise exception 'Storage is not empty; refusing synthetic upload'; end if; end; $empty_storage$; select true as empty;`
    if((await query(m.projectRef,check,directory,'avatar-empty-before'))[0]?.empty!==true) throw new Error('Exact staging emptiness could not be verified')
  } else throw new Error('Unknown synthetic avatar operation')
  let key=await readKey()
  assertQaServiceKey(key)
  const client=clientFactory(`https://${qaRef}.supabase.co`,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(15_000)})}})
  key=''
  try {
    if(operation==='remove') {
      const {error}=await client.storage.from('public-avatars').remove([path])
      if(error) throw new Error('Exact synthetic avatar Storage API removal failed')
      const rows=await query(m.projectRef,`select not exists(select 1 from storage.objects where bucket_id='public-avatars' and name=${literal(path)}) as absent;`,directory,'avatar-absence-after')
      if(rows[0]?.absent!==true) throw new Error('Storage API removal did not prove exact object absence')
      m.avatarRemoved=true;save(m,directory)
    } else {
      const bytes=await sharp({create:{width:16,height:16,channels:3,background:'#ffffff'}}).webp().toBuffer()
      const {data,error}=await client.storage.from('public-avatars').upload(path,bytes,{contentType:'image/webp',upsert:false})
      if(error || !data || data.path!==path || !uuidPattern.test(data.id)) throw new Error('Exact synthetic avatar Storage API upload failed')
      m.apiAvatar={id:data.id,path,sha256:createHash('sha256').update(bytes).digest('hex')};save(m,directory)
    }
  } catch {m.remoteUncertain=true;save(m,directory);throw new Error('Synthetic avatar API operation or verification failed; inspect exact manifest before recovery')}
}

const snapshotSql = `select jsonb_build_object(
  'quoteCurrent',(select to_jsonb(c) from private.quote_policy_current c where singleton),
  'requestCurrent',(select to_jsonb(c) from private.customer_request_policy_current c where singleton),
  'authCount',(select count(*) from auth.users),'customerCount',(select count(*) from public.customer_profiles),
  'professionalCount',(select count(*) from public.professional_profiles),'jobCount',(select count(*) from public.jobs),
  'checkoutCount',(select count(*) from public.marketplace_checkouts),'requestCount',(select count(*) from public.service_requests),
  'paymentCount',(select count(*) from public.payments),'outboxCount',(select count(*) from private.outbox_events),
  'auditCount',(select count(*) from public.admin_audit_logs),'storageCount',(select count(*) from storage.objects),
  'previewCount',(select count(*) from private.customer_request_previews),'contractCount',(select count(*) from private.customer_request_contracts),
  'quotePolicyCount',(select count(*) from private.quote_policy_versions),'requestPolicyCount',(select count(*) from private.customer_request_policy_versions),
  'roleMemberships',(select coalesce(jsonb_agg(to_jsonb(m) order by roleid,member,grantor),'[]'::jsonb) from pg_auth_members m),
  'aclFingerprint',(select md5(string_agg(n.nspname||'.'||c.relname||coalesce(c.relacl::text,'')||c.relrowsecurity::text||c.relforcerowsecurity::text,'|' order by n.nspname,c.relname))
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private')),
  'functionAclFingerprint',(select md5(string_agg(n.nspname||'.'||p.proname||p.proargtypes::text||coalesce(p.proacl::text,'')||p.proowner::text||p.prosecdef::text,'|' order by n.nspname,p.proname,p.proargtypes))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private')),
  'rlsPolicyFingerprint',(select md5(string_agg(to_jsonb(p)::text,'|' order by p.polrelid,p.polname))
    from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private'))
) as snapshot;`

async function assertWorkersSettled(m,directory) {
  // If a CLI process exits before its HTTP request settles, wait for the actual
  // bounded SQL backends too. Fail closed rather than deleting under a worker.
  const prefix=runPrefix(m)
  for(let attempt=0;attempt<10;attempt++) {
    const rows=await cli(m.projectRef,`select count(*) as active from pg_stat_activity where left(application_name,${prefix.length})=${literal(prefix)} and pid<>pg_backend_pid() and state is distinct from 'idle';`,directory,`settled-${attempt}`)
    if(rows[0]?.active===0) return
    await new Promise(resolvePromise=>setTimeout(resolvePromise,1000))
  }
  throw new Error('SQL test backend still active; exact cleanup requires --cleanup-only reconciliation after bounded transactions settle')
}

async function runPair(m,directory,kind,aSpec,bSpec) {
  const prefix=`${runPrefix(m)}${kind.replaceAll('-','_')}`
  const markerA=`${prefix}_a`; const markerB=`${prefix}_b`
  const build=aSpec.operation ? buildFinancialWorkerSql : buildWorkerSql
  const aPromise=cli(m.projectRef,build(m,{...aSpec,marker:markerA,holdSeconds:20}),directory,`${kind}-a`)
  const pending=[aPromise]
  // Immediately attach a handler so a rejected long-running query is observed.
  aPromise.catch(()=>{})
  try {
  let holding=false
  for(let attempt=0;attempt<8;attempt++) {
    const rows=await cli(m.projectRef,`select exists(select 1 from pg_stat_activity where application_name=${literal(markerA)} and wait_event='PgSleep') as holding;`,directory,`${kind}-observe-a-${attempt}`)
    if(rows[0]?.holding){holding=true;break}
  }
  assert.ok(holding,'First backend did not retain its transaction during the overlap window')
  const bPromise=cli(m.projectRef,build(m,{...bSpec,marker:markerB}),directory,`${kind}-b`)
  pending.push(bPromise)
  bPromise.catch(()=>{})
  let overlap
  for(let attempt=0;attempt<8;attempt++) {
    const rows=await cli(m.projectRef,`select b.pid as blocked_pid,a.pid as holder_pid,b.wait_event_type,pg_blocking_pids(b.pid) as blocking_pids
      from pg_stat_activity a cross join pg_stat_activity b where a.application_name=${literal(markerA)} and b.application_name=${literal(markerB)}
      and a.pid<>b.pid and a.pid=any(pg_blocking_pids(b.pid));`,directory,`${kind}-observe-lock-${attempt}`)
    if(rows.length){overlap=rows[0];break}
  }
  const [aRows,bRows]=await Promise.all([aPromise,bPromise])
  assert.ok(overlap,'No actual overlapping PostgreSQL lock was observed; refusing to count sequential replay as concurrency')
  const a=aRows[0],b=bRows[0]; assertPairResults(kind,a,b)
  assert.equal(overlap.holder_pid,a.pid); assert.equal(overlap.blocked_pid,b.pid)
  m.results??=[]; m.results.push({kind,overlap,a,b}); save(m,directory)
  } finally {
    // Never clean shared fixtures while another launched worker can commit.
    const settled=await Promise.allSettled(pending)
    if(settled.some(result=>result.status==='rejected' && result.reason?.uncertainMutation)) {m.remoteUncertain=true;save(m,directory)}
  }
}

export async function main(args=process.argv.slice(2)) {
  const refIndex=args.indexOf('--project-ref'); const projectRef=refIndex<0?undefined:args[refIndex+1]
  assertStagingTarget(projectRef)
  const manifestIndex=args.indexOf('--manifest')
  const execute=args.includes('--execute'); const cleanupOnly=args.includes('--cleanup-only')
  const directory=manifestIndex<0?join(repository,'output','pedir-staging',randomUUID()):dirname(resolve(args[manifestIndex+1]))
  const m=manifestIndex<0?createManifest(projectRef):JSON.parse(readFileSync(resolve(args[manifestIndex+1]),'utf8'))
  assertManifest(m)
  if(!execute){prepareFiles(m,directory); console.log(`Review-only staging plan: ${directory}. Remote mutation not yet authorized; no CLI/database operation executed.`); return}
  if(manifestIndex<0) throw new Error('--execute requires an already reviewed --manifest; no implicit setup permitted')
  for(const name of prerequisites) assert.equal(createHash('sha256').update(readFileSync(join(repository,'supabase/migrations',name))).digest('hex'),m.sourceHashes[name],'Reviewed migration source changed')
  await new Promise((resolvePromise,reject)=>{
    const child=spawn('cmd.exe',['/d','/c',wrapper,'db','query','--help'],{cwd:originalRepository,windowsHide:true,stdio:'ignore'})
    child.on('error',reject); child.on('exit',code=>code===0?resolvePromise():reject(new Error('Isolated CLI command discovery failed')))
  })
  if(cleanupOnly) {
    if(m.remoteUncertain && !args.includes('--reconcile-uncertain')) throw new Error('Uncertain remote mutation requires explicit --reconcile-uncertain after process/backend reconciliation; no cleanup executed')
    await assertWorkersSettled(m,directory)
    m.phase='cleanup-started'; save(m,directory)
    await mutateSyntheticAvatar(m,directory,'remove')
    try { await cli(projectRef,buildCleanupSql(m),directory,'recovery-cleanup') }
    catch(error) {m.phase='cleanup-pending';m.remoteUncertain=Boolean(error.uncertainMutation);save(m,directory);throw error}
    const after=(await cli(projectRef,snapshotSql,directory,'recovery-after'))[0]?.snapshot
    assert.deepEqual(after,m.baseline,'Cleanup did not restore the exact staging baseline')
    m.phase='cleaned'; m.remoteUncertain=false; save(m,directory); console.log('Exact manifest cleanup reconciled; original staging policy/ACL/count baseline restored.'); return
  }
  assert.equal(m.phase,'planned','A started run requires --cleanup-only recovery rather than replaying setup')
  assertReadyStagingMigrations((await cli(projectRef,buildPreflightSql(),directory,'migration-preflight'))[0]?.preflight)
  m.baseline=(await cli(projectRef,snapshotSql,directory,'before'))[0]?.snapshot
  for(const [key,value] of Object.entries(m.baseline)) if(key.endsWith('Count')) assert.equal(value,0,`Staging baseline is not empty: ${key}`)
  writeFileSync(join(directory,'cleanup.sql'),buildCleanupSql(m)); m.phase='setup-started'; save(m,directory)
  try {
    await mutateSyntheticAvatar(m,directory,'upload')
    m.previews=(await cli(projectRef,buildFixtureSetupSql(m),directory,'setup'))[0]?.setup
    for(const key of ['same','competeB','competeC','expiry','approvalFirst']) assert.equal(m.previews[key].status,'ready',`Synthetic preview failed: ${key}`)
    m.phase='fixtures-committed'; save(m,directory)
    const same={actor:'a',previewId:m.previews.same.previewId,commandId:m.ids.a_command}
    await runPair(m,directory,'same-command',same,same)
    await runPair(m,directory,'alias-command',same,{...same,commandId:m.ids.a_alias})
    await runPair(m,directory,'competing-capacity',
      {actor:'b',previewId:m.previews.competeB.previewId,commandId:m.ids.b_command},
      {actor:'c',previewId:m.previews.competeC.previewId,commandId:m.ids.c_command})
    const invariants=(await cli(projectRef,`select (select count(*) from public.jobs where customer_id in (${customers(m)})) as jobs,
      (select count(*) from private.customer_request_commands where customer_id in (${customers(m)})) as commands,
      (select count(*) from private.customer_request_contracts where professional_id=${id(m,'professional')}) as contracts,
      (select bool_and(quote->>'total'='130000' and quote->>'platformFee'='23400' and quote->>'professionalAmount'='106600')
        from public.service_quotes where customer_id in (${customers(m)})) as gross_split;`,directory,'invariants'))[0]
    assert.deepEqual(invariants,{jobs:2,commands:3,contracts:2,gross_split:true})
    m.invariants=invariants
    for(const [preview,command,kind,operationA,operationB] of [
      ['expiry','b_alias','expiry-approval','expire','approve'],
      ['approvalFirst','c_alias','approval-expiry','approve','expire']
    ]) {
      const expiry=(await cli(projectRef,header(m)+`set local role service_role;
      create temporary table expiry_job as select public.prepare_customer_request(${id(m,'a_user')},${id(m,'a_session')},${id(m,'a_customer')},${literal(m.previews[preview].previewId)},${id(m,command)}) as result;
      reset role;
      create temporary table expiry_checkout as select to_jsonb(private.prepare_marketplace_checkout(${id(m,'a_customer')},(result->>'jobId')::uuid,null,false)) as result from expiry_job;
      -- Financial closure and approval are synthetic database fixtures only.
      update public.marketplace_checkouts set status='cancelled',closed_for_new_payments_at=clock_timestamp()
        where id=(select (result->>'id')::uuid from expiry_checkout) and customer_id=${id(m,'a_customer')} and live_mode=false;
      update public.job_schedule_reservations set hold_expires_at=clock_timestamp()-interval '1 second'
        where job_id=(select (result->>'jobId')::uuid from expiry_job) and professional_id=${id(m,'professional')};
      commit;
      select jsonb_build_object('jobId',(select result->>'jobId' from expiry_job),'checkoutId',(select result->>'id' from expiry_checkout)) as expiry;`,directory,`${kind}-setup`))[0]?.expiry
      const financial={jobId:expiry.jobId,checkoutId:expiry.checkoutId}
      await runPair(m,directory,kind,{...financial,operation:operationA},{...financial,operation:operationB})
    }
    m.phase='tests-passed'; save(m,directory)
  } catch(error) {
    if(error.uncertainMutation) m.remoteUncertain=true
    save(m,directory);throw error
  } finally {
    m.phaseBeforeCleanup=m.phase; m.phase='cleanup-pending'; save(m,directory)
    if(!shouldCleanAutomatically(m)) throw new Error('Remote mutation outcome is uncertain: automatic cleanup was NOT performed. Reconcile this exact manifest with --cleanup-only --reconcile-uncertain after its own process/backend settles.')
    await assertWorkersSettled(m,directory)
    m.phase='cleanup-started'; save(m,directory)
    await mutateSyntheticAvatar(m,directory,'remove')
    try { await cli(projectRef,buildCleanupSql(m),directory,'cleanup') }
    catch(error) {m.phase='cleanup-pending';m.remoteUncertain=Boolean(error.uncertainMutation);save(m,directory);throw error}
    const after=(await cli(projectRef,snapshotSql,directory,'after'))[0]?.snapshot
    assert.deepEqual(after,m.baseline,'Cleanup did not restore the exact staging baseline')
    m.phase=m.phaseBeforeCleanup==='tests-passed'?'passed-and-cleaned':'failed-and-cleaned'; save(m,directory)
  }
  console.log('Five real independent-connection SQL concurrency cases passed; 18/82 frozen gross split and exact staging cleanup verified. Financial approval was a synthetic database-trigger fixture, not a real provider payment or HTTP/Auth session test.')
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(error=>{console.error(error.message);process.exitCode=1})
