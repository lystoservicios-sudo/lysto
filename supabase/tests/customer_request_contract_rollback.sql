-- Run WHOLE FILE on ONE dedicated connection, only after reviewed migration.
-- No pgtap/Docker/provider/account credentials are required. Every actor, OAuth
-- placeholder, quote, job and reservation is synthetic and is ROLLED BACK.
-- The pricing-current pointer is changed transaction-locally solely to address
-- these fixtures. Other connections retain their committed production policy.
-- Never split this file into separate dashboard calls; never replace ROLLBACK.
-- SQL role switches exercise real public RPC privileges, not Auth login/HTTP.
-- The route, tariff and financial approval below are synthetic: this harness
-- does not invoke the TypeScript ledger, Google Routes or Mercado Pago.
begin;
set local lock_timeout='2s';
set local statement_timeout='15s';
set local search_path=public,extensions,pg_temp;

-- Test-only administrative bridge: Supabase's Owner membership may have SET
-- disabled even though it already has ADMIN. This changes only this rollback
-- transaction, never the migration or application-role table privileges.
-- The operator must independently compare pg_auth_members after ROLLBACK.
do $test_role_bridge$ begin
  if not pg_has_role(session_user,'lysto_marketplace','SET') then
    if current_user<>session_user or not pg_has_role(session_user,'lysto_marketplace','MEMBER WITH ADMIN OPTION') then
      raise exception using errcode='42501',message='Existing Owner administrative membership required';
    end if;
    execute 'grant lysto_marketplace to session_user with set true';
  end if;
end; $test_role_bridge$;

create temporary table request_contract_checks(name text not null, passed boolean not null) on commit drop;
create temporary table request_contract_fixture_ids(name text primary key,id uuid not null default gen_random_uuid()) on commit drop;
insert into request_contract_fixture_ids(name) values
  ('user'),('session'),('profile'),('customer'),('other_user'),('other_session'),('other_profile'),('other_customer'),
  ('pro_user'),('pro_profile'),('professional'),('admin_user'),('admin_session'),('admin_profile'),('admin'),
  ('old_address'),('address'),('foreign_address'),('home'),('floor'),('room'),('equipment'),('foreign_equipment'),
  ('command'),('new_command'),('second_command'),('policy'),('avatar');
create function pg_temp.request_fixture_id(p_name text) returns uuid language sql security definer set search_path='' as $$
  select id from pg_temp.request_contract_fixture_ids where name=p_name;
$$;
create function pg_temp.request_check(p_value boolean,p_name text) returns void language plpgsql as $$
begin
  if not coalesce(p_value,false) then raise exception 'Pedir rollback check failed: %',p_name; end if;
  insert into pg_temp.request_contract_checks(name,passed) values(p_name,true);
end; $$;
create function pg_temp.request_throws(p_sql text,p_state text) returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  if sqlstate=p_state then return true; end if;
  raise;
end; $$;

select pg_temp.request_check(not has_function_privilege('authenticated',
  'public.prepare_customer_request(uuid,uuid,uuid,uuid,uuid)','execute'),'Customer cannot invoke privileged writer directly');
select pg_temp.request_check(bool_and(has_function_privilege('service_role',signature,'execute')),
  'Service role may execute all four public server-only RPCs')
from (values ('public.read_customer_request_context(uuid,uuid,uuid,jsonb)'),
  ('public.persist_customer_request_preview(uuid,uuid,uuid,jsonb)'),
  ('public.read_customer_request_preview(uuid,uuid,uuid,uuid,uuid)'),
  ('public.prepare_customer_request(uuid,uuid,uuid,uuid,uuid)')) rpc(signature);
select pg_temp.request_check(bool_and(not has_function_privilege(browser_role,signature,'execute')),
  'Anonymous and authenticated browser roles cannot execute any server-only RPC')
from (values ('anon'),('authenticated')) browser(browser_role)
cross join (values ('public.read_customer_request_context(uuid,uuid,uuid,jsonb)'),
  ('public.persist_customer_request_preview(uuid,uuid,uuid,jsonb)'),
  ('public.read_customer_request_preview(uuid,uuid,uuid,uuid,uuid)'),
  ('public.prepare_customer_request(uuid,uuid,uuid,uuid,uuid)')) rpc(signature);
select pg_temp.request_check(has_function_privilege('authenticated',
  'public.configure_customer_request_contract(uuid,jsonb,timestamp with time zone,integer,text,boolean)','execute')
  and not has_function_privilege('service_role',
  'public.configure_customer_request_contract(uuid,jsonb,timestamp with time zone,integer,text,boolean)','execute')
  and not has_function_privilege('anon',
  'public.configure_customer_request_contract(uuid,jsonb,timestamp with time zone,integer,text,boolean)','execute'),
  'Commercial approval is exposed only to authenticated administrative authority');
select pg_temp.request_check(not has_table_privilege('authenticated','private.customer_request_previews','select'),'Private origin/previews are inaccessible to browser roles');
select pg_temp.request_check(not has_table_privilege('service_role','public.mp_split_connected_accounts','select'),'OAuth secrets keep their existing PostgreSQL-only boundary');
select pg_temp.request_check(exists(select 1 from pg_roles where rolname='lysto_marketplace'),
  'Dedicated marketplace SQL infrastructure role exists');
select pg_temp.request_check(has_function_privilege('lysto_marketplace',
  'private.prepare_marketplace_checkout(uuid,uuid,uuid,boolean)','execute'),
  'Dedicated marketplace SQL role can invoke the real checkout wrapper');
select pg_temp.request_check((select not enabled from private.customer_request_policy_current where singleton),'New commercial rollout remains disabled before the fixture');

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data)
select pg_temp.request_fixture_id(name),id::text||'@request-fixture.invalid',now(),
  jsonb_build_object('app_role',case when name='pro_user' then 'professional' when name='admin_user' then 'admin' else 'customer' end)
from request_contract_fixture_ids where name in('user','other_user','pro_user','admin_user');
insert into public.profiles(id,auth_user_id,role,email,first_name,last_name,phone)
select pg_temp.request_fixture_id(case name when 'user' then 'profile' when 'other_user' then 'other_profile' when 'pro_user' then 'pro_profile' else 'admin_profile' end),
  id,(case when name='pro_user' then 'professional' when name='admin_user' then 'admin' else 'customer' end)::public.user_role,
  id::text||'@request-fixture.invalid','Fixture','Pedir','0000000000'
from request_contract_fixture_ids where name in('user','other_user','pro_user','admin_user');
insert into public.customer_profiles(id,profile_id) values
  (pg_temp.request_fixture_id('customer'),pg_temp.request_fixture_id('profile')),
  (pg_temp.request_fixture_id('other_customer'),pg_temp.request_fixture_id('other_profile'));
insert into public.admin_profiles(id,profile_id) values(pg_temp.request_fixture_id('admin'),pg_temp.request_fixture_id('admin_profile'));
insert into private.admin_profile_permissions(admin_profile_id,permission) values
  (pg_temp.request_fixture_id('admin'),'finance'),(pg_temp.request_fixture_id('admin'),'operations');
insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at)
values(pg_temp.request_fixture_id('admin_user'),pg_temp.request_fixture_id('admin_user'),'totp','verified','synthetic-sql-fixture-not-an-auth-secret',now(),now());
insert into auth.sessions(id,user_id,aal,factor_id,created_at,updated_at) values
  (pg_temp.request_fixture_id('session'),pg_temp.request_fixture_id('user'),'aal1',null,now(),now()),
  (pg_temp.request_fixture_id('other_session'),pg_temp.request_fixture_id('other_user'),'aal1',null,now(),now()),
  (pg_temp.request_fixture_id('admin_session'),pg_temp.request_fixture_id('admin_user'),'aal2',pg_temp.request_fixture_id('admin_user'),now(),now());
insert into public.professional_profiles(id,profile_id,status,base_location)
values(pg_temp.request_fixture_id('professional'),pg_temp.request_fixture_id('pro_profile'),'approved','Origen privado de fixture: NO es una ubicación real');
insert into public.professional_service_categories(professional_id,category_id,approved)
select pg_temp.request_fixture_id('professional'),id,true from public.service_categories where slug='aire_acondicionado' and active;
insert into public.professional_tools(professional_id,tool_code,tool_label,has_tool)
values(pg_temp.request_fixture_id('professional'),'fixture','Herramienta sintética',true);
insert into public.professional_service_zones(professional_id,zone_slug,zone_name)
values(pg_temp.request_fixture_id('professional'),'fixture_'||replace(pg_temp.request_fixture_id('customer')::text,'-',''),
  'Fixture '||pg_temp.request_fixture_id('customer')::text);
insert into public.professional_availability(professional_id,weekday,start_time,end_time)
select pg_temp.request_fixture_id('professional'),day,'08:00','23:00' from generate_series(0,6) day;
insert into public.mp_split_connected_accounts(seller_id,mercado_pago_user_id,encrypted_access_token,access_token_expires_at,created_at,updated_at)
values(pg_temp.request_fixture_id('professional')::text,'fixture-'||pg_temp.request_fixture_id('professional')::text,
  'synthetic-placeholder-never-send-to-provider',now()+interval '1 hour',now(),now());
-- Model a previously verified avatar only for this infrastructure-provisioned
-- test technician, supporting either value of the existing readiness rollout.
insert into storage.objects(bucket_id,name)
values('public-avatars',pg_temp.request_fixture_id('pro_user')::text||'/'||pg_temp.request_fixture_id('avatar')::text||'.webp');
insert into private.professional_avatars(professional_id,object_path,output_sha256)
values(pg_temp.request_fixture_id('professional'),pg_temp.request_fixture_id('pro_user')::text||'/'||pg_temp.request_fixture_id('avatar')::text||'.webp',repeat('a',64));
update public.profiles set avatar_url='https://fixture.invalid/storage/v1/object/public/public-avatars/'||pg_temp.request_fixture_id('pro_user')::text||'/'||pg_temp.request_fixture_id('avatar')::text||'.webp'
where id=pg_temp.request_fixture_id('pro_profile');

insert into public.customer_addresses(id,customer_id,label,street,number,city,province,property_type) values
  (pg_temp.request_fixture_id('old_address'),pg_temp.request_fixture_id('customer'),'Histórico','Calle histórica','1','Fixture '||pg_temp.request_fixture_id('customer')::text,'CABA','house'),
  (pg_temp.request_fixture_id('address'),pg_temp.request_fixture_id('customer'),'Actual','Calle actual','2','Fixture '||pg_temp.request_fixture_id('customer')::text,'CABA','house'),
  (pg_temp.request_fixture_id('foreign_address'),pg_temp.request_fixture_id('other_customer'),'Otro','Calle ajena','3','Fixture otra','CABA','house');
insert into public.customer_homes(id,customer_id,current_address_id,name,kind,windows)
values(pg_temp.request_fixture_id('home'),pg_temp.request_fixture_id('customer'),pg_temp.request_fixture_id('address'),'Fixture Hogar','house','mixed');
insert into public.customer_home_addresses(home_id,customer_id,address_id) values
  (pg_temp.request_fixture_id('home'),pg_temp.request_fixture_id('customer'),pg_temp.request_fixture_id('old_address')),
  (pg_temp.request_fixture_id('home'),pg_temp.request_fixture_id('customer'),pg_temp.request_fixture_id('address'));
insert into public.customer_home_floors(id,home_id,customer_id,name,sort_order)
values(pg_temp.request_fixture_id('floor'),pg_temp.request_fixture_id('home'),pg_temp.request_fixture_id('customer'),'Piso único',0);
insert into public.customer_home_rooms(id,home_id,floor_id,customer_id,name,kind,variant,x,z,width,depth,rotation,windows)
values(pg_temp.request_fixture_id('room'),pg_temp.request_fixture_id('home'),pg_temp.request_fixture_id('floor'),pg_temp.request_fixture_id('customer'),
  'Living fixture','living','integrado',0,0,4,4,0,'large');
insert into public.customer_equipment(id,customer_id,address_id,category_id,nickname,equipment_type,frigorias)
select pg_temp.request_fixture_id('equipment'),pg_temp.request_fixture_id('customer'),pg_temp.request_fixture_id('old_address'),id,'Aire fixture','on_off','4500'
from public.service_categories where slug='aire_acondicionado' and active;
insert into public.customer_equipment(id,customer_id,address_id,category_id,nickname,equipment_type,frigorias)
select pg_temp.request_fixture_id('foreign_equipment'),pg_temp.request_fixture_id('other_customer'),pg_temp.request_fixture_id('foreign_address'),id,'Aire ajeno','on_off','4500'
from public.service_categories where slug='aire_acondicionado' and active;
insert into public.customer_equipment_placements(equipment_id,home_id,room_id,customer_id,wall,wall_offset,height)
values(pg_temp.request_fixture_id('equipment'),pg_temp.request_fixture_id('home'),pg_temp.request_fixture_id('room'),pg_temp.request_fixture_id('customer'),'north',.5,2);
update public.customer_addresses set archived_at=now() where id=pg_temp.request_fixture_id('old_address');

create temporary table request_contract_fixture_data(name text primary key,value jsonb not null) on commit drop;
-- Only this connection's scratch data/results are writable by test roles.
-- No permission on application tables/functions is added by the harness.
grant select,insert on table pg_temp.request_contract_fixture_data to service_role,authenticated,lysto_marketplace;
grant insert on table pg_temp.request_contract_checks to service_role,authenticated,lysto_marketplace;
insert into request_contract_fixture_data values('input',jsonb_build_object('equipmentId',pg_temp.request_fixture_id('equipment'),'expectedEquipmentVersion',1,
  'addressId',pg_temp.request_fixture_id('address'),'homeId',pg_temp.request_fixture_id('home'),'expectedHomeVersion',1,'floorId',pg_temp.request_fixture_id('floor'),
  'roomId',pg_temp.request_fixture_id('room'),'issue','no_enfria','timeSince','days','description','Fixture sin datos reales','answers',jsonb_build_object('frequency','intermittent'),
  'preferredDate',(current_date+2)::text,'timeWindow','10:00 – 12:00','urgency','flexible','uploadIntentIds','[]'::jsonb));
select pg_temp.request_check(pg_temp.request_throws(format('select private.read_customer_request_context(%L,%L,%L,%L::jsonb)',
  pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),pg_temp.request_fixture_id('other_customer'),
  (select value from request_contract_fixture_data where name='input')),'42501'),'Customer authority cannot be substituted');
select pg_temp.request_check(pg_temp.request_throws(format('select private.read_customer_request_context(%L,%L,%L,%L::jsonb)',
  pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),pg_temp.request_fixture_id('customer'),
  (select value||jsonb_build_object('equipmentId',pg_temp.request_fixture_id('foreign_equipment')) from request_contract_fixture_data where name='input')),'P0002'),'Foreign equipment cannot be selected');
select pg_temp.request_check(pg_temp.request_throws(format('select private.read_customer_request_context(%L,%L,%L,%L::jsonb)',
  pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),pg_temp.request_fixture_id('customer'),
  (select value||jsonb_build_object('expectedEquipmentVersion',2) from request_contract_fixture_data where name='input')),'PT409'),'Stale equipment version is rejected');

-- Direct authenticated writes cannot opt into the automatic source marker.
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.request_fixture_id('user'),'session_id',pg_temp.request_fixture_id('session'),
  'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('app_role','customer'))::text,true);
set local role authenticated;
do $direct_write$ begin
if not pg_temp.request_throws(format('insert into public.service_requests(customer_id,category_id,issue_type_id,equipment_id,address_id,visit_address_id,visit_address_snapshot,contract_source)
  select %L,c.id,i.id,%L,null,%L,''{}''::jsonb,''automatic_customer_request'' from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.slug=''aire_acondicionado'' and i.slug=''no_enfria''',
  pg_temp.request_fixture_id('customer'),pg_temp.request_fixture_id('equipment'),pg_temp.request_fixture_id('address')),'42501') then
  raise exception 'Direct automatic marker write was not denied'; end if;
end; $direct_write$;
reset role;
select pg_temp.request_check(true,'Direct authenticated automatic-source INSERT was denied');

-- Synthetic approved tariff: no existing rate/version is modified. Only this
-- transaction's current pointer refers to it; approval is an actual fixture
-- admin/AAL2 policy command, not a forged quote reviewer/pro acceptance.
insert into private.quote_policy_versions(id,revision,policy,created_by,reason)
select pg_temp.request_fixture_id('policy'),coalesce(max(revision),0)+1,jsonb_build_object(
  'version','fixture-'||pg_temp.request_fixture_id('policy')::text,'source','Synthetic rollback contract test only','sourceDate',current_date::text,'approvedUntil',(current_date+7)::text,
  'safetyRate',.3,'platformFeeRate',.15,'paymentCostRate',.04,'priorityMultiplier',1.25,'laborIndex',1,'perKm',0,'perMinute',0,'minimumTravel',0,
  'difficultAccess',0,'height',0,'stairs',0,'noParking',0,'commercial',0,'office',0,'inverterRate',0,'quoteValidityMinutes',30,
  'laborOverrides',jsonb_build_object('leak',100000)),pg_temp.request_fixture_id('admin_profile'),'Synthetic rollback tariff; never production approval'
from private.quote_policy_versions;
update private.quote_policy_current set policy_id=pg_temp.request_fixture_id('policy') where singleton;
insert into request_contract_fixture_data values('approval_input',jsonb_build_object(
  'scopes',jsonb_build_object('no_enfria',jsonb_build_object(
    'scenario','leak','label','Mano de obra inicial de fixture, repuestos por separado','durationMinutes',120,'travelBufferMinutes',30,
    'initialLaborOnly',true,'excludesUnpricedParts',true,'allowsPredictedRepair',true,'allowCustomerEquipmentDeclaration',false)),
  'expectedVersion',(select version from private.customer_request_policy_current where singleton),
  'approvedUntil',now()+interval '1 hour'));
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.request_fixture_id('admin_user'),'session_id',pg_temp.request_fixture_id('admin_session'),
  'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('app_role','admin'))::text,true);
set local role authenticated;
select pg_temp.request_check(pg_temp.request_throws(format(
  'select public.configure_customer_request_contract(%L,%L::jsonb,%L::timestamptz,%L::integer,%L,true)',
  pg_temp.request_fixture_id('policy'),value->'scopes',value->>'approvedUntil',value->>'expectedVersion',
  'Synthetic AAL1 approval must never succeed'),'42501'),'Public administrative approval rejects an AAL1 claim')
from request_contract_fixture_data where name='approval_input';
reset role;
select pg_temp.request_check((select not enabled from private.customer_request_policy_current where singleton),
  'Rejected AAL1 public approval does not enable the rollout');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.request_fixture_id('admin_user'),'session_id',pg_temp.request_fixture_id('admin_session'),
  'role','authenticated','aal','aal2','app_metadata',jsonb_build_object('app_role','admin'))::text,true);
set local role authenticated;
insert into request_contract_fixture_data select 'approval',public.configure_customer_request_contract(
  pg_temp.request_fixture_id('policy'),value->'scopes',(value->>'approvedUntil')::timestamptz,(value->>'expectedVersion')::integer,
  'Explicit synthetic fixture scope only, entirely rolled back',true)
from request_contract_fixture_data where name='approval_input';
select pg_temp.request_check((select (value->>'enabled')::boolean from request_contract_fixture_data where name='approval'),
  'Public administrative approval succeeds under authenticated AAL2');
reset role;
select pg_temp.request_check((select approved_by=pg_temp.request_fixture_id('admin_profile')
  from private.customer_request_policy_versions where id=(select (value->>'id')::uuid from request_contract_fixture_data where name='approval')),
  'Public approval retains the synthetic real-session administrative attribution');
set local role service_role;
insert into request_contract_fixture_data select 'context',public.read_customer_request_context(pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),
  pg_temp.request_fixture_id('customer'),value) from request_contract_fixture_data where name='input';
select pg_temp.request_check((select value->>'reason' is null from request_contract_fixture_data where name='context'),
  'Service role public context RPC resolves the verified synthetic customer');
select pg_temp.request_check(pg_temp.request_throws(format('select public.read_customer_request_context(%L,%L,%L,%L::jsonb)',
  pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),pg_temp.request_fixture_id('other_customer'),
  (select value from request_contract_fixture_data where name='input')),'42501'),
  'Public service-role context RPC cannot substitute customer authority');
reset role;
select pg_temp.request_check((select value->>'reason' is null and jsonb_array_length(value->'candidates')=1 from request_contract_fixture_data where name='context'),
  'Only the synthetic technician is eligible in the synthetic city');

insert into request_contract_fixture_data values('route',jsonb_build_object('source','google','origin','PRIVATE FIXTURE ORIGIN',
  'destination','Fixture visit','province','CABA','outboundKm',1,'returnKm',1,'outboundMinutes',1,'returnMinutes',1,'tolls',0,'tollsVerified',true,'measuredAt',now()));
insert into request_contract_fixture_data(name,value)
select 'payload',jsonb_build_object('input',i.value,'context',c.value->'context','policyId',c.value->'policy'->>'id',
  'quotePolicyId',pg_temp.request_fixture_id('policy'),'quotePolicySnapshot',c.value->'quotePolicy'->'policy','scope',c.value->'policy'->'scope',
  'professionalId',pg_temp.request_fixture_id('professional'),'sellerAccountId','fixture-'||pg_temp.request_fixture_id('professional')::text,
  'origin','Origen privado de fixture: NO es una ubicación real','route',r.value,'liveMode',false,'expiresAt',now()+interval '25 minutes',
  'calculatedInput',jsonb_build_object('issue','no_enfria','timeSince','days','urgency','flexible','propertyType','house','access','{}'::jsonb,
    'equipment',jsonb_build_object('capacity',4500,'technology','conventional'),'scenario','leak','materials','[]'::jsonb,'materialsConfirmed',false,
    'route',r.value||jsonb_build_object('origin','Origen del profesional','destination','Dirección de visita')),
  'quote',jsonb_build_object('currency','ARS','version',c.value->'quotePolicy'->'policy'->>'version','issue','no_enfria','scenario','leak',
    'scope',c.value->'policy'->'scope'->>'label','contractScope','initial_labor','createdAt',now(),'expiresAt',now()+interval '25 minutes',
    'calculatorSubtotal',100000,'subtotal',100000,'labor',100000,'laborReference',100000,'travel',0,'materials','[]'::jsonb,'materialsAmount',0,
    'safetyRate',.3,'safetyAmount',30000,'total',130000,'platformFeeRate',.15,'platformFee',19500,'professionalAmount',110500,
    'paymentCostBudget',0,'platformContribution',19500,'coverage','covered','reviewReasons','[]'::jsonb,'readyToOffer',true,
    'exclusions',jsonb_build_array('Materiales y repuestos sin cotizar'),'priceKind','preliminary',
    'route',r.value||jsonb_build_object('origin','Origen del profesional','destination','Dirección de visita')))
from request_contract_fixture_data i cross join request_contract_fixture_data c cross join request_contract_fixture_data r
where i.name='input' and c.name='context' and r.name='route';
select pg_temp.request_check(pg_temp.request_throws(format('select private.persist_customer_request_preview(%L,%L,%L,%L::jsonb)',
  pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),pg_temp.request_fixture_id('customer'),
  (select jsonb_set(value,'{quote,route,origin}','"PRIVATE FIXTURE ORIGIN"'::jsonb) from request_contract_fixture_data where name='payload')),'22023'),
  'A private base address cannot enter a public quote');
set local role service_role;
insert into request_contract_fixture_data select 'legacy_cost_preview',public.persist_customer_request_preview(pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),
  pg_temp.request_fixture_id('customer'),jsonb_set(value,'{quote,paymentCostBudget}','20000'::jsonb))
from request_contract_fixture_data where name='payload';
select pg_temp.request_check((select value->>'status'='ready' and value->'quote'->>'total'='130000'
  and value->'quote'->>'platformFee'='19500' and value->'quote'->>'professionalAmount'='110500'
  from request_contract_fixture_data where name='legacy_cost_preview'),
  'Legacy hypothetical provider budget cannot block or alter the agreed gross split');
select pg_temp.request_check(pg_temp.request_throws(format('select public.persist_customer_request_preview(%L,%L,%L,%L::jsonb)',
  pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),pg_temp.request_fixture_id('customer'),
  (select jsonb_set(value,'{quote,professionalAmount}','110499'::jsonb) from request_contract_fixture_data where name='payload')),'22023'),
  'Gross professional amount must equal total minus quoted Lysto fee');
select pg_temp.request_check(pg_temp.request_throws(format('select public.persist_customer_request_preview(%L,%L,%L,%L::jsonb)',
  pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),pg_temp.request_fixture_id('customer'),
  (select value #- '{quote,professionalAmount}' from request_contract_fixture_data where name='payload')),'22023'),
  'Missing gross split amount is rejected rather than escaping through SQL NULL');
insert into request_contract_fixture_data select 'preview',public.persist_customer_request_preview(pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),
  pg_temp.request_fixture_id('customer'),value) from request_contract_fixture_data where name='payload';
select pg_temp.request_check((select value->>'status'='ready' and value->>'previewId' is not null from request_contract_fixture_data where name='preview'),
  'Service role public persistence RPC returns a ready synthetic preview');
insert into request_contract_fixture_data select 'uncommitted_public_preview',public.read_customer_request_preview(
  pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),pg_temp.request_fixture_id('customer'),
  (value->>'previewId')::uuid,pg_temp.request_fixture_id('command')) from request_contract_fixture_data where name='preview';
select pg_temp.request_check((select value->'result'='null'::jsonb and value->>'committed'='false'
  and value->'payload'->>'professionalId'=pg_temp.request_fixture_id('professional')::text
  from request_contract_fixture_data where name='uncommitted_public_preview'),
  'Service role public read RPC preserves the uncommitted private preview');
reset role;
select pg_temp.request_check((select count(*)=0 from public.jobs where customer_id=pg_temp.request_fixture_id('customer')),'Preview creates no job/reservation');
set local role service_role;
insert into request_contract_fixture_data select 'prepared',public.prepare_customer_request(pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),
  pg_temp.request_fixture_id('customer'),(value->>'previewId')::uuid,pg_temp.request_fixture_id('command')) from request_contract_fixture_data where name='preview';
select pg_temp.request_check((select value->>'status'='ready' and value->>'jobId' is not null from request_contract_fixture_data where name='prepared'),
  'Service role public preparation RPC returns one synthetic ready contract');
reset role;
select pg_temp.request_check((select value->>'status'='ready' from request_contract_fixture_data where name='prepared'),'Owned initial labor contract is ready to pay');
select pg_temp.request_check((select accepted_at is null and automatic_assignment_at is not null from public.jobs where customer_id=pg_temp.request_fixture_id('customer')),
  'Automatic assignment never forges genuine professional acceptance');
select pg_temp.request_check((select reviewed_by is null and reviewed_at is null from public.service_quotes where customer_id=pg_temp.request_fixture_id('customer')),
  'Automatic contract never forges admin quote review');
select pg_temp.request_check((select address_id=pg_temp.request_fixture_id('old_address') and visit_address_id=pg_temp.request_fixture_id('address')
  and visit_address_snapshot->>'street'='Calle actual' and equipment_id=pg_temp.request_fixture_id('equipment') from public.service_requests where customer_id=pg_temp.request_fixture_id('customer')),
  'Canonical equipment/historical address survive the actual postal visit snapshot');
select pg_temp.request_check((select count(*)=1 from public.customer_equipment where customer_id=pg_temp.request_fixture_id('customer')),'No duplicate equipment is created');
set local role service_role;
select pg_temp.request_check((select value=public.prepare_customer_request(pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),
  pg_temp.request_fixture_id('customer'),(select (value->>'previewId')::uuid from request_contract_fixture_data where name='preview'),pg_temp.request_fixture_id('command'))
  from request_contract_fixture_data where name='prepared'),'Public service-role exact command replays the committed result');
select pg_temp.request_check(pg_temp.request_throws(format('select public.prepare_customer_request(%L,%L,%L,%L,%L)',
  pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),pg_temp.request_fixture_id('customer'),gen_random_uuid(),pg_temp.request_fixture_id('command')),'PT409'),
  'Public service-role command reuse for a different preview is rejected');
insert into request_contract_fixture_data select 'committed_public_preview',public.read_customer_request_preview(
  pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),pg_temp.request_fixture_id('customer'),
  (value->>'previewId')::uuid,pg_temp.request_fixture_id('command')) from request_contract_fixture_data where name='preview';
select pg_temp.request_check((select value->>'committed'='true' and value->'payload'='null'::jsonb
  and value->'result'=(select value from request_contract_fixture_data where name='prepared')
  from request_contract_fixture_data where name='committed_public_preview'),
  'Public read RPC recovers the exact committed result without its private payload');
select pg_temp.request_check((public.read_customer_request_preview(pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),
  pg_temp.request_fixture_id('customer'),(select (value->>'previewId')::uuid from request_contract_fixture_data where name='preview'),pg_temp.request_fixture_id('new_command'))->>'committed')::boolean,
  'Public read RPC exposes a committed preview for recovery under a new durable key');
select pg_temp.request_check(public.prepare_customer_request(pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),pg_temp.request_fixture_id('customer'),
  (select (value->>'previewId')::uuid from request_contract_fixture_data where name='preview'),pg_temp.request_fixture_id('new_command'))
  =(select value from request_contract_fixture_data where name='prepared'),
  'Public preparation recovery binds an alias key to the exact committed result');
reset role;
select pg_temp.request_check(exists(select 1 from private.customer_request_commands where customer_id=pg_temp.request_fixture_id('customer')
  and command_id=pg_temp.request_fixture_id('new_command')),'Every successful prepare binds its command key');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.request_fixture_id('user'),'session_id',pg_temp.request_fixture_id('session'),
  'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('app_role','customer'))::text,true);
set local role authenticated;
do $direct_update$ begin
if not pg_temp.request_throws(format('update public.service_requests set visit_address_snapshot=''{}''::jsonb where customer_id=%L',
  pg_temp.request_fixture_id('customer')),'42501') then raise exception 'Direct visit snapshot UPDATE was not denied'; end if;
end; $direct_update$;
reset role;
select pg_temp.request_check(true,'Direct authenticated automatic-context UPDATE was denied');

-- A schedule confirmation alone cannot project or resolve a paid automatic
-- visit. This synthetic confirmation remains invisible outside the rollback.
update public.job_schedule_reservations set state='confirmed'
where job_id=(select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared');
select pg_temp.request_check(public.get_job_visit((select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared')) is null,
  'Automatic visit remains unconfirmed to the customer until canonical payment');
select pg_temp.request_check(pg_temp.request_throws(format('select private.outbox_recipient(jsonb_populate_record(null::private.outbox_events,%L::jsonb))',
  (select to_jsonb(e) from private.outbox_events e where e.aggregate_id=(select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared')
    and e.event_type='visit.confirmed' limit 1)),'22023'),'Unpaid automatic visit email cannot resolve');
update public.job_schedule_reservations set state='hold'
where job_id=(select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared');

-- No HTTP/provider request occurs: this is a synthetic database checkout only.
-- Exercise the existing dedicated SQL transport role instead of postgres.
-- Its reviewed production privileges come from migrations, not this harness.
set local role lysto_marketplace;
select pg_temp.request_check((select id from public.customer_profiles where id=pg_temp.request_fixture_id('customer') for key share)
  =pg_temp.request_fixture_id('customer'),'Dedicated writer can take the canonical customer FK-compatible lock');
select pg_temp.request_check((select id from public.professional_profiles where id=pg_temp.request_fixture_id('professional') for key share)
  =pg_temp.request_fixture_id('professional'),'Dedicated writer can take the canonical professional FK-compatible lock');
select pg_temp.request_check((select id from public.jobs where id=(select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared') for update)
  =(select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared'),
  'Dedicated writer can take the canonical job update lock without editing its status');
insert into request_contract_fixture_data select 'checkout',to_jsonb(private.prepare_marketplace_checkout(pg_temp.request_fixture_id('customer'),(value->>'jobId')::uuid,null,false))
  from request_contract_fixture_data where name='prepared';
select pg_temp.request_check((select value->>'id' is not null and value->>'status'='creating'
  and value->>'customer_id'=pg_temp.request_fixture_id('customer')::text
  and value->>'professional_id'=pg_temp.request_fixture_id('professional')::text
  and (value->>'amount')::numeric=130000 and (value->>'marketplace_fee')::numeric=19500
  and value->>'live_mode'='false' from request_contract_fixture_data where name='checkout'),
  'Dedicated marketplace SQL role creates the frozen synthetic initial checkout');
reset role;
update public.job_schedule_reservations set hold_expires_at=now()-interval '1 second' where job_id=(select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared');
select private.expire_schedule_holds(pg_temp.request_fixture_id('professional'));
select pg_temp.request_check((select state='hold' from public.job_schedule_reservations where job_id=(select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared')),
  'A creating/pending checkout protects capacity after nominal timeout');
update public.marketplace_checkouts set status='approved' where id=(select (value->>'id')::uuid from request_contract_fixture_data where name='checkout');
select pg_temp.request_check((select state='confirmed' and hold_expires_at is null from public.job_schedule_reservations where job_id=(select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared')),
  'Synthetic initial approval exercises the reservation-confirmation database guard');
select pg_temp.request_check((select state='paid' from private.customer_request_contracts where job_id=(select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared')),
  'Payment confirmation is separate from automatic assignment');
select pg_temp.request_check(public.get_job_visit((select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared'))->>'addressLabel'
  ='Calle actual 2, Fixture '||pg_temp.request_fixture_id('customer')::text,'Paid visit uses its actual immutable address, not the historical equipment FK');
select pg_temp.request_check((select private.outbox_recipient(e)->'context'->>'addressLabel'='Calle actual 2, Fixture '||pg_temp.request_fixture_id('customer')::text
  from private.outbox_events e where e.aggregate_id=(select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared')
    and e.event_type='visit.confirmed' limit 1),'Visit email resolves the same actual address without sending anything');
select pg_temp.request_check(pg_temp.request_throws(format('select private.outbox_recipient(jsonb_populate_record(null::private.outbox_events,%L::jsonb))',
  (select to_jsonb(e)||jsonb_build_object('recipient_profile_id',pg_temp.request_fixture_id('other_profile')) from private.outbox_events e
    where e.aggregate_id=(select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared')
      and e.event_type='visit.confirmed' limit 1)),'22023'),'An unrelated customer cannot receive the automatic visit email');
select pg_temp.request_check((select private.customer_request_visit_address_label(jsonb_populate_record(null::public.service_requests,
  to_jsonb(r)||jsonb_build_object('visit_address_snapshot',r.visit_address_snapshot||jsonb_build_object('id',pg_temp.request_fixture_id('foreign_address'))))) is null
  from public.service_requests r where r.id=(select (value->>'requestId')::uuid from request_contract_fixture_data where name='prepared')),
  'An invalid visit snapshot fails closed rather than falling back to the old address');
select pg_temp.request_check((select private.customer_request_visit_address_label(jsonb_populate_record(null::public.service_requests,
  to_jsonb(r)||jsonb_build_object('visit_address_snapshot',a.value,'context_snapshot',r.context_snapshot||jsonb_build_object('address',a.value)))) is not null
  from public.service_requests r cross join lateral (select r.visit_address_snapshot||jsonb_build_object('street',repeat('s',200),
    'number',repeat('n',30),'city',repeat('c',100),'floor',repeat('f',100),'apartment',repeat('a',100)) as value) a
  where r.id=(select (value->>'requestId')::uuid from request_contract_fixture_data where name='prepared')),
  'Canonical maximum postal lengths remain projectable after payment');
select pg_temp.request_check(not has_function_privilege('anon','public.get_job_visit(uuid)','execute'),'Anonymous roles cannot project a visit');
set local role anon;
do $anonymous_visit$ begin
if not pg_temp.request_throws(format('select public.get_job_visit(%L)',
  (select pg_temp.request_fixture_id('command'))),'42501') then raise exception 'Anonymous visit projection was not denied'; end if;
end; $anonymous_visit$;
reset role;
select pg_temp.request_check(true,'Direct anonymous visit projection is denied');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.request_fixture_id('other_user'),'session_id',pg_temp.request_fixture_id('other_session'),
  'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('app_role','customer'))::text,true);
select pg_temp.request_check(pg_temp.request_throws(format('select public.get_job_visit(%L)',
  (select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared')),'P0002'),'Unrelated authenticated customer cannot project another visit');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.request_fixture_id('user'),'session_id',pg_temp.request_fixture_id('session'),
  'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('app_role','customer'))::text,true);
select pg_temp.request_check((select quote->'route'->>'origin'='Origen del profesional' and input->'route'->>'origin'='Origen del profesional' from public.service_quotes where customer_id=pg_temp.request_fixture_id('customer')),
  'Public quote and input snapshots contain no private technician origin');

-- Another date is independent capacity. Reusing the alias key must fail before
-- this second command can create any resource, even though the first key was
-- itself merely a retry of an already committed preview.
insert into request_contract_fixture_data select 'input2',value||jsonb_build_object('preferredDate',(current_date+3)::text)
  from request_contract_fixture_data where name='input';
insert into request_contract_fixture_data select 'context2',private.read_customer_request_context(pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),
  pg_temp.request_fixture_id('customer'),value) from request_contract_fixture_data where name='input2';
insert into request_contract_fixture_data select 'payload2',p.value||jsonb_build_object('input',i.value,'context',c.value->'context')
  from request_contract_fixture_data p cross join request_contract_fixture_data i cross join request_contract_fixture_data c
  where p.name='payload' and i.name='input2' and c.name='context2';
insert into request_contract_fixture_data select 'preview2',private.persist_customer_request_preview(pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),
  pg_temp.request_fixture_id('customer'),value) from request_contract_fixture_data where name='payload2';
select pg_temp.request_check(pg_temp.request_throws(format('select private.prepare_customer_request(%L,%L,%L,%L,%L)',
  pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),pg_temp.request_fixture_id('customer'),
  (select (value->>'previewId')::uuid from request_contract_fixture_data where name='preview2'),pg_temp.request_fixture_id('new_command')),'PT409'),
  'Alias CmdB also rejects a different preview after recovering CmdA');
select pg_temp.request_check((select count(*)=1 from public.jobs where customer_id=pg_temp.request_fixture_id('customer')),'Rejected alias reuse creates no second job');
insert into request_contract_fixture_data select 'prepared2',private.prepare_customer_request(pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),
  pg_temp.request_fixture_id('customer'),(value->>'previewId')::uuid,pg_temp.request_fixture_id('second_command')) from request_contract_fixture_data where name='preview2';
update public.job_schedule_reservations set hold_expires_at=now()-interval '1 second'
  where job_id=(select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared2');
select private.expire_schedule_holds(pg_temp.request_fixture_id('professional'));
select pg_temp.request_check((select state='expired' from private.customer_request_contracts
  where job_id=(select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared2')),'An abandoned contract with no checkout expires');
select pg_temp.request_check((select status='expired' from public.service_requests
  where id=(select (value->>'requestId')::uuid from request_contract_fixture_data where name='prepared2')),'Expired automatic requests no longer appear active');
select pg_temp.request_check((private.read_customer_request_context(pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),
  pg_temp.request_fixture_id('customer'),(select value from request_contract_fixture_data where name='input2'))->>'reason') is null,
  'An unfinanced expired hold does not block the candidate indefinitely');
-- Simulate ONLY the database guard receiving a late financial approval after
-- capacity was released. No provider endpoint, payment SDK or live event runs.
insert into public.marketplace_checkouts(job_id,customer_id,professional_id,seller_account_id,amount,marketplace_fee,live_mode,status)
select (value->>'jobId')::uuid,pg_temp.request_fixture_id('customer'),pg_temp.request_fixture_id('professional'),
  'fixture-'||pg_temp.request_fixture_id('professional')::text,130000,19500,false,'pending'
from request_contract_fixture_data where name='prepared2';
update public.marketplace_checkouts set status='approved'
where job_id=(select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared2');
select pg_temp.request_check((select status='review' and review_reason='late_automatic_contract_payment' from public.marketplace_checkouts
  where job_id=(select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared2')),'Late approval becomes review, never a false booking');
select pg_temp.request_check((select state='expired' from public.job_schedule_reservations
  where job_id=(select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared2')),'Late approval does not recreate released capacity');

-- Also exercise the existing reviewed-quote path through its actual RPC. This
-- ordinary no_enfria quote is not the Owner-price exception. No snapshot edits.
set local role service_role;
insert into request_contract_fixture_data
select 'legacy_review_quote',public.persist_calculated_quote(pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),pg_temp.request_fixture_id('customer'),jsonb_build_object(
  'address',value->'context'->'address',
  'input',jsonb_set(value->'calculatedInput','{materialsConfirmed}','true'::jsonb),
  'quote',jsonb_set((value->'quote')-'contractScope','{paymentCostBudget}','20000'::jsonb),
  'policyId',value->>'quotePolicyId','policySnapshot',value->'quotePolicySnapshot',
  'preferredDate',value->'input'->>'preferredDate','timeWindow',value->'input'->>'timeWindow',
  'expiresAt',value->>'expiresAt','uploadIntentIds','[]'::jsonb))
from request_contract_fixture_data where name='payload';
reset role;
select pg_temp.request_check((select private.is_owner_maintenance_test_quote(q.customer_id,q.input,q.quote) is false
  from public.service_quotes q join request_contract_fixture_data f on q.id=(f.value->>'id')::uuid where f.name='legacy_review_quote'),
  'Reviewed quote regression uses ordinary pricing, never Owner test exception');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.request_fixture_id('admin_user'),'session_id',pg_temp.request_fixture_id('admin_session'),
  'role','authenticated','aal','aal2','app_metadata',jsonb_build_object('app_role','admin'))::text,true);
set local role authenticated;
insert into request_contract_fixture_data select 'legacy_review_result',public.review_service_quote_v2((value->>'id')::uuid,1,
  'Synthetic gross-split review only, fully rolled back') from request_contract_fixture_data where name='legacy_review_quote';
reset role;
select pg_temp.request_check((select q.status='ready' and q.reviewed_by=pg_temp.request_fixture_id('admin_profile')
  and q.quote->>'total'='130000' and q.quote->>'platformFee'='19500' and q.quote->>'professionalAmount'='110500'
  and q.quote->>'paymentCostBudget'='20000' from public.service_quotes q join request_contract_fixture_data f on q.id=(f.value->>'id')::uuid
  where f.name='legacy_review_quote'),'Actual reviewed-quote helper ignores hypothetical provider budget without rewriting its monetary snapshot');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.request_fixture_id('user'),'session_id',pg_temp.request_fixture_id('session'),
  'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('app_role','customer'))::text,true);

update auth.sessions set not_after=now()-interval '1 second' where id=pg_temp.request_fixture_id('session');
select pg_temp.request_check(pg_temp.request_throws(format('select public.get_job_visit(%L)',
  (select (value->>'jobId')::uuid from request_contract_fixture_data where name='prepared')),'P0002'),'Revoked sessions cannot project a paid visit');
set local role service_role;
select pg_temp.request_check(pg_temp.request_throws(format('select public.prepare_customer_request(%L,%L,%L,%L,%L)',
  pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),pg_temp.request_fixture_id('customer'),
  (select (value->>'previewId')::uuid from request_contract_fixture_data where name='preview'),pg_temp.request_fixture_id('command')),'42501'),
  'Public service-role preparation rejects revoked sessions even for committed replay');
select pg_temp.request_check(pg_temp.request_throws(format('select public.read_customer_request_preview(%L,%L,%L,%L,%L)',
  pg_temp.request_fixture_id('user'),pg_temp.request_fixture_id('session'),pg_temp.request_fixture_id('customer'),
  (select (value->>'previewId')::uuid from request_contract_fixture_data where name='preview'),pg_temp.request_fixture_id('command')),'42501'),
  'Public service-role preview recovery rejects revoked sessions');
reset role;

select count(*) as passed_checks,bool_and(passed) as all_passed from request_contract_checks;
rollback;
