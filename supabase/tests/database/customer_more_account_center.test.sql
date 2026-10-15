-- Boundary tests only. Issued-session fixture claims never leave this rollback
-- transaction and are not a replacement for the HTTP/Auth password tests.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
create function pg_temp.check_account(p_ok boolean,p_message text) returns void language plpgsql as $$
begin if p_ok is distinct from true then raise exception 'account_test_failed: %',p_message;end if;end;$$;
create function pg_temp.account_throws(p_sql text,p_code text) returns void language plpgsql as $$
begin
  begin execute p_sql;exception when others then
    if sqlstate=p_code then return;end if;raise exception 'unexpected SQLSTATE %, expected %',sqlstate,p_code;
  end;
  raise exception 'expected SQLSTATE %',p_code;
end;$$;
select pg_temp.check_account(not has_function_privilege('anon','public.read_customer_preferences()','execute'),'anon preferences denied');
select pg_temp.check_account(not has_function_privilege('service_role','public.export_customer_account()','execute'),'service role cannot substitute a customer');
select pg_temp.check_account(not has_function_privilege('authenticated','public.issue_customer_account_reauth(uuid,uuid)','execute'),'customer cannot issue own reauth attestation');
select pg_temp.check_account(not has_function_privilege('authenticated','public.customer_outbox_email_allowed(uuid,uuid)','execute'),'customer cannot inspect outbox recipients');
select pg_temp.check_account(not has_table_privilege('authenticated','public.customer_contact_preferences','update'),'no direct preferences update');
select pg_temp.check_account(not has_table_privilege('authenticated','public.customer_account_privacy_requests','insert'),'no direct privacy insertion');
select pg_temp.check_account((select relrowsecurity from pg_class where oid='public.customer_account_privacy_requests'::regclass),'privacy RLS enabled');
select pg_temp.check_account(not (select prosecdef from pg_proc where oid='public.export_customer_account()'::regprocedure),'export wrapper invoker');
select pg_temp.check_account((select prosecdef and proconfig=array['search_path=""'] from pg_proc where oid='private.export_customer_account()'::regprocedure),'export implementation private, fixed search path');

insert into auth.users(instance_id,id,aud,role,email,raw_app_meta_data,raw_user_meta_data,email_confirmed_at,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','9a000000-0000-4000-8000-000000000001','authenticated','authenticated','more-a@lysto.test','{"app_role":"customer"}','{}',now(),now(),now()),
('00000000-0000-0000-0000-000000000000','9a000000-0000-4000-8000-000000000002','authenticated','authenticated','more-b@lysto.test','{"app_role":"customer"}','{}',now(),now(),now()),
('00000000-0000-0000-0000-000000000000','9a000000-0000-4000-8000-000000000003','authenticated','authenticated','more-pro@lysto.test','{"app_role":"professional"}','{}',now(),now(),now());
insert into public.profiles(id,auth_user_id,role,first_name,last_name,email) values
('9b000000-0000-4000-8000-000000000001','9a000000-0000-4000-8000-000000000001','customer','A','Cliente','more-a@lysto.test'),
('9b000000-0000-4000-8000-000000000002','9a000000-0000-4000-8000-000000000002','customer','B','Cliente','more-b@lysto.test'),
('9b000000-0000-4000-8000-000000000003','9a000000-0000-4000-8000-000000000003','professional','Pro','Fixture','more-pro@lysto.test');
insert into public.customer_profiles(id,profile_id,notes) values
('9c000000-0000-4000-8000-000000000001','9b000000-0000-4000-8000-000000000001','INTERNAL_NEVER_EXPORT'),
('9c000000-0000-4000-8000-000000000002','9b000000-0000-4000-8000-000000000002','OTHER_CUSTOMER_PRIVATE');
insert into public.professional_profiles(id,profile_id,status) values('9c000000-0000-4000-8000-000000000003','9b000000-0000-4000-8000-000000000003','approved');
insert into auth.sessions(id,user_id,aal,created_at,updated_at,user_agent) values
('9d000000-0000-4000-8000-000000000001','9a000000-0000-4000-8000-000000000001','aal1',now(),now(),'Mozilla Windows Chrome/123 PRIVATE_UA'),
('9d000000-0000-4000-8000-000000000002','9a000000-0000-4000-8000-000000000001','aal1',now(),now(),'Mozilla iPhone Safari/123'),
('9d000000-0000-4000-8000-000000000003','9a000000-0000-4000-8000-000000000002','aal1',now(),now(),'Mozilla Android Chrome/123'),
('9d000000-0000-4000-8000-000000000004','9a000000-0000-4000-8000-000000000003','aal1',now(),now(),'Mozilla Android Chrome/123');
select set_config('request.jwt.claims','{"sub":"9a000000-0000-4000-8000-000000000001","session_id":"9d000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"app_role":"customer"},"user_metadata":{"app_role":"admin"}}',true);
set local role authenticated;
select pg_temp.check_account(public.read_customer_preferences()->'preferences'->>'version'='0','defaults have version zero');
select pg_temp.check_account(public.read_customer_preferences()->>'essentialEmail'='true','essential email always enabled');
select pg_temp.check_account(public.write_customer_preferences(0,false,false,false,true)->'preferences'->>'version'='1','successful CAS increments version');
select pg_temp.check_account(public.read_customer_preferences()->'preferences'->>'reduceMotion'='true','reduced motion persisted');
select pg_temp.account_throws('select public.write_customer_preferences(0,true,true,true,false)','PT409');
select pg_temp.account_throws('select public.write_customer_preferences(1,null,true,true,false)','22023');
select pg_temp.check_account(jsonb_array_length(public.list_customer_account_sessions())=2,'sessions scoped to owner');
select pg_temp.check_account(position('PRIVATE_UA' in public.list_customer_account_sessions()::text)=0,'raw user agent not exposed');
select pg_temp.account_throws($q$select public.revoke_customer_account_sessions('9d000000-0000-4000-8000-000000000003',false)$q$,'P0002');
select pg_temp.account_throws($q$select public.revoke_customer_account_sessions('9d000000-0000-4000-8000-000000000001',false)$q$,'22023');
select pg_temp.check_account(public.revoke_customer_account_sessions(null,true)->>'revoked'='1','only other own session revoked');
select pg_temp.check_account(public.export_customer_account()->'profile'->>'id'='9b000000-0000-4000-8000-000000000001','export owns profile');
select pg_temp.check_account(position('INTERNAL_NEVER_EXPORT' in public.export_customer_account()::text)=0,'internal customer notes excluded');
select pg_temp.check_account(position('OTHER_CUSTOMER_PRIVATE' in public.export_customer_account()::text)=0,'other customer excluded');
select pg_temp.check_account(not (public.export_customer_account() ? 'auth'),'auth tokens never exported');
select pg_temp.check_account(public.read_customer_account_privacy()->'request'='null'::jsonb,'no fabricated deletion status');
select pg_temp.account_throws($q$select public.request_customer_account_deletion('9e000000-0000-4000-8000-000000000001','9f000000-0000-4000-8000-000000000001')$q$,'42501');
reset role;
select pg_temp.check_account(exists(select 1 from auth.sessions where id='9d000000-0000-4000-8000-000000000003'),'other customer session preserved');

-- Only the server role may issue an attestation after successful Auth proof.
set local role service_role;
select public.issue_customer_account_reauth('9a000000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000001');
reset role;
select set_config('more_test.receipt',(select id::text from private.customer_account_reauth_receipts where auth_user_id='9a000000-0000-4000-8000-000000000001' order by created_at desc limit 1),true);
set local role authenticated;
select pg_temp.check_account(public.request_customer_account_deletion('9e000000-0000-4000-8000-000000000001',current_setting('more_test.receipt')::uuid)->'request'->>'status'='requested','deletion request tracks real support case');
select pg_temp.account_throws($q$select public.request_customer_account_deletion('9e000000-0000-4000-8000-000000000001',current_setting('more_test.receipt')::uuid)$q$,'42501');
reset role;
select pg_temp.check_account((select count(*) from public.customer_account_privacy_requests where customer_id='9c000000-0000-4000-8000-000000000001')=1,'privacy request persisted once');
select pg_temp.check_account((select count(*) from public.complaints where customer_id='9c000000-0000-4000-8000-000000000001')=1,'one operational support case');
select pg_temp.check_account(exists(select 1 from auth.users where id='9a000000-0000-4000-8000-000000000001'),'request does not delete Auth user');

-- Lease-bound worker preference gate: optional support can be suppressed,
-- payment/safety support remains essential, foreign leases are rejected.
update private.outbox_events set locked_at=clock_timestamp(),locked_until=clock_timestamp()+interval '120 seconds',locked_by='account-rollback-test',claim_token='9f000000-0000-4000-8000-000000000002',attempt_count=attempt_count+1
where recipient_profile_id='9b000000-0000-4000-8000-000000000001' and event_type='support.opened' and channel='email';
select set_config('more_test.event',(select id::text from private.outbox_events where recipient_profile_id='9b000000-0000-4000-8000-000000000001' and event_type='support.opened' and channel='email' limit 1),true);
set local role service_role;
select pg_temp.check_account(public.customer_outbox_email_allowed(current_setting('more_test.event')::uuid,'9f000000-0000-4000-8000-000000000002')=false,'optional support preference honored');
select pg_temp.account_throws($q$select public.customer_outbox_email_allowed(current_setting('more_test.event')::uuid,'9f000000-0000-4000-8000-000000000003')$q$,'PT409');
reset role;
update public.complaints set category='payment' where customer_id='9c000000-0000-4000-8000-000000000001';
set local role service_role;
select pg_temp.check_account(public.customer_outbox_email_allowed(current_setting('more_test.event')::uuid,'9f000000-0000-4000-8000-000000000002')=true,'payment support is essential');
reset role;

select set_config('request.jwt.claims','{"sub":"9a000000-0000-4000-8000-000000000002","session_id":"9d000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"app_role":"customer"}}',true);
set local role authenticated;
select pg_temp.check_account(public.read_customer_preferences()->'preferences'->>'version'='0','customer B gets independent defaults');
select pg_temp.check_account((select count(*) from public.customer_account_privacy_requests)=0,'privacy RLS hides A from B');
reset role;
select set_config('request.jwt.claims','{"sub":"9a000000-0000-4000-8000-000000000003","session_id":"9d000000-0000-4000-8000-000000000004","role":"authenticated","app_metadata":{"app_role":"professional"}}',true);
set local role authenticated;
select pg_temp.account_throws('select public.read_customer_preferences()','42501');
select pg_temp.account_throws('select public.list_customer_account_sessions()','42501');
reset role;
select set_config('request.jwt.claims','{"sub":"9a000000-0000-4000-8000-000000000001","session_id":"9d000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"app_role":"customer"}}',true);
set local role authenticated;
select pg_temp.account_throws('select public.read_customer_preferences()','42501');
reset role;
select ok(true,'customer_more_account_center SQL boundary checks passed; all data rolled back');
select * from finish();
rollback;
