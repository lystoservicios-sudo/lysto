begin;

select plan(101);

create function pg_temp.set_jwt(p_uid uuid, p_app_role text)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_uid::text,
      'role', 'authenticated',
      'app_metadata', jsonb_build_object('app_role', p_app_role),
      'user_metadata', '{}'::jsonb
    )::text,
    true
  )::text;
$$;

create function pg_temp.set_storage_operation(p_operation text)
returns void
language sql
as $$
  select set_config('storage.operation', p_operation, true)::text;
$$;

select results_eq(
  $$
    select id, name, public, file_size_limit::bigint, allowed_mime_types
    from storage.buckets
    where id in (
      'equipment-media',
      'job-evidence',
      'professional-documents',
      'public-avatars',
      'request-media'
    )
    order by id
  $$,
  $$
    values
      ('equipment-media'::text, 'equipment-media'::text, false, 10485760::bigint, array['image/jpeg','image/png','image/webp']::text[]),
      ('job-evidence'::text, 'job-evidence'::text, false, 20971520::bigint, array['image/jpeg','image/png','image/webp','application/pdf']::text[]),
      ('professional-documents'::text, 'professional-documents'::text, false, 10485760::bigint, array['image/jpeg','image/png','application/pdf']::text[]),
      ('public-avatars'::text, 'public-avatars'::text, true, 2097152::bigint, array['image/jpeg','image/png','image/webp']::text[]),
      ('request-media'::text, 'request-media'::text, false, 31457280::bigint, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']::text[])
  $$,
  'the five managed buckets have their exact immutable configuration'
);

select ok(
  not exists (select 1 from storage.buckets where id = 'job-media'),
  'greenfield storage has no legacy job-media bucket'
);

select results_eq(
  $$
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'lysto_storage_%'
    order by policyname
  $$,
  $$
    values
      ('lysto_storage_equipment_media_insert'::name),
      ('lysto_storage_equipment_media_sign'::name),
      ('lysto_storage_job_evidence_insert'::name),
      ('lysto_storage_job_evidence_sign'::name),
      ('lysto_storage_professional_documents_insert'::name),
      ('lysto_storage_professional_documents_sign'::name),
      ('lysto_storage_public_avatars_insert'::name),
      ('lysto_storage_request_media_insert'::name),
      ('lysto_storage_request_media_sign'::name)
  $$,
  'the storage policy inventory is explicit and complete'
);

select results_eq(
  $$
    select policyname, cmd, roles
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'lysto_storage_%'
    order by policyname
  $$,
  $$
    values
      ('lysto_storage_equipment_media_insert'::name, 'INSERT'::text, array['authenticated']::name[]),
      ('lysto_storage_equipment_media_sign'::name, 'SELECT'::text, array['authenticated']::name[]),
      ('lysto_storage_job_evidence_insert'::name, 'INSERT'::text, array['authenticated']::name[]),
      ('lysto_storage_job_evidence_sign'::name, 'SELECT'::text, array['authenticated']::name[]),
      ('lysto_storage_professional_documents_insert'::name, 'INSERT'::text, array['authenticated']::name[]),
      ('lysto_storage_professional_documents_sign'::name, 'SELECT'::text, array['authenticated']::name[]),
      ('lysto_storage_public_avatars_insert'::name, 'INSERT'::text, array['authenticated']::name[]),
      ('lysto_storage_request_media_insert'::name, 'INSERT'::text, array['authenticated']::name[]),
      ('lysto_storage_request_media_sign'::name, 'SELECT'::text, array['authenticated']::name[])
  $$,
  'managed policies grant only INSERT or signed-URL SELECT'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'lysto_storage_%_insert'
      and coalesce(with_check, '') like '%allow_only_operation%'
      and coalesce(with_check, '') like '%storage.object.sign_upload_url%'
  ),
  5::bigint,
  'every authenticated reservation policy allows only signed-upload URL creation'
);

select ok(
  (
    select coalesce(with_check, '') like '%private.current_profile_id%'
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'lysto_storage_public_avatars_insert'
  ),
  'avatar reservation requires a real application profile'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'authenticated request media upload',
        'authenticated job media upload',
        'authenticated professional docs upload'
      )
  ),
  0::bigint,
  'legacy authenticated-wide upload policies are removed'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and coalesce(qual, '') like '%job-media%'
         or schemaname = 'storage'
        and tablename = 'objects'
        and coalesce(with_check, '') like '%job-media%'
  ),
  0::bigint,
  'legacy job-media has no object policies'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd in ('UPDATE', 'DELETE', 'ALL')
  ),
  0::bigint,
  'storage grants no update, delete, or all policy'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'lysto_storage_%'
      and (
        coalesce(qual, '') like '%owner_id%'
        or coalesce(with_check, '') like '%owner_id%'
      )
  ),
  9::bigint,
  'every managed policy binds the object to its immutable owner_id path segment'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (coalesce(qual, '') ~ '\mowner\M' or coalesce(with_check, '') ~ '\mowner\M')
  ),
  'no storage policy uses the deprecated owner column'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'lysto_storage_%_sign'
      and coalesce(qual, '') like '%allow_any_operation%'
  ),
  4::bigint,
  'every private read policy is operation-aware'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'lysto_storage_%_sign'
      and coalesce(qual, '') like '%storage.object.sign%'
      and coalesce(qual, '') like '%storage.object.sign_many%'
  ),
  4::bigint,
  'private reads allow only single and batch signed-URL creation'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'lysto_storage_%_sign'
      and (
        coalesce(qual, '') like '%object.list%'
        or coalesce(qual, '') like '%object.get_authenticated%'
      )
  ),
  'private read policies expose neither listing nor direct authenticated GET'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'lysto_storage_%'
      and (
        coalesce(qual, '') like '%private.current_%'
        or coalesce(with_check, '') like '%private.current_%'
        or coalesce(qual, '') like '%private.has_admin_permission%'
        or coalesce(with_check, '') like '%private.has_admin_permission%'
      )
  ),
  9::bigint,
  'entity policies use the trusted private identity and permission helpers'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'request_media_storage_bucket_check')
  and exists (select 1 from pg_constraint where conname = 'professional_documents_storage_bucket_check')
  and exists (select 1 from pg_constraint where conname = 'job_media_storage_bucket_check'),
  'metadata tables constrain their canonical storage buckets'
);

select ok(
  (
    select pg_get_constraintdef(oid) = 'CHECK ((storage_bucket = ''job-evidence''::text))'
    from pg_constraint
    where conname = 'job_media_storage_bucket_check'
      and conrelid = 'public.job_media'::regclass
  ),
  'job_media accepts only the canonical job-evidence bucket'
);

select has_column(
  'public', 'service_requests', 'equipment_id',
  'storage authorization is anchored to the request exact equipment'
);

select ok(
  to_regprocedure('public.finalize_storage_upload(text,text,uuid,public.media_type,text,text)') is not null,
  'service-only finalization RPC exists with its exact contract'
);

select ok(
  exists (
    select 1
    from pg_proc
    where oid = to_regprocedure('public.finalize_storage_upload(text,text,uuid,public.media_type,text,text)')
      and prosecdef = false
      and proconfig = array['search_path=""']::text[]
  ),
  'finalization RPC is security invoker with an empty search_path'
);

select ok(
  exists (
    select 1
    from pg_proc
    where oid = to_regprocedure('public.finalize_storage_upload(text,text,uuid,public.media_type,text,text)')
      and obj_description(oid, 'pg_proc') like '%Task 8%actual bytes%orphan%'
  ),
  'RPC contract documents Task 8 byte inspection and orphan cleanup'
);

select ok(
  exists (
    select 1
    from pg_proc
    where oid = to_regprocedure('public.finalize_storage_upload(text,text,uuid,public.media_type,text,text)')
      and has_function_privilege('service_role', oid, 'execute')
  ),
  'service_role alone can execute the finalization RPC'
);

select ok(
  not exists (
    select 1
    from pg_proc
    where oid = to_regprocedure('public.finalize_storage_upload(text,text,uuid,public.media_type,text,text)')
      and (
        has_function_privilege('authenticated', oid, 'execute')
        or has_function_privilege('anon', oid, 'execute')
        or exists (
          select 1
          from information_schema.routine_privileges rp
          where rp.specific_schema = 'public'
            and rp.routine_name = 'finalize_storage_upload'
            and rp.grantee = 'PUBLIC'
            and rp.privilege_type = 'EXECUTE'
        )
      )
  ),
  'public, anon, and authenticated cannot execute metadata finalization'
);

select ok(
  not pg_has_role('anon', 'service_role', 'member')
  and not pg_has_role('authenticated', 'service_role', 'member'),
  'anon and authenticated cannot inherit the service_role RLS bypass'
);

select ok(
  not has_table_privilege('authenticated', 'public.request_media', 'insert')
  and not has_table_privilege('authenticated', 'public.request_media', 'delete')
  and not has_table_privilege('authenticated', 'public.professional_documents', 'insert')
  and not has_table_privilege('authenticated', 'public.professional_documents', 'delete')
  and not has_table_privilege('authenticated', 'public.job_media', 'insert')
  and not has_table_privilege('authenticated', 'public.job_media', 'delete'),
  'authenticated cannot forge or delete finalized metadata directly'
);

select ok(
  has_column_privilege('service_role', 'public.request_media', 'storage_path', 'insert')
  and has_column_privilege('service_role', 'public.professional_documents', 'storage_path', 'insert')
  and has_column_privilege('service_role', 'public.job_media', 'storage_path', 'insert')
  and not has_column_privilege('service_role', 'public.professional_documents', 'status', 'insert'),
  'service_role receives only the metadata columns required by finalization'
);

-- Keep runtime authorization fixtures executable on the RED baseline even
-- when the managed buckets themselves do not exist yet. Configuration was
-- asserted above before this transaction-local setup.
insert into storage.buckets (id, name, public)
values
  ('request-media', 'request-media', false),
  ('professional-documents', 'professional-documents', false),
  ('equipment-media', 'equipment-media', false),
  ('job-evidence', 'job-evidence', false),
  ('public-avatars', 'public-avatars', true)
on conflict (id) do nothing;

-- Keep deterministic legacy fixture IDs; signup itself has a dedicated regression suite.
alter table auth.users disable trigger lysto_signup_customer_profile;
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'storage-customer-a@lysto.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'storage-customer-b@lysto.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'storage-professional-a@lysto.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'storage-professional-b@lysto.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'storage-professional-pending@lysto.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'storage-professional-unassigned@lysto.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'storage-operations@lysto.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'storage-quality@lysto.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'storage-finance@lysto.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'storage-owner@lysto.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'storage-no-profile@lysto.test', '', now(), '{}', '{}', now(), now());

alter table auth.users enable trigger lysto_signup_customer_profile;

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

insert into storage.objects (bucket_id, name, owner_id)
select fixture.bucket_id, fixture.name, fixture.owner_id
from (
  values
    ('request-media'::text, '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/80000000-0000-0000-0000-000000000001.jpg'::text, '10000000-0000-0000-0000-000000000001'::text),
    ('request-media', '10000000-0000-0000-0000-000000000002/50000000-0000-0000-0000-000000000002/photo/80000000-0000-0000-0000-000000000002.jpg', '10000000-0000-0000-0000-000000000002'),
    ('professional-documents', '20000000-0000-0000-0000-000000000001/22000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000003.pdf', '20000000-0000-0000-0000-000000000001'),
    ('professional-documents', '20000000-0000-0000-0000-000000000002/22000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000004.pdf', '20000000-0000-0000-0000-000000000002'),
    ('equipment-media', '10000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000005.webp', '10000000-0000-0000-0000-000000000001'),
    ('equipment-media', '10000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000003/80000000-0000-0000-0000-000000000017.webp', '10000000-0000-0000-0000-000000000001'),
    ('equipment-media', '10000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000006.webp', '10000000-0000-0000-0000-000000000002'),
    ('equipment-media', '60000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000007.jpg', '20000000-0000-0000-0000-000000000001'),
    ('equipment-media', '60000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000008.jpg', '20000000-0000-0000-0000-000000000002'),
    ('job-evidence', '60000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/before/80000000-0000-0000-0000-000000000009.jpg', '20000000-0000-0000-0000-000000000001'),
    ('job-evidence', '60000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/before/80000000-0000-0000-0000-000000000010.jpg', '20000000-0000-0000-0000-000000000002'),
    ('public-avatars', '10000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000011.png', '10000000-0000-0000-0000-000000000001'),
    ('public-avatars', '10000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000012.png', '10000000-0000-0000-0000-000000000002'),
    ('request-media', 'not-a-uuid/50000000-0000-0000-0000-000000000001/photo/80000000-0000-0000-0000-000000000013.jpg', 'not-a-uuid'),
    ('professional-documents', 'not-a-uuid/22000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000014.pdf', 'not-a-uuid'),
    ('equipment-media', 'not-a-uuid/70000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000015.jpg', 'not-a-uuid'),
    ('job-evidence', '60000000-0000-0000-0000-000000000001/not-a-uuid/before/80000000-0000-0000-0000-000000000016.jpg', 'not-a-uuid')
) as fixture(bucket_id, name, owner_id)
where exists (select 1 from storage.buckets b where b.id = fixture.bucket_id);

select pg_temp.set_jwt('10000000-0000-0000-0000-000000000001', 'customer');
select pg_temp.set_storage_operation('storage.object.sign');
set local role authenticated;

select results_eq(
  $$select bucket_id, name from storage.objects order by bucket_id, name$$,
  $$values
    ('equipment-media'::text, '10000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000005.webp'::text),
    ('equipment-media', '10000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000003/80000000-0000-0000-0000-000000000017.webp'),
    ('equipment-media', '60000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000007.jpg'),
    ('job-evidence', '60000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/before/80000000-0000-0000-0000-000000000009.jpg'),
    ('request-media', '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/80000000-0000-0000-0000-000000000001.jpg')
  $$,
  'customer can sign only their request, job evidence, and owned equipment media'
);

reset role;
select pg_temp.set_jwt('20000000-0000-0000-0000-000000000001', 'professional');
select pg_temp.set_storage_operation('storage.object.sign_many');
set local role authenticated;

select results_eq(
  $$select bucket_id, name from storage.objects order by bucket_id, name$$,
  $$values
    ('equipment-media'::text, '10000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000005.webp'::text),
    ('equipment-media', '60000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000007.jpg'),
    ('job-evidence', '60000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/before/80000000-0000-0000-0000-000000000009.jpg'),
    ('professional-documents', '20000000-0000-0000-0000-000000000001/22000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000003.pdf'),
    ('request-media', '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/80000000-0000-0000-0000-000000000001.jpg')
  $$,
  'approved professional can sign their document plus assigned request, exact equipment, and job media'
);

reset role;
select pg_temp.set_jwt('30000000-0000-0000-0000-000000000001', 'admin');
select pg_temp.set_storage_operation('storage.object.sign');
set local role authenticated;

select results_eq(
  $$select bucket_id, name from storage.objects order by bucket_id, name$$,
  $$values
    ('equipment-media'::text, '10000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000005.webp'::text),
    ('equipment-media', '10000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000003/80000000-0000-0000-0000-000000000017.webp'),
    ('equipment-media', '10000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000006.webp'),
    ('equipment-media', '60000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000007.jpg'),
    ('equipment-media', '60000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000008.jpg'),
    ('job-evidence', '60000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/before/80000000-0000-0000-0000-000000000009.jpg'),
    ('job-evidence', '60000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/before/80000000-0000-0000-0000-000000000010.jpg'),
    ('professional-documents', '20000000-0000-0000-0000-000000000001/22000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000003.pdf'),
    ('professional-documents', '20000000-0000-0000-0000-000000000002/22000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000004.pdf'),
    ('request-media', '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/80000000-0000-0000-0000-000000000001.jpg'),
    ('request-media', '10000000-0000-0000-0000-000000000002/50000000-0000-0000-0000-000000000002/photo/80000000-0000-0000-0000-000000000002.jpg')
  $$,
  'operations admin can sign all valid private managed objects'
);

reset role;
select pg_temp.set_jwt('30000000-0000-0000-0000-000000000002', 'admin');
select pg_temp.set_storage_operation('storage.object.sign');
set local role authenticated;

select results_eq(
  $$select bucket_id, name from storage.objects order by bucket_id, name$$,
  $$values
    ('equipment-media'::text, '10000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000005.webp'::text),
    ('equipment-media', '10000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000003/80000000-0000-0000-0000-000000000017.webp'),
    ('equipment-media', '10000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000006.webp'),
    ('equipment-media', '60000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000007.jpg'),
    ('equipment-media', '60000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000008.jpg'),
    ('job-evidence', '60000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/before/80000000-0000-0000-0000-000000000009.jpg'),
    ('job-evidence', '60000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/before/80000000-0000-0000-0000-000000000010.jpg'),
    ('request-media', '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/80000000-0000-0000-0000-000000000001.jpg'),
    ('request-media', '10000000-0000-0000-0000-000000000002/50000000-0000-0000-0000-000000000002/photo/80000000-0000-0000-0000-000000000002.jpg')
  $$,
  'quality admin can sign request, exact equipment, and job evidence but no professional documents'
);

reset role;
select pg_temp.set_jwt('30000000-0000-0000-0000-000000000003', 'admin');
select pg_temp.set_storage_operation('storage.object.sign');
set local role authenticated;

select results_eq(
  $$select bucket_id, name from storage.objects order by bucket_id, name$$,
  $$select null::text, null::text where false$$,
  'finance admin cannot sign any customer or professional storage object'
);

reset role;
select pg_temp.set_jwt('30000000-0000-0000-0000-000000000004', 'admin');
select pg_temp.set_storage_operation('storage.object.sign');
set local role authenticated;

select results_eq(
  $$select bucket_id, name from storage.objects order by bucket_id, name$$,
  $$values
    ('equipment-media'::text, '10000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000005.webp'::text),
    ('equipment-media', '10000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000003/80000000-0000-0000-0000-000000000017.webp'),
    ('equipment-media', '10000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000006.webp'),
    ('equipment-media', '60000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000007.jpg'),
    ('equipment-media', '60000000-0000-0000-0000-000000000002/70000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000008.jpg'),
    ('job-evidence', '60000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/before/80000000-0000-0000-0000-000000000009.jpg'),
    ('job-evidence', '60000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/before/80000000-0000-0000-0000-000000000010.jpg'),
    ('professional-documents', '20000000-0000-0000-0000-000000000001/22000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000003.pdf'),
    ('professional-documents', '20000000-0000-0000-0000-000000000002/22000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000004.pdf'),
    ('request-media', '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/80000000-0000-0000-0000-000000000001.jpg'),
    ('request-media', '10000000-0000-0000-0000-000000000002/50000000-0000-0000-0000-000000000002/photo/80000000-0000-0000-0000-000000000002.jpg')
  $$,
  'owner admin can sign every valid private managed object'
);

reset role;
select pg_temp.set_jwt('90000000-0000-0000-0000-000000000001', 'customer');
select pg_temp.set_storage_operation('storage.object.sign');
set local role authenticated;

select is(
  (select count(*) from storage.objects),
  0::bigint,
  'authenticated user without an application profile cannot sign objects'
);

reset role;
select pg_temp.set_jwt('20000000-0000-0000-0000-000000000003', 'professional');
select pg_temp.set_storage_operation('storage.object.sign');
set local role authenticated;

select is(
  (select count(*) from storage.objects),
  0::bigint,
  'non-approved professional cannot sign assigned-customer objects'
);

reset role;
select pg_temp.set_jwt('20000000-0000-0000-0000-000000000004', 'professional');
select pg_temp.set_storage_operation('storage.object.sign');
set local role authenticated;

select is(
  (select count(*) from storage.objects),
  0::bigint,
  'approved but unassigned professional cannot sign customer objects'
);

reset role;
select pg_temp.set_jwt('10000000-0000-0000-0000-000000000001', 'customer');
select pg_temp.set_storage_operation('storage.object.list');
set local role authenticated;

select is((select count(*) from storage.objects), 0::bigint, 'customer cannot list objects');

reset role;
select pg_temp.set_storage_operation('');
set local role authenticated;

select is((select count(*) from storage.objects), 0::bigint, 'private SELECT is denied without an explicit sign operation');

reset role;
select set_config('request.jwt.claims', '{}'::text, true);
select pg_temp.set_storage_operation('storage.object.sign');
set local role anon;

select is((select count(*) from storage.objects), 0::bigint, 'anonymous callers cannot sign private objects');

reset role;
set local role service_role;

select pg_temp.set_storage_operation('storage.object.sign_upload_url');
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'request-media',
    'service-role-matrix/sign-upload-url/85000000-0000-0000-0000-000000000001.jpg',
    '90000000-0000-0000-0000-000000000001'
  )$$,
  'service_role can reserve a signed-upload path without an authenticated policy'
);

select pg_temp.set_storage_operation('storage.object.upload_signed');
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'request-media',
    'service-role-matrix/upload-signed/85000000-0000-0000-0000-000000000002.jpg',
    '90000000-0000-0000-0000-000000000001'
  )$$,
  'service_role can perform signed-token upload insertion'
);

select pg_temp.set_storage_operation('storage.object.upload');
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'request-media',
    'service-role-matrix/upload/85000000-0000-0000-0000-000000000003.jpg',
    '90000000-0000-0000-0000-000000000001'
  )$$,
  'service_role can perform trusted direct upload insertion'
);

select pg_temp.set_storage_operation('storage.object.sign');
select results_eq(
  $$select bucket_id, name from storage.objects
    where name like 'service-role-matrix/%' order by bucket_id, name$$,
  $$values
    ('request-media'::text, 'service-role-matrix/sign-upload-url/85000000-0000-0000-0000-000000000001.jpg'::text),
    ('request-media', 'service-role-matrix/upload/85000000-0000-0000-0000-000000000003.jpg'),
    ('request-media', 'service-role-matrix/upload-signed/85000000-0000-0000-0000-000000000002.jpg')$$,
  'service_role can sign every trusted object regardless of authenticated SELECT policies'
);

select pg_temp.set_storage_operation('storage.object.list');
select results_eq(
  $$select bucket_id, name from storage.objects
    where name like 'service-role-matrix/%' order by bucket_id, name$$,
  $$values
    ('request-media'::text, 'service-role-matrix/sign-upload-url/85000000-0000-0000-0000-000000000001.jpg'::text),
    ('request-media', 'service-role-matrix/upload/85000000-0000-0000-0000-000000000003.jpg'),
    ('request-media', 'service-role-matrix/upload-signed/85000000-0000-0000-0000-000000000002.jpg')$$,
  'service_role can list trusted objects through its RLS bypass'
);

select pg_temp.set_storage_operation('storage.object.get_authenticated');
select results_eq(
  $$select bucket_id, name from storage.objects
    where name like 'service-role-matrix/%' order by bucket_id, name$$,
  $$values
    ('request-media'::text, 'service-role-matrix/sign-upload-url/85000000-0000-0000-0000-000000000001.jpg'::text),
    ('request-media', 'service-role-matrix/upload/85000000-0000-0000-0000-000000000003.jpg'),
    ('request-media', 'service-role-matrix/upload-signed/85000000-0000-0000-0000-000000000002.jpg')$$,
  'service_role can read trusted objects directly'
);

select pg_temp.set_storage_operation('storage.object.update');
select lives_ok(
  $$update storage.objects set metadata = '{"matrix":"update"}'::jsonb
    where bucket_id = 'request-media'
      and name = 'service-role-matrix/upload/85000000-0000-0000-0000-000000000003.jpg'$$,
  'service_role can update a trusted storage object'
);
select is(
  (select metadata ->> 'matrix' from storage.objects
   where bucket_id = 'request-media'
     and name = 'service-role-matrix/upload/85000000-0000-0000-0000-000000000003.jpg'),
  'update',
  'service_role update changes only the targeted object'
);

select pg_temp.set_storage_operation('storage.object.upload');
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata) values (
      'request-media',
      'service-role-matrix/upload/85000000-0000-0000-0000-000000000003.jpg',
      '90000000-0000-0000-0000-000000000001',
      '{"matrix":"upsert"}'::jsonb
    ) on conflict (bucket_id, name) do update set metadata = excluded.metadata$$,
  'service_role can upsert a trusted storage object'
);
select is(
  (select metadata ->> 'matrix' from storage.objects
   where bucket_id = 'request-media'
     and name = 'service-role-matrix/upload/85000000-0000-0000-0000-000000000003.jpg'),
  'upsert',
  'service_role upsert replaces only the targeted object'
);

select pg_temp.set_storage_operation('storage.object.delete');
select set_config('storage.allow_delete_query', 'true', true);
select lives_ok(
  $$delete from storage.objects where name like 'service-role-matrix/%'$$,
  'service_role can delete trusted objects when the Storage API deletion guard is set'
);
select set_config('storage.allow_delete_query', 'false', true);
select is(
  (select count(*) from storage.objects where name like 'service-role-matrix/%'),
  0::bigint,
  'service_role deletion removes the exact trusted object set'
);

reset role;
select pg_temp.set_jwt('10000000-0000-0000-0000-000000000001', 'customer');
select pg_temp.set_storage_operation('storage.object.upload');
set local role authenticated;

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/81000000-0000-0000-0000-000000000001.jpg',
    '10000000-0000-0000-0000-000000000001'
  )$$,
  '42501', null,
  'direct authenticated upload is denied even for a valid request-media path'
);

select pg_temp.set_storage_operation('storage.object.sign_upload_url');

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/81000000-0000-0000-0000-000000000010.jpg',
    '10000000-0000-0000-0000-000000000001'
  )$$,
  'customer can reserve an immutable request-media path through signed upload only'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000002/photo/81000000-0000-0000-0000-000000000002.jpg',
    '10000000-0000-0000-0000-000000000001'
  )$$,
  '42501', null,
  'customer cannot upload into another request'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/81000000-0000-0000-0000-000000000003.jpg',
    '10000000-0000-0000-0000-000000000002'
  )$$,
  '42501', null,
  'upload owner_id cannot differ from auth.uid()'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/original-name.jpg',
    '10000000-0000-0000-0000-000000000001'
  )$$,
  '42501', null,
  'request media filename must be a canonical UUID'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'equipment-media',
    '10000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/81000000-0000-0000-0000-000000000004.webp',
    '10000000-0000-0000-0000-000000000001'
  )$$,
  'customer can upload media for their equipment'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'equipment-media',
    '10000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000002/81000000-0000-0000-0000-000000000005.webp',
    '10000000-0000-0000-0000-000000000001'
  )$$,
  '42501', null,
  'customer cannot upload media for another customer equipment'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'public-avatars',
    '10000000-0000-0000-0000-000000000001/81000000-0000-0000-0000-000000000006.png',
    '10000000-0000-0000-0000-000000000001'
  )$$,
  'authenticated user can upload an immutable avatar under their auth uid'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'public-avatars',
    '10000000-0000-0000-0000-000000000002/81000000-0000-0000-0000-000000000007.png',
    '10000000-0000-0000-0000-000000000001'
  )$$,
  '42501', null,
  'user cannot upload an avatar under another auth uid'
);

reset role;
select pg_temp.set_jwt('90000000-0000-0000-0000-000000000001', 'customer');
select pg_temp.set_storage_operation('storage.object.sign_upload_url');
set local role authenticated;

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'public-avatars',
    '90000000-0000-0000-0000-000000000001/81000000-0000-0000-0000-000000000011.png',
    '90000000-0000-0000-0000-000000000001'
  )$$,
  '42501', null,
  'authenticated user without a profile cannot reserve an avatar path'
);

reset role;
select pg_temp.set_jwt('10000000-0000-0000-0000-000000000001', 'customer');
select pg_temp.set_storage_operation('storage.object.sign_upload_url');
set local role authenticated;

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'professional-documents',
    '10000000-0000-0000-0000-000000000001/22000000-0000-0000-0000-000000000001/81000000-0000-0000-0000-000000000008.pdf',
    '10000000-0000-0000-0000-000000000001'
  )$$,
  '42501', null,
  'customer cannot upload professional documents'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'job-evidence',
    '60000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000001/before/81000000-0000-0000-0000-000000000009.jpg',
    '10000000-0000-0000-0000-000000000001'
  )$$,
  '42501', null,
  'customer cannot upload professional job evidence'
);

reset role;
select pg_temp.set_jwt('20000000-0000-0000-0000-000000000001', 'professional');
select pg_temp.set_storage_operation('storage.object.sign_upload_url');
set local role authenticated;

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'professional-documents',
    '20000000-0000-0000-0000-000000000001/22000000-0000-0000-0000-000000000001/82000000-0000-0000-0000-000000000001.pdf',
    '20000000-0000-0000-0000-000000000001'
  )$$,
  'professional can reserve their own immutable document path'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'professional-documents',
    '20000000-0000-0000-0000-000000000001/22000000-0000-0000-0000-000000000002/82000000-0000-0000-0000-000000000002.pdf',
    '20000000-0000-0000-0000-000000000001'
  )$$,
  '42501', null,
  'professional cannot upload a document for another profile'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'equipment-media',
    '60000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/82000000-0000-0000-0000-000000000003.jpg',
    '20000000-0000-0000-0000-000000000001'
  )$$,
  'assigned professional can reserve equipment media for the request exact equipment'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'equipment-media',
    '60000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000001/82000000-0000-0000-0000-000000000004.jpg',
    '20000000-0000-0000-0000-000000000001'
  )$$,
  '42501', null,
  'professional equipment upload must match the job customer equipment'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'equipment-media',
    '60000000-0000-0000-0000-000000000001/70000000-0000-0000-0000-000000000003/20000000-0000-0000-0000-000000000001/82000000-0000-0000-0000-000000000014.jpg',
    '20000000-0000-0000-0000-000000000001'
  )$$,
  '42501', null,
  'professional cannot reserve media for a same-customer equipment not linked to the request'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'job-evidence',
    '60000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/during/82000000-0000-0000-0000-000000000005.jpg',
    '20000000-0000-0000-0000-000000000001'
  )$$,
  'assigned professional can reserve immutable evidence for their job'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'job-evidence',
    '60000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000001/during/82000000-0000-0000-0000-000000000006.jpg',
    '20000000-0000-0000-0000-000000000001'
  )$$,
  '42501', null,
  'professional cannot upload evidence for another assignment'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'job-evidence',
    '60000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/private/82000000-0000-0000-0000-000000000007.jpg',
    '20000000-0000-0000-0000-000000000001'
  )$$,
  '42501', null,
  'job evidence phase must be before, during, after, or document'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values (
    'request-media',
    '20000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/82000000-0000-0000-0000-000000000008.jpg',
    '20000000-0000-0000-0000-000000000001'
  )$$,
  '42501', null,
  'assigned professional cannot upload customer request media'
);

reset role;

select pg_temp.set_jwt('10000000-0000-0000-0000-000000000001', 'customer');
select pg_temp.set_storage_operation('storage.object.update');
set local role authenticated;

select results_eq(
  $$
    update storage.objects
    set metadata = '{"mimetype":"image/png","size":1}'::jsonb
    where bucket_id = 'request-media'
      and name = '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/81000000-0000-0000-0000-000000000010.jpg'
    returning 1
  $$,
  $$select 1 where false$$,
  'authenticated callers cannot update or replace a reserved storage object'
);

select pg_temp.set_storage_operation('storage.object.delete');

select throws_ok(
  $$delete from storage.objects
    where bucket_id = 'request-media'
      and name = '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/81000000-0000-0000-0000-000000000010.jpg'$$,
  '42501', null,
  'authenticated callers cannot delete storage objects'
);

select pg_temp.set_storage_operation('storage.object.sign_upload_url');

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'request-media',
      '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/81000000-0000-0000-0000-000000000010.jpg',
      '10000000-0000-0000-0000-000000000001',
      '{"mimetype":"image/jpeg","size":1}'::jsonb
    )
    on conflict (bucket_id, name) do update set metadata = excluded.metadata
  $$,
  '42501', null,
  'signed-upload reservation cannot be escalated into an upsert replacement'
);

reset role;

select throws_ok(
  $$insert into public.request_media (request_id, media_type, storage_bucket, storage_path) values (
    '50000000-0000-0000-0000-000000000001', 'photo', 'job-evidence', 'invalid'
  )$$,
  '23514', null,
  'request_media metadata rejects a non-canonical bucket'
);

select throws_ok(
  $$insert into public.professional_documents (professional_id, document_type, storage_bucket, storage_path) values (
    '22000000-0000-0000-0000-000000000001', 'dni', 'request-media', 'invalid'
  )$$,
  '23514', null,
  'professional_documents metadata rejects a non-canonical bucket'
);

select throws_ok(
  $$insert into public.job_media (job_id, media_type, phase, storage_bucket, storage_path) values (
    '60000000-0000-0000-0000-000000000001', 'photo', 'before', 'request-media', 'invalid'
  )$$,
  '23514', null,
  'job_media metadata rejects buckets outside job-evidence'
);

select throws_ok(
  $$insert into public.job_media (job_id, media_type, phase, storage_bucket, storage_path) values (
    '60000000-0000-0000-0000-000000000001',
    'photo',
    'before',
    'job-media',
    '60000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/before/83000000-0000-0000-0000-000000000001.jpg'
  )$$,
  '23514', null,
  'job_media rejects the removed legacy job-media bucket'
);

insert into storage.objects (bucket_id, name, owner_id, metadata)
values
  (
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000001.jpg',
    '10000000-0000-0000-0000-000000000001',
    '{"mimetype":"image/jpeg","size":1024}'
  ),
  (
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000002.jpg',
    '10000000-0000-0000-0000-000000000001',
    '{"mimetype":"image/png","size":1024}'
  ),
  (
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000003.jpg',
    '10000000-0000-0000-0000-000000000001',
    '{"mimetype":"image/jpeg","size":10485761}'
  ),
  (
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/video/84000000-0000-0000-0000-000000000004.mp4',
    '10000000-0000-0000-0000-000000000001',
    '{"mimetype":"video/mp4","size":31457281}'
  ),
  (
    'professional-documents',
    '20000000-0000-0000-0000-000000000001/22000000-0000-0000-0000-000000000001/84000000-0000-0000-0000-000000000005.pdf',
    '20000000-0000-0000-0000-000000000001',
    '{"mimetype":"application/pdf","size":2048}'
  ),
  (
    'job-evidence',
    '60000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/before/84000000-0000-0000-0000-000000000006.jpg',
    '20000000-0000-0000-0000-000000000001',
    '{"mimetype":"image/jpeg","size":4096}'
  ),
  (
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000007.jpg',
    '10000000-0000-0000-0000-000000000002',
    '{"mimetype":"image/jpeg","size":1024}'
  ),
  (
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000008.jpg',
    '10000000-0000-0000-0000-000000000001',
    '{"mimetype":"image/jpeg"}'
  ),
  (
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000009.jpg',
    '10000000-0000-0000-0000-000000000001',
    '{"mimetype":"image/jpeg","size":"not-a-number"}'
  ),
  (
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000010.jpg',
    '10000000-0000-0000-0000-000000000001',
    '{"mimetype":"image/jpeg","size":0}'
  ),
  (
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000011.jpg',
    '10000000-0000-0000-0000-000000000001',
    '{"size":1024}'
  ),
  (
    'professional-documents',
    '20000000-0000-0000-0000-000000000001/22000000-0000-0000-0000-000000000001/84000000-0000-0000-0000-000000000012.pdf',
    '20000000-0000-0000-0000-000000000001',
    '{"mimetype":"application/pdf","size":10485761}'
  ),
  (
    'professional-documents',
    '20000000-0000-0000-0000-000000000001/22000000-0000-0000-0000-000000000001/84000000-0000-0000-0000-000000000013.pdf',
    '20000000-0000-0000-0000-000000000002',
    '{"mimetype":"application/pdf","size":1024}'
  ),
  (
    'job-evidence',
    '60000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/before/84000000-0000-0000-0000-000000000014.jpg',
    '20000000-0000-0000-0000-000000000001',
    '{"mimetype":"image/jpeg","size":20971521}'
  ),
  (
    'job-evidence',
    '60000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/before/84000000-0000-0000-0000-000000000015.jpg',
    '20000000-0000-0000-0000-000000000002',
    '{"mimetype":"image/jpeg","size":1024}'
  ),
  (
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000016.jpg',
    '10000000-0000-0000-0000-000000000001',
    '{"mimetype":"image/jpeg","size":1024}'
  );

insert into public.request_media (
  request_id, media_type, storage_bucket, storage_path, uploaded_by
)
values
  (
    '50000000-0000-0000-0000-000000000001',
    'photo',
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000099.jpg',
    '11000000-0000-0000-0000-000000000001'
  ),
  (
    '50000000-0000-0000-0000-000000000001',
    'video',
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000016.jpg',
    '11000000-0000-0000-0000-000000000001'
  );

select pg_temp.set_jwt('10000000-0000-0000-0000-000000000001', 'customer');
set local role authenticated;

select throws_ok(
  $$insert into public.request_media (
      request_id, media_type, storage_bucket, storage_path, uploaded_by
    ) values (
      '50000000-0000-0000-0000-000000000001',
      'photo',
      'request-media',
      '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000098.jpg',
      '11000000-0000-0000-0000-000000000001'
    )$$,
  '42501', null,
  'authenticated cannot insert finalized request metadata directly'
);

select throws_ok(
  $$delete from public.request_media
    where storage_path = '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000099.jpg'$$,
  '42501', null,
  'authenticated cannot delete finalized request metadata directly'
);

select throws_ok(
  $$select public.finalize_storage_upload(
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000001.jpg',
    '50000000-0000-0000-0000-000000000001',
    'photo', null, null
  )$$,
  '42501', null,
  'authenticated cannot invoke service-only metadata finalization'
);

reset role;
set local role service_role;

select lives_ok(
  $$select public.finalize_storage_upload(
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000001.jpg',
    '50000000-0000-0000-0000-000000000001',
    'photo', null, null
  )$$,
  'service_role finalizes a valid request photo after Storage reports its metadata'
);

select lives_ok(
  $$select public.finalize_storage_upload(
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000001.jpg',
    '50000000-0000-0000-0000-000000000001',
    'photo', null, null
  )$$,
  'repeating metadata finalization for the same immutable path succeeds'
);

reset role;

select is(
  (
    select count(*) from public.request_media
    where storage_bucket = 'request-media'
      and storage_path = '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000001.jpg'
  ),
  1::bigint,
  'metadata finalization is idempotent for the immutable storage path'
);

set local role service_role;

select lives_ok(
  $$select public.finalize_storage_upload(
    'professional-documents',
    '20000000-0000-0000-0000-000000000001/22000000-0000-0000-0000-000000000001/84000000-0000-0000-0000-000000000005.pdf',
    '22000000-0000-0000-0000-000000000001',
    null, null, 'identity'
  )$$,
  'service_role finalizes a valid professional document'
);

select lives_ok(
  $$select public.finalize_storage_upload(
    'job-evidence',
    '60000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/before/84000000-0000-0000-0000-000000000006.jpg',
    '60000000-0000-0000-0000-000000000001',
    'photo', 'before', null
  )$$,
  'service_role finalizes valid evidence from the assigned approved professional'
);

select throws_ok(
  $$select public.finalize_storage_upload(
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000002.jpg',
    '50000000-0000-0000-0000-000000000001',
    'photo', null, null
  )$$,
  'P0001', null,
  'finalization rejects Storage MIME that disagrees with the extension'
);

select throws_ok(
  $$select public.finalize_storage_upload(
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000003.jpg',
    '50000000-0000-0000-0000-000000000001',
    'photo', null, null
  )$$,
  'P0001', null,
  'finalization rejects a request photo larger than 10 MiB'
);

select throws_ok(
  $$select public.finalize_storage_upload(
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/video/84000000-0000-0000-0000-000000000004.mp4',
    '50000000-0000-0000-0000-000000000001',
    'video', null, null
  )$$,
  'P0001', null,
  'finalization rejects a request video larger than 30 MiB'
);

select throws_ok(
  $$select public.finalize_storage_upload(
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000001.jpg',
    '50000000-0000-0000-0000-000000000002',
    'photo', null, null
  )$$,
  'P0001', null,
  'finalization rejects an entity id that disagrees with the immutable path'
);

select throws_ok(
  $$select public.finalize_storage_upload(
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000007.jpg',
    '50000000-0000-0000-0000-000000000001',
    'photo', null, null
  )$$,
  'P0001', null,
  'finalization rejects a valid UUID owner_id that disagrees with the path owner'
);

select throws_ok(
  $$select public.finalize_storage_upload(
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000008.jpg',
    '50000000-0000-0000-0000-000000000001',
    'photo', null, null
  )$$,
  'P0001', null,
  'finalization rejects Storage metadata without size'
);

select throws_ok(
  $$select public.finalize_storage_upload(
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000009.jpg',
    '50000000-0000-0000-0000-000000000001',
    'photo', null, null
  )$$,
  'P0001', null,
  'finalization rejects a non-numeric Storage size'
);

select throws_ok(
  $$select public.finalize_storage_upload(
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000010.jpg',
    '50000000-0000-0000-0000-000000000001',
    'photo', null, null
  )$$,
  'P0001', null,
  'finalization rejects a zero-byte Storage object'
);

select throws_ok(
  $$select public.finalize_storage_upload(
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000011.jpg',
    '50000000-0000-0000-0000-000000000001',
    'photo', null, null
  )$$,
  'P0001', null,
  'finalization rejects Storage metadata without MIME'
);

select throws_ok(
  $$select public.finalize_storage_upload(
    'professional-documents',
    '20000000-0000-0000-0000-000000000001/22000000-0000-0000-0000-000000000001/84000000-0000-0000-0000-000000000012.pdf',
    '22000000-0000-0000-0000-000000000001',
    null, null, 'identity'
  )$$,
  'P0001', null,
  'finalization rejects a professional document larger than 10 MiB'
);

select throws_ok(
  $$select public.finalize_storage_upload(
    'professional-documents',
    '20000000-0000-0000-0000-000000000001/22000000-0000-0000-0000-000000000001/84000000-0000-0000-0000-000000000013.pdf',
    '22000000-0000-0000-0000-000000000001',
    null, null, 'identity'
  )$$,
  'P0001', null,
  'finalization rejects a professional document with the wrong valid owner_id'
);

select throws_ok(
  $$select public.finalize_storage_upload(
    'job-evidence',
    '60000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/before/84000000-0000-0000-0000-000000000014.jpg',
    '60000000-0000-0000-0000-000000000001',
    'photo', 'before', null
  )$$,
  'P0001', null,
  'finalization rejects job evidence larger than 20 MiB'
);

select throws_ok(
  $$select public.finalize_storage_upload(
    'job-evidence',
    '60000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/before/84000000-0000-0000-0000-000000000015.jpg',
    '60000000-0000-0000-0000-000000000001',
    'photo', 'before', null
  )$$,
  'P0001', null,
  'finalization rejects job evidence with the wrong valid owner_id'
);

select throws_ok(
  $$select public.finalize_storage_upload(
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000016.jpg',
    '50000000-0000-0000-0000-000000000001',
    'photo', null, null
  )$$,
  'P0001', null,
  'idempotent finalization rejects an existing path with different metadata'
);

select throws_ok(
  $$select public.finalize_storage_upload(
    'request-media',
    '10000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001/photo/84000000-0000-0000-0000-000000000404.jpg',
    '50000000-0000-0000-0000-000000000001',
    'photo', null, null
  )$$,
  'P0001', null,
  'finalization rejects a missing Storage object'
);

reset role;

select * from finish();
rollback;

