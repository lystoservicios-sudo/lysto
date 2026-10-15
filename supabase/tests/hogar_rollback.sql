-- pgTAP suite for `supabase test db` / pg_prove and focused owner-run QA.
-- Every lifecycle row is synthetic. BEGIN/ROLLBACK retains no test identities,
-- homes, equipment, extension setup or changes to real customer records.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
set local statement_timeout='30s';
select plan(18);
select has_table('public','customer_homes','Stable customer homes are persisted');
select has_table('public','customer_home_addresses','Address revisions are linked explicitly');
select has_table('public','customer_home_floors','Internal floors are persisted separately');
select has_table('public','customer_home_rooms','Editable room variants and layout are persisted');
select has_table('public','customer_equipment_placements','Placement metadata is separate from historical equipment');
select ok((select count(*)=5 and bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('customer_homes','customer_home_addresses','customer_home_floors','customer_home_rooms','customer_equipment_placements')),'All exposed Hogar tables enable RLS');
select ok(not exists(select 1 from unnest(array['customer_homes','customer_home_addresses','customer_home_floors','customer_home_rooms','customer_equipment_placements']) as t(name)
  where has_table_privilege('authenticated','public.'||t.name,'insert') or has_table_privilege('authenticated','public.'||t.name,'update') or has_table_privilege('authenticated','public.'||t.name,'delete')),'Authenticated direct mutations are denied on every Hogar table');
select ok(not exists(select 1 from unnest(array['customer_homes','customer_home_addresses','customer_home_floors','customer_home_rooms','customer_equipment_placements']) as t(name)
  where has_table_privilege('anon','public.'||t.name,'select') or has_table_privilege('anon','public.'||t.name,'insert') or has_table_privilege('anon','public.'||t.name,'update') or has_table_privilege('anon','public.'||t.name,'delete')),'Anonymous table access is denied');
select ok(has_function_privilege('authenticated','public.read_customer_homes()','execute'),'Customers can enter the guarded read RPC');
select ok(has_function_privilege('authenticated','public.write_customer_home(text,uuid,integer,jsonb)','execute'),'Customers can enter the guarded mutation RPC');
select ok(not has_function_privilege('anon','public.read_customer_homes()','execute'),'Anonymous cannot read home aggregates');
select ok(not has_function_privilege('anon','public.write_customer_home(text,uuid,integer,jsonb)','execute'),'Anonymous cannot mutate home aggregates');
select ok((select count(*)=2 and bool_and(not p.prosecdef) from pg_proc p where p.oid in ('public.read_customer_homes()'::regprocedure,'public.write_customer_home(text,uuid,integer,jsonb)'::regprocedure)),'Public home RPCs are invoker wrappers');
select ok((select count(*)=2 and bool_and(p.prosecdef and array_to_string(p.proconfig,',') like '%search_path=""%') from pg_proc p where p.oid in ('private.read_customer_homes()'::regprocedure,'private.write_customer_home(text,uuid,integer,jsonb)'::regprocedure)),'Privileged home RPCs are private with pinned empty search paths');
select ok(not has_function_privilege('authenticated','private.write_customer_asset_before_hogar(text,uuid,integer,jsonb,boolean)','execute'),'Customers cannot bypass the canonical address guard');
select ok((select c.relrowsecurity and not has_table_privilege('authenticated','private.customer_home_operations','select') from pg_class c where c.oid='private.customer_home_operations'::regclass),'Idempotency records remain private and protected');
select ok((select exists(select 1 from pg_constraint c where c.conrelid='public.customer_equipment_placements'::regclass and c.confrelid='public.customer_equipment'::regclass and c.contype='f')
  and exists(select 1 from pg_constraint c where c.conrelid='public.customer_equipment_placements'::regclass and c.confrelid='public.customer_home_rooms'::regclass and c.contype='f')),'Placements retain real equipment and owned room foreign keys');
-- lives_ok emits a TAP assertion and SQL diagnostics if any lifecycle guard
-- raises. Keep this invocation SECURITY INVOKER: its DO block changes roles.
select lives_ok($hogar_qa$
do $qa$
declare
  u1 uuid:=gen_random_uuid(); u2 uuid:=gen_random_uuid(); s1 uuid:=gen_random_uuid(); s2 uuid:=gen_random_uuid();
  p1 uuid; p2 uuid; c1 uuid; c2 uuid; a1 jsonb; a2 jsonb; input jsonb; result jsonb; home jsonb; equipment jsonb; revision jsonb;
  current_home jsonb; inline_input jsonb; inline_result jsonb; inline_label text:='hogar-inline-'||gen_random_uuid(); failed_label text:='hogar-failed-'||gen_random_uuid();
  capacity_home jsonb; capacity_room uuid:=gen_random_uuid(); capacity_data jsonb; capacity_key uuid:=gen_random_uuid(); capacity_inventory integer; capacity_equipment uuid; capacity_category uuid;
  floor_id uuid:=gen_random_uuid(); room_id uuid:=gen_random_uuid(); key uuid:=gen_random_uuid();
  equip_key uuid:=gen_random_uuid(); owner_role text:=current_user; count_rows integer; rejected boolean; k text; fk uuid; rk uuid;
begin
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values(u1,'hogar-qa-'||u1||'@example.invalid',now(),'{"app_role":"customer","signup_source":"hogar_rollback_test"}','{}',now(),now()),
          (u2,'hogar-qa-'||u2||'@example.invalid',now(),'{"app_role":"customer","signup_source":"hogar_rollback_test"}','{}',now(),now());
  insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(s1,u1,now(),now(),'aal1'),(s2,u2,now(),now(),'aal1');
  insert into public.profiles(auth_user_id,role,first_name,last_name,email,phone) values(u1,'customer','Hogar','QA','hogar-qa-'||u1||'@example.invalid','1155551234') returning id into p1;
  insert into public.profiles(auth_user_id,role,first_name,last_name,email,phone) values(u2,'customer','Otro','QA','hogar-qa-'||u2||'@example.invalid','1155551234') returning id into p2;
  insert into public.customer_profiles(profile_id) values(p1) returning id into c1;
  insert into public.customer_profiles(profile_id) values(p2) returning id into c2;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u1,'role','authenticated','session_id',s1,'aal','aal1','app_metadata',jsonb_build_object('app_role','customer'))::text,true);
  perform set_config('role','authenticated',true);
  if private.current_customer_id() is distinct from c1 then raise exception 'QA owner identity failure'; end if;
  a1:=public.write_customer_asset('address',null,null,'{"label":"QA casa","street":"Test street","number":"123","city":"CABA","province":"CABA","propertyType":"house","access":{},"isDefault":false}',false)->'address';
  input:=jsonb_build_object('name','Hogar QA','addressId',a1->>'id','kind','house','building',null,'features',jsonb_build_object('balcony',true,'terrace',true,'windows','mixed'),
    'floors',jsonb_build_array(jsonb_build_object('id',floor_id,'name','Planta baja','order',0,'rooms',jsonb_build_array(jsonb_build_object('id',room_id,'name','Dormitorio principal','kind','bedroom','variant','principal','x',0,'z',0,'width',4,'depth',4,'rotation',0,'windows','large')))),
    'placements','[]'::jsonb,'idempotencyKey',key);
  result:=public.write_customer_home('create',null,null,input); home:=result->'home';
  if home->>'id' is null or home->'floors'->0->'rooms'->0->>'id'<>room_id::text then raise exception 'QA create failed'; end if;
  if public.write_customer_home('create',null,null,input) is distinct from result then raise exception 'QA creation retry failed'; end if;
  inline_input:=(input-'idempotencyKey')||jsonb_build_object('addressId',null,'idempotencyKey',gen_random_uuid(),'newAddress',jsonb_build_object('label',inline_label,'street','Inline test','number','1','city','CABA','province','CABA','propertyType','house','access','{}'::jsonb,'isDefault',false),
    'floors',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','Principal','order',0,'rooms','[]'::jsonb)));
  inline_result:=public.write_customer_home('create',null,null,inline_input);
  if inline_result->'home'->>'addressId' is distinct from inline_result->'address'->>'id' then raise exception 'QA inline address missing'; end if;
  if public.write_customer_home('create',null,null,inline_input) is distinct from inline_result then raise exception 'QA inline address retry differs'; end if;
  if (select count(*) from public.customer_addresses where label=inline_label)<>1 then raise exception 'QA inline address duplicated'; end if;
  rejected:=false;
  begin perform public.write_customer_home('create',null,null,inline_input||jsonb_build_object('idempotencyKey',gen_random_uuid(),'newAddress',(inline_input->'newAddress')||jsonb_build_object('label',failed_label),'floors','[]'::jsonb)); exception when sqlstate '22023' then rejected:=true; end;
  if not rejected or exists(select 1 from public.customer_addresses where label=failed_label) then raise exception 'QA failed home left an orphan address'; end if;
  -- Seed capacity as the database owner; the attempted 501st registration must
  -- still go through the authenticated RPC, bypassing all client/UI checks.
  capacity_home:=public.write_customer_home('create',null,null,inline_input||jsonb_build_object('idempotencyKey',gen_random_uuid(),'newAddress',(inline_input->'newAddress')||jsonb_build_object('label','QA capacity'),
    'floors',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','Capacity','order',0,'rooms',jsonb_build_array(jsonb_build_object('id',capacity_room,'name','Capacity room','kind','bedroom','variant','principal','x',0,'z',0,'width',4,'depth',4,'rotation',0,'windows','large'))))))->'home';
  perform set_config('role',owner_role,true);
  select id into capacity_category from public.service_categories where slug='aire_acondicionado' and active;
  with seeded as (
    insert into public.customer_equipment(customer_id,address_id,category_id,nickname,equipment_type)
      select c1,(capacity_home->>'addressId')::uuid,capacity_category,'QA capacity air '||series.n,'split' from generate_series(1,500) as series(n) returning id
  ) insert into public.customer_equipment_placements(equipment_id,home_id,room_id,customer_id,wall,wall_offset,height)
    select seeded.id,(capacity_home->>'id')::uuid,capacity_room,c1,'north',.5,2 from seeded;
  select id into capacity_equipment from public.customer_equipment where customer_id=c1 and address_id=(capacity_home->>'addressId')::uuid limit 1;
  perform set_config('role','authenticated',true);
  select count(*) into capacity_inventory from public.customer_equipment where customer_id=c1;
  capacity_data:=jsonb_build_object('idempotencyKey',capacity_key,'equipment',jsonb_build_object('nickname','QA over capacity','equipmentType','split'),'placement',jsonb_build_object('roomId',capacity_room,'wall','north','offset',.5,'height',2));
  rejected:=false;
  begin perform public.write_customer_home('equipment',(capacity_home->>'id')::uuid,1,capacity_data); exception when sqlstate '22023' then rejected:=true; end;
  if not rejected or (select version from public.customer_homes where id=(capacity_home->>'id')::uuid)<>1
    or (select count(*) from public.customer_equipment where customer_id=c1)<>capacity_inventory then raise exception 'QA 501st registration was not atomic'; end if;
  -- Archived inventory leaves stale placement rows. They must not consume the
  -- active snapshot capacity; a rejected command must not poison its retry key.
  perform public.write_customer_asset('equipment',capacity_equipment,1,'{}',true);
  result:=public.write_customer_home('equipment',(capacity_home->>'id')::uuid,1,capacity_data);
  if jsonb_array_length(result->'home'->'placements')<>500 or (result->'home'->>'version')::int<>2 then raise exception 'QA archived equipment incorrectly consumes capacity'; end if;
  rejected:=false;
  begin update public.customer_homes set name='Bypass' where id=(home->>'id')::uuid; exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'QA direct DML allowed'; end if;
  rejected:=false;
  begin perform public.write_customer_home('save',(home->>'id')::uuid,1,(input-'idempotencyKey')||jsonb_build_object('features',jsonb_build_object('balcony',true,'terrace',true,'windows','mixed'),'floors',jsonb_build_array(jsonb_build_object('id',floor_id,'name','Planta baja','order',0,'rooms',jsonb_build_array(input->'floors'->0->'rooms'->0,(input->'floors'->0->'rooms'->0)||jsonb_build_object('id',gen_random_uuid())))))); exception when sqlstate '22023' then rejected:=true; end;
  if not rejected then raise exception 'QA overlap accepted'; end if;
  result:=public.write_customer_home('equipment',(home->>'id')::uuid,1,jsonb_build_object('idempotencyKey',equip_key,'equipment',jsonb_build_object('nickname','Aire QA','equipmentType','inverter'),'placement',jsonb_build_object('roomId',room_id,'wall','north','offset',.5,'height',2)));
  equipment:=result->'equipment'; home:=result->'home';
  if home->'placements'->0->>'equipmentId' is distinct from equipment->>'id' then raise exception 'QA equipment placement failed'; end if;
  if public.write_customer_home('equipment',(home->>'id')::uuid,1,jsonb_build_object('idempotencyKey',equip_key,'equipment',jsonb_build_object('nickname','Aire QA','equipmentType','inverter'),'placement',jsonb_build_object('roomId',room_id,'wall','north','offset',.5,'height',2))) is distinct from result then raise exception 'QA equipment retry failed'; end if;
  select count(*) into count_rows from public.customer_equipment where address_id=(a1->>'id')::uuid;
  if count_rows<>1 then raise exception 'QA duplicate equipment'; end if;
  rejected:=false;
  begin perform public.write_customer_home('save',(home->>'id')::uuid,1,input-'idempotencyKey'); exception when sqlstate 'PT409' then rejected:=true; end;
  if not rejected then raise exception 'QA stale version accepted'; end if;
  -- Explicit address revisions retain a stable home and the equipment's old address.
  revision:=public.write_customer_asset('address',(a1->>'id')::uuid,(a1->>'version')::int,'{"label":"QA corregida","street":"Test street","number":"124","city":"CABA","province":"CABA","propertyType":"house","access":{},"isDefault":false}',false);
  if revision->>'replacedId' is distinct from a1->>'id' then raise exception 'QA address was not revisioned'; end if;
  select value into current_home from jsonb_array_elements(public.read_customer_homes()->'homes') where value->>'id'=home->>'id';
  if current_home->>'addressId' is distinct from revision->'address'->>'id' or not(current_home->'addressIds' ? (a1->>'id')) then raise exception 'QA home alias not preserved'; end if;
  rejected:=false;
  begin perform public.write_customer_asset('address',(revision->'address'->>'id')::uuid,(revision->'address'->>'version')::int,'{}',true); exception when sqlstate 'P0001' then rejected:=true; end;
  if not rejected then raise exception 'QA active home address was archived'; end if;
  if (select address_id from public.customer_equipment where id=(equipment->>'id')::uuid) is distinct from (a1->>'id')::uuid then raise exception 'QA equipment historical address changed'; end if;
  -- Owner B cannot see or change A, including alias/floor/room/placement rows.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u2,'role','authenticated','session_id',s2,'aal','aal1','app_metadata',jsonb_build_object('app_role','customer'))::text,true);
  if exists(select 1 from public.customer_homes where id=(home->>'id')::uuid) or exists(select 1 from public.customer_home_floors where id=floor_id)
    or exists(select 1 from public.customer_home_rooms where id=room_id) or exists(select 1 from public.customer_home_addresses where home_id=(home->>'id')::uuid)
    or exists(select 1 from public.customer_equipment_placements where equipment_id=(equipment->>'id')::uuid) then raise exception 'QA cross-owner read leak'; end if;
  rejected:=false;
  begin perform public.write_customer_home('archive',(home->>'id')::uuid,(current_home->>'version')::int,'{}'); exception when no_data_found then rejected:=true; end;
  if not rejected then raise exception 'QA cross-owner mutation'; end if;
  a2:=public.write_customer_asset('address',null,null,'{"label":"QA B","street":"Other test","number":"1","city":"CABA","province":"CABA","propertyType":"office","access":{},"isDefault":false}',false)->'address';
  fk:=gen_random_uuid(); rk:=gen_random_uuid();
  result:=public.write_customer_home('create',null,null,jsonb_build_object('name','Oficina QA','addressId',a2->>'id','kind','office','building',null,'features',jsonb_build_object('balcony',false,'terrace',false,'windows','small'),
    'floors',jsonb_build_array(jsonb_build_object('id',fk,'name','Principal','order',0,'rooms',jsonb_build_array(jsonb_build_object('id',rk,'name','Recepción','kind','reception','variant','compact','x',0,'z',0,'width',4,'depth',4,'rotation',0,'windows','small')))),'placements','[]'::jsonb,'idempotencyKey',gen_random_uuid()));
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u1,'role','authenticated','session_id',s1,'aal','aal1','app_metadata',jsonb_build_object('app_role','customer'))::text,true);
  rejected:=false;
  begin perform public.write_customer_home('save',(current_home->>'id')::uuid,(current_home->>'version')::int,(input-'idempotencyKey')||jsonb_build_object('addressId',current_home->>'addressId','floors',jsonb_build_array(jsonb_build_object('id',fk,'name','Adopted','order',0,'rooms','[]'::jsonb)))); exception when no_data_found then rejected:=true; end;
  if not rejected then raise exception 'QA foreign floor adopted'; end if;
  result:=public.write_customer_home('save',(current_home->>'id')::uuid,(current_home->>'version')::int,(input-'idempotencyKey')||jsonb_build_object('addressId',current_home->>'addressId','floors',jsonb_build_array(jsonb_build_object('id',floor_id,'name','Planta baja','order',0,'rooms','[]'::jsonb))));
  if jsonb_array_length(result->'home'->'placements')<>0 or not exists(select 1 from public.customer_equipment where id=(equipment->>'id')::uuid) then raise exception 'QA room removal deleted equipment'; end if;
  perform public.write_customer_home('archive',(current_home->>'id')::uuid,(result->'home'->>'version')::int,'{}');
  if not exists(select 1 from public.customer_equipment where id=(equipment->>'id')::uuid) then raise exception 'QA archive deleted equipment'; end if;
  perform public.write_customer_asset('address',(revision->'address'->>'id')::uuid,(revision->'address'->>'version')::int,'{}',true);
  perform set_config('role',owner_role,true);
end;
$qa$;
$hogar_qa$,'Synthetic Hogar lifecycle: persistence, owner isolation, versions, atomic retries, address revisions, archival guard and inventory preservation');
select * from finish();
rollback;
