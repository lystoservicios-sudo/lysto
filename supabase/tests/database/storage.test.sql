begin;

\ir ../fixtures/session.sql.inc

select no_plan();
-- Self-contained fixtures: the CLI mounts test SQL files individually.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'storage-customer-a@lysto.test', '', now(), '{"app_role":"customer"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'storage-customer-b@lysto.test', '', now(), '{"app_role":"customer"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'storage-professional-a@lysto.test', '', now(), '{"app_role":"professional"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'storage-professional-b@lysto.test', '', now(), '{"app_role":"professional"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'storage-professional-pending@lysto.test', '', now(), '{"app_role":"professional"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'storage-professional-unassigned@lysto.test', '', now(), '{"app_role":"professional"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'storage-operations@lysto.test', '', now(), '{"app_role":"admin"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'storage-quality@lysto.test', '', now(), '{"app_role":"admin"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'storage-finance@lysto.test', '', now(), '{"app_role":"admin"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'storage-owner@lysto.test', '', now(), '{"app_role":"admin"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'storage-no-profile@lysto.test', '', now(), '{"app_role":"customer"}', '{}', now(), now());

insert into public.profiles (id, auth_user_id, role, first_name, last_name, email)
values
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'customer', 'Storage', 'Customer A', 'storage-customer-a@lysto.test'),
  ('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'customer', 'Storage', 'Customer B', 'storage-customer-b@lysto.test'),
  ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'professional', 'Storage', 'Professional A', 'storage-professional-a@lysto.test'),
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'professional', 'Storage', 'Professional B', 'storage-professional-b@lysto.test'),
  ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'professional', 'Storage', 'Professional Pending', 'storage-professional-pending@lysto.test'),
  ('21000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'professional', 'Storage', 'Professional Unassigned', 'storage-professional-unassigned@lysto.test'),
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'admin', 'Storage', 'Operations', 'storage-operations@lysto.test'),
  ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'admin', 'Storage', 'Quality', 'storage-quality@lysto.test'),
  ('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'admin', 'Storage', 'Finance', 'storage-finance@lysto.test'),
  ('31000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 'admin', 'Storage', 'Owner', 'storage-owner@lysto.test');

insert into public.customer_profiles (id, profile_id)
values
  ('12000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001'),
  ('12000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002');

insert into public.professional_profiles (id, profile_id, status)
values
  ('22000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'approved'),
  ('22000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'approved'),
  ('22000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000003', 'under_review'),
  ('22000000-0000-0000-0000-000000000004', '21000000-0000-0000-0000-000000000004', 'approved');

insert into public.admin_profiles (id, profile_id)
values
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001'),
  ('32000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002'),
  ('32000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000003'),
  ('32000000-0000-0000-0000-000000000004', '31000000-0000-0000-0000-000000000004');

do $$
begin
  if to_regclass('private.admin_profile_permissions') is not null then
    execute $sql$
      insert into private.admin_profile_permissions (
        admin_profile_id, permission, granted_by_admin_profile_id
      )
      values
        ('32000000-0000-0000-0000-000000000001', 'operations', '32000000-0000-0000-0000-000000000004'),
        ('32000000-0000-0000-0000-000000000002', 'quality', '32000000-0000-0000-0000-000000000004'),
        ('32000000-0000-0000-0000-000000000003', 'finance', '32000000-0000-0000-0000-000000000004'),
        ('32000000-0000-0000-0000-000000000004', 'owner', '32000000-0000-0000-0000-000000000004')
    $sql$;
  end if;
end;
$$;

insert into public.service_categories (id, slug, name)
values ('40000000-0000-0000-0000-000000000001', 'storage-test-category', 'Storage test category');

insert into public.service_issue_types (id, category_id, slug, name)
values ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'storage-test-issue', 'Storage test issue');

insert into public.customer_addresses (
  id, customer_id, street, number, city, province, postal_code, is_default
)
values
  ('43000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'Storage A', '1', 'CABA', 'CABA', '1000', true),
  ('43000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', 'Storage B', '2', 'CABA', 'CABA', '1000', true);

insert into public.customer_equipment (id, customer_id, address_id, category_id, nickname)
values
  ('70000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Storage equipment A'),
  ('70000000-0000-0000-0000-000000000003', '12000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Storage equipment A not requested'),
  ('70000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', '43000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Storage equipment B');

insert into public.service_requests (
  id, customer_id, address_id, category_id, issue_type_id, status
)
values
  ('50000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'assigned'),
  ('50000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', '43000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'assigned');

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_requests'
      and column_name = 'equipment_id'
  ) then
    execute $sql$
      update public.service_requests
      set equipment_id = case id
        when '50000000-0000-0000-0000-000000000001'::uuid then '70000000-0000-0000-0000-000000000001'::uuid
        when '50000000-0000-0000-0000-000000000002'::uuid then '70000000-0000-0000-0000-000000000002'::uuid
      end
      where id in (
        '50000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000002'
      )
    $sql$;
  end if;
end;
$$;

insert into public.jobs (id, request_id, customer_id, professional_id, status)
values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', 'confirmed'),
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000002', 'confirmed');


select results_eq($$select id,public from storage.buckets where id in ('equipment-media','job-evidence','professional-documents','public-avatars','request-media','upload-quarantine') order by id$$,$$values ('equipment-media'::text,false),('job-evidence',false),('professional-documents',false),('public-avatars',true),('request-media',false),('upload-quarantine',false)$$,'only avatars are public');
select results_eq($$select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'lysto_storage_%' order by policyname$$,$$values ('lysto_storage_public_avatars_insert'::name),('lysto_storage_quarantine_insert'::name)$$,'exact storage policy inventory closes old upload paths');
select is((select count(*)::int from pg_policies where schemaname='storage' and tablename='objects' and cmd in ('SELECT','ALL') and roles && array['public','anon','authenticated']::name[]),0,'browser cannot mint private read signatures with arbitrary expiry');
select is((select count(*)::int from pg_policies where schemaname='storage' and tablename='objects' and cmd in ('UPDATE','DELETE','ALL')),0,'users cannot overwrite or remove objects');
select ok(not has_function_privilege(r,'public.finalize_storage_upload(text,text,uuid,public.media_type,text,text)','execute'),r||' cannot use the uninspected legacy finalizer') from unnest(array['anon','authenticated','service_role']) r;
select ok(not has_table_privilege(r,'public.'||t,'insert') and not has_column_privilege(r,'public.'||t,'storage_path','insert'),r||' cannot insert arbitrary evidence in '||t) from unnest(array['anon','authenticated','service_role']) r cross join unnest(array['request_media','professional_documents','job_media']) t;
select ok(not has_function_privilege('authenticated','public.finalize_verified_upload(uuid,uuid,text,bigint,text,bigint,text)','execute'),'client cannot certify its own inspection');
select ok(has_function_privilege('service_role','public.finalize_verified_upload(uuid,uuid,text,bigint,text,bigint,text,uuid)','execute'),'server can finalize inspected bytes');
select ok(not pg_has_role('authenticated','service_role','member') and not pg_has_role('anon','service_role','member'),'clients cannot inherit service authority');
select ok(not has_schema_privilege('anon','private','usage'),'anonymous private-schema boundary stays closed');
select ok(not has_table_privilege('authenticated','private.upload_intents','select'),'intent rows require authorized RPCs');
insert into storage.objects(bucket_id,name,owner_id) values('request-media','10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/80000000-0000-0000-0000-000000000001.jpg','10000000-0000-0000-0000-000000000001');
create function pg_temp.actor(p_user uuid,p_role text) returns void language sql as $$ select pg_temp.fixture_set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated','app_metadata',jsonb_build_object('app_role',p_role))::text,true)::text; $$;
select pg_temp.actor('10000000-0000-0000-0000-000000000001','customer');
select pg_temp.fixture_set_config('storage.operation','storage.object.sign',true);
set local role authenticated;
select is((select count(*)::int from storage.objects),0,'owner cannot sign uninspected legacy photo');
reset role;
select pg_temp.actor('30000000-0000-0000-0000-000000000004','admin');
set local role authenticated;
select is((select count(*)::int from storage.objects),0,'owner administrator cannot sign uninspected evidence');
reset role;
select pg_temp.actor('10000000-0000-0000-0000-000000000001','customer');
select pg_temp.fixture_set_config('storage.operation','storage.object.sign_upload_url',true);
set local role authenticated;
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id) values('request-media','10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/80000000-0000-0000-0000-000000000003.jpg','10000000-0000-0000-0000-000000000001')$$,'42501','new row violates row-level security policy for table "objects"','old private upload bypass denied');
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id) values('upload-quarantine','11000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001')$$,'42501','new row violates row-level security policy for table "objects"','quarantine requires matching intent');
select lives_ok($$insert into storage.objects(bucket_id,name,owner_id) values('public-avatars','10000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000004.png','10000000-0000-0000-0000-000000000001')$$,'avatar reservation remains available');
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id) values('public-avatars','10000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000004.png','10000000-0000-0000-0000-000000000001')$$,'42501','new row violates row-level security policy for table "objects"','avatar cannot impersonate owner');
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id) values('public-avatars','10000000-0000-0000-0000-000000000001/../80000000-0000-0000-0000-000000000004.png','10000000-0000-0000-0000-000000000001')$$,'42501','new row violates row-level security policy for table "objects"','avatar path traversal denied');
select pg_temp.fixture_set_config('storage.operation','storage.object.upload',true);
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id) values('public-avatars','10000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000005.png','10000000-0000-0000-0000-000000000001')$$,'42501','new row violates row-level security policy for table "objects"','direct avatar writes denied');
select pg_temp.fixture_set_config('storage.operation','storage.object.list',true);
select is((select count(*)::int from storage.objects),0,'listing exposes no private objects');
reset role;
select * from finish();
rollback;
