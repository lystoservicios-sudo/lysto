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


select has_table('private', 'upload_intents', 'upload intents are persisted privately');
select has_table('private', 'request_upload_drafts', 'pre-request uploads have owned persistent drafts');
select has_function('public', 'create_upload_intent', array['text','text','bigint','text','uuid','uuid','text','text'], 'intent creation derives the actor from Auth');
select has_function('public', 'get_upload_intent', array['uuid'], 'intent reads use current entity access');
select has_function('public', 'finalize_verified_upload', array['uuid','uuid','text','bigint','text','bigint','text','uuid'], 'verified finalization has an explicit trusted server actor');
select has_function('public', 'claim_expired_upload_intents', array['integer'], 'cleanup leases expired unverified intents');
select has_function('public', 'complete_upload_cleanup', array['uuid','uuid'], 'cleanup is confirmed after Storage removal');
select ok(exists(select 1 from storage.buckets where id='upload-quarantine' and not public), 'raw bytes remain in a private quarantine bucket');
select ok(not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname in ('lysto_storage_request_media_insert','lysto_storage_professional_documents_insert','lysto_storage_job_evidence_insert','lysto_storage_equipment_media_insert')), 'legacy direct uploads cannot bypass quarantine');
select ok(not coalesce(has_function_privilege('service_role', to_regprocedure('public.finalize_storage_upload(text,text,uuid,public.media_type,text,text)'), 'EXECUTE'), false), 'uninspected legacy finalization is retired');

create temp table t10_uploads(label text primary key, data jsonb not null);
grant select,insert,update on t10_uploads to authenticated,service_role;
create function pg_temp.actor(p_user uuid,p_role text) returns void language sql as $$ select pg_temp.fixture_set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated','app_metadata',jsonb_build_object('app_role',p_role))::text,true)::text; $$;
select pg_temp.actor('10000000-0000-0000-0000-000000000001','customer');
set local role authenticated;
insert into t10_uploads values('draft',public.create_upload_intent('request-photo','image/png',102,repeat('a',64),null,null,null,null));
select is((select data->>'ownerProfileId' from t10_uploads where label='draft'),'11000000-0000-0000-0000-000000000001','owner is derived from the current Auth identity');
select ok((select data->>'draftId' is not null and data->>'entityId' is null from t10_uploads where label='draft'),'requestless upload has a persistent draft');
select is((select data->>'status' from t10_uploads where label='draft'),'pending','a declaration is not evidence');
select is(public.get_upload_intent((select (data->>'id')::uuid from t10_uploads where label='draft'))->>'status','pending','owner can resume a pending intent');
select throws_ok($$select public.create_upload_intent('request-photo','image/png',0,repeat('a',64),null,null,null,null)$$,'22023','Invalid upload declaration','empty files rejected');
select throws_ok($$select public.create_upload_intent('request-photo','image/png',10485761,repeat('a',64),null,null,null,null)$$,'22023','Invalid upload declaration','oversized photos rejected');
select throws_ok($$select public.create_upload_intent('request-video','video/mp4',100,repeat('a',64),null,null,null,null)$$,'22023','Invalid upload declaration','uninspected video rejected');
select throws_ok($$select public.create_upload_intent('request-photo','application/pdf',100,repeat('a',64),null,null,null,null)$$,'22023','Invalid upload declaration','uninspected PDF rejected');
select throws_ok($$select public.create_upload_intent('request-photo','image/png',100,'../bad-hash',null,null,null,null)$$,'22023','Invalid upload declaration','malformed digest rejected');
select throws_ok($$select public.create_upload_intent('request-photo','image/png',100,repeat('a',64),'50000000-0000-0000-0000-000000000002',null,null,null)$$,'42501','Upload access denied','foreign customer request rejected');
select pg_temp.fixture_set_config('storage.operation','storage.object.sign_upload_url',true);
select ok(private.can_sign_upload_quarantine((select data->>'quarantinePath' from t10_uploads where label='draft'),'10000000-0000-0000-0000-000000000001'),'owner can sign the exact quarantine path');
select ok(not private.can_sign_upload_quarantine((select data->>'quarantinePath'||'/../other' from t10_uploads where label='draft'),'10000000-0000-0000-0000-000000000001'),'quarantine path traversal rejected');
select ok(not private.can_sign_upload_quarantine((select data->>'quarantinePath' from t10_uploads where label='draft'),'10000000-0000-0000-0000-000000000002'),'forged Storage owner rejected');
select is((select count(*)::int from storage.objects where bucket_id=(select data->>'outputBucket' from t10_uploads where label='draft') and name=(select data->>'outputPath' from t10_uploads where label='draft')),0,'unverified object cannot be read');
reset role;
select pg_temp.actor('10000000-0000-0000-0000-000000000002','customer');
set local role authenticated;
select throws_ok($$select public.get_upload_intent((select (data->>'id')::uuid from t10_uploads where label='draft'))$$,'42501','Upload access denied','another customer cannot resume an intent');
select throws_ok($$select public.create_upload_intent('request-photo','image/png',102,repeat('a',64),null,(select (data->>'draftId')::uuid from t10_uploads where label='draft'),null,null)$$,'42501','Upload access denied','another customer cannot add to the draft');
reset role;

-- SQL validates the trusted inspector acknowledgement; actual image bytes are
-- separately decoded in unit and HTTP/Storage integration tests.
insert into storage.objects(bucket_id,name,owner_id,metadata)
select 'upload-quarantine',data->>'quarantinePath','10000000-0000-0000-0000-000000000001','{"mimetype":"image/png","size":102}'::jsonb from t10_uploads where label='draft';
insert into storage.objects(bucket_id,name,metadata)
select data->>'outputBucket',data->>'outputPath','{"mimetype":"image/webp","size":80}'::jsonb from t10_uploads where label='draft';
set local role service_role;
select throws_ok($$select public.finalize_verified_upload((select (data->>'id')::uuid from t10_uploads where label='draft'),'10000000-0000-0000-0000-000000000001','image/png',102,repeat('a',64),80,repeat('b',64),'10000000-0000-0000-0000-000000000002')$$,'42501','Upload session is no longer active','server finalizer cannot substitute another user session');
select throws_ok($$select public.finalize_verified_upload((select (data->>'id')::uuid from t10_uploads where label='draft'),'10000000-0000-0000-0000-000000000002','image/png',102,repeat('a',64),80,repeat('b',64),'10000000-0000-0000-0000-000000000002')$$,'42501','Upload access denied','finalizer rechecks ownership');
select throws_ok($$select public.finalize_verified_upload((select (data->>'id')::uuid from t10_uploads where label='draft'),'10000000-0000-0000-0000-000000000001','image/jpeg',102,repeat('a',64),80,repeat('b',64),'10000000-0000-0000-0000-000000000001')$$,'22023','Upload inspection does not match declaration','MIME mismatch rejected');
select throws_ok($$select public.finalize_verified_upload((select (data->>'id')::uuid from t10_uploads where label='draft'),'10000000-0000-0000-0000-000000000001','image/png',102,repeat('c',64),80,repeat('b',64),'10000000-0000-0000-0000-000000000001')$$,'22023','Upload inspection does not match declaration','hash mismatch rejected');
select is(public.finalize_verified_upload((select (data->>'id')::uuid from t10_uploads where label='draft'),'10000000-0000-0000-0000-000000000001','image/png',102,repeat('a',64),80,repeat('b',64),'10000000-0000-0000-0000-000000000001')->>'status','verified','inspected stored object becomes evidence');
select is(public.finalize_verified_upload((select (data->>'id')::uuid from t10_uploads where label='draft'),'10000000-0000-0000-0000-000000000001','image/png',102,repeat('a',64),80,repeat('b',64),'10000000-0000-0000-0000-000000000001')->>'attachmentId',(select data->>'id' from t10_uploads where label='draft'),'retry returns the same attachment');
select throws_ok($$select public.finalize_verified_upload((select (data->>'id')::uuid from t10_uploads where label='draft'),'10000000-0000-0000-0000-000000000001','image/png',102,repeat('a',64),80,repeat('c',64),'10000000-0000-0000-0000-000000000001')$$,'22023','Upload already finalized with different inspection','replay cannot replace evidence');
reset role;
select throws_ok($$select private.attach_verified_draft((select (data->>'draftId')::uuid from t10_uploads where label='draft'),'50000000-0000-0000-0000-000000000002')$$,'42501','Upload draft access denied','draft cannot be linked to another customer');
select lives_ok($$select private.attach_verified_draft((select (data->>'draftId')::uuid from t10_uploads where label='draft'),'50000000-0000-0000-0000-000000000001')$$,'verified draft links transactionally to the own request');
select lives_ok($$select private.attach_verified_draft((select (data->>'draftId')::uuid from t10_uploads where label='draft'),'50000000-0000-0000-0000-000000000001')$$,'draft linking is idempotent');
select is((select count(*)::int from public.request_media where id=(select (data->>'id')::uuid from t10_uploads where label='draft')),1,'exactly one media record is created');

select pg_temp.actor('20000000-0000-0000-0000-000000000001','professional');
set local role authenticated;
select is(public.get_upload_intent((select (data->>'id')::uuid from t10_uploads where label='draft'))->>'status','verified','assigned approved professional can read request evidence');
insert into t10_uploads values('job',public.create_upload_intent('job-photo','image/png',102,repeat('a',64),'60000000-0000-0000-0000-000000000001',null,'before',null));
select throws_ok($$select public.create_upload_intent('job-photo','image/png',102,repeat('a',64),'60000000-0000-0000-0000-000000000002',null,'before',null)$$,'42501','Upload access denied','professional cannot upload to another job');
reset role;
insert into public.professional_invitations(id,email,token_hash,status) values('96000000-0000-4000-8000-000000000010','documentary-clearance-test@lysto.test',repeat('f',64),'completed');
update public.professional_profiles set invitation_id='96000000-0000-4000-8000-000000000010' where id='22000000-0000-0000-0000-000000000001';
set local role authenticated;
select is(public.get_session_context()->>'professional_eligible','false','approval alone does not grant clearance to an invited professional without a reviewed submission');
select throws_ok($$select public.get_upload_intent((select (data->>'id')::uuid from t10_uploads where label='draft'))$$,'42501','Upload access denied','missing clearance blocks direct request-evidence reads');
select throws_ok($$select public.create_upload_intent('job-photo','image/png',102,repeat('a',64),'60000000-0000-0000-0000-000000000001',null,'before',null)$$,'42501','Upload access denied','missing clearance blocks direct job uploads');
select ok(not private.can_sign_upload_quarantine((select data->>'quarantinePath' from t10_uploads where label='job'),'20000000-0000-0000-0000-000000000001'),'missing clearance revokes a pending job upload signature');
reset role;
update public.professional_profiles set invitation_id=null where id='22000000-0000-0000-0000-000000000001';
update public.professional_profiles set status='suspended' where id='22000000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$select public.get_upload_intent((select (data->>'id')::uuid from t10_uploads where label='draft'))$$,'42501','Upload access denied','suspension revokes new evidence reads with an old JWT');
select ok(not private.can_sign_upload_quarantine((select data->>'quarantinePath' from t10_uploads where label='job'),'20000000-0000-0000-0000-000000000001'),'suspension revokes new upload signatures');
reset role;
set local role service_role;
select throws_ok($$select public.finalize_verified_upload((select (data->>'id')::uuid from t10_uploads where label='job'),'20000000-0000-0000-0000-000000000001','image/png',102,repeat('a',64),80,repeat('b',64),'20000000-0000-0000-0000-000000000001')$$,'42501','Upload access denied','suspension is checked again during finalization');
reset role;

select pg_temp.actor('10000000-0000-0000-0000-000000000001','customer');
set local role authenticated;
insert into t10_uploads values('expired',public.create_upload_intent('request-photo','image/png',102,repeat('a',64),null,null,null,null));
reset role;
update private.upload_intents set expires_at=now()-interval '1 minute' where id=(select (data->>'id')::uuid from t10_uploads where label='expired');
set local role service_role;
select throws_ok($$select public.finalize_verified_upload((select (data->>'id')::uuid from t10_uploads where label='expired'),'10000000-0000-0000-0000-000000000001','image/png',102,repeat('a',64),80,repeat('b',64),'10000000-0000-0000-0000-000000000001')$$,'22023','Upload intent expired or unavailable','expired upload cannot become evidence');
select is(public.claim_expired_upload_intents(100),'[]'::jsonb,'cleanup waits beyond the signed-upload lifetime');
reset role;
update private.upload_intents set expires_at=now()-interval '1 minute',cleanup_after=now()-interval '1 minute' where id in (select (data->>'id')::uuid from t10_uploads where label in ('expired','draft'));
set local role service_role;
insert into t10_uploads values('lease',public.claim_expired_upload_intents(100));
select is(jsonb_array_length((select data from t10_uploads where label='lease')),1,'cleanup claims only the unverified orphan');
select is((select data->0->>'id' from t10_uploads where label='lease'),(select data->>'id' from t10_uploads where label='expired'),'verified linked evidence is never a cleanup candidate');
select is(public.claim_expired_upload_intents(100),'[]'::jsonb,'an active lease prevents duplicate workers');
select throws_ok($$select public.complete_upload_cleanup((select (data->>'id')::uuid from t10_uploads where label='expired'),'80000000-0000-0000-0000-000000000099')$$,'22023','Cleanup lease is no longer current','another worker cannot confirm the cleanup');
select ok(public.complete_upload_cleanup((select (data->0->>'id')::uuid from t10_uploads where label='lease'),(select (data->0->>'leaseToken')::uuid from t10_uploads where label='lease')),'current worker can confirm deletion');
select ok(public.complete_upload_cleanup((select (data->0->>'id')::uuid from t10_uploads where label='lease'),(select (data->0->>'leaseToken')::uuid from t10_uploads where label='lease')),'cleanup acknowledgement is idempotent');
reset role;
select * from finish();
rollback;
