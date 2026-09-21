begin;

\ir ../fixtures/session.sql.inc

set search_path=public,extensions;
select no_plan();
\ir ../fixtures/marketplace.sql.inc
select ok(not has_table_privilege('authenticated','public.mp_split_connected_accounts','select'),'OAuth tokens are inaccessible to browser roles');
select ok(not has_table_privilege('service_role','public.mp_split_connected_accounts','select'),'OAuth secrets require dedicated server PostgreSQL access');
select ok(not has_table_privilege('authenticated','public.marketplace_checkouts','insert'),'Browser cannot forge financial snapshots');
select ok(not has_function_privilege('authenticated','private.prepare_marketplace_checkout(uuid,uuid,uuid,boolean)','execute'),'Browser cannot impersonate a customer through internal function');
select throws_ok($$select private.prepare_marketplace_checkout('85000000-0000-0000-0000-000000000002',(select id from jobs where customer_id='85000000-0000-0000-0000-000000000001'),null,false)$$,'P0001','payment_forbidden','Different customer cannot pay this job');
select throws_ok($$update jobs set status='technician_on_way' where customer_id='85000000-0000-0000-0000-000000000001'$$,'P0001','Initial payment must be approved before the visit','Visit requires real confirmed initial payment');
select lives_ok($$select private.prepare_marketplace_checkout('85000000-0000-0000-0000-000000000001',(select id from jobs where customer_id='85000000-0000-0000-0000-000000000001'),null,false)$$,'Owner can prepare immutable checkout');
select lives_ok($$select private.prepare_marketplace_checkout('85000000-0000-0000-0000-000000000001',(select id from jobs where customer_id='85000000-0000-0000-0000-000000000001'),null,false)$$,'Retry reuses the same checkout');
select is((select count(*) from marketplace_checkouts where customer_id='85000000-0000-0000-0000-000000000001'),1::bigint,'One checkout per service');
select is((select amount from marketplace_checkouts where customer_id='85000000-0000-0000-0000-000000000001'),130000::numeric,'No second 30 percent markup');
select is((select marketplace_fee from marketplace_checkouts where customer_id='85000000-0000-0000-0000-000000000001'),23400::numeric,'Frozen commission is exact');
select is((select checkout_protocol from marketplace_checkouts where customer_id='85000000-0000-0000-0000-000000000001'),'preferences','New checkout stays on Preferences until Orders is enabled');
select ok(not has_table_privilege('authenticated','private.marketplace_order_observations','select'),'Order observations remain server-only');
select lives_ok($$update private.payment_refund_requests as current_request
  set order_refund_baseline=coalesce(order_refund_baseline,array[]::text[])
  where id=gen_random_uuid() and claim_token=gen_random_uuid() and status='processing'
    and locked_until>clock_timestamp()
    and not exists(select 1 from private.payment_refund_requests earlier
      where earlier.payment_id=current_request.payment_id and earlier.id<>current_request.id
        and earlier.status in ('requested','processing')
        and (earlier.requested_at,earlier.id)<(current_request.requested_at,current_request.id))$$,
  'Order refund baseline claim query parses without touching existing requests');
select throws_ok($$update marketplace_checkouts set amount=1 where customer_id='85000000-0000-0000-0000-000000000001'$$,'P0001','Checkout financial snapshot is immutable','Amounts cannot change after preparation');
select throws_ok($$update mp_split_connected_accounts set mercado_pago_user_id='different' where seller_id='85000000-0000-0000-0000-000000000003'$$,'P0001','seller_has_payments','Reauthorization cannot replace the payee');
select throws_ok($$update mp_split_connected_accounts set enabled=false where seller_id='85000000-0000-0000-0000-000000000003'$$,'P0001','seller_has_payments','Disconnect cannot race a checkout');
select throws_ok($$delete from mp_split_connected_accounts where seller_id='85000000-0000-0000-0000-000000000003'$$,'P0001','seller_has_payments','Account history cannot be deleted');
select lives_ok($$update mp_split_connected_accounts set encrypted_access_token='renewed-fixture-token' where seller_id='85000000-0000-0000-0000-000000000003'$$,'Same account can refresh its credentials');
update marketplace_checkouts set status='rejected' where customer_id='85000000-0000-0000-0000-000000000001';
select throws_ok($$update jobs set professional_id=null where customer_id='85000000-0000-0000-0000-000000000001'$$,'P0001','A checkout pins its professional: create a linked replacement service instead','Rejected card does not release the payee');
set local role authenticated;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"85000000-0000-0000-0000-000000000002","app_metadata":{"app_role":"customer"}}',true);
select is((select count(*) from marketplace_checkouts),0::bigint,'Other customers cannot read checkout amounts');
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"85000000-0000-0000-0000-000000000001","app_metadata":{"app_role":"customer"}}',true);
select is((select count(*) from marketplace_checkouts),1::bigint,'Owner can read their checkout');
reset role;
update marketplace_checkouts set status='approved' where customer_id='85000000-0000-0000-0000-000000000001';
update jobs set status='onsite_diagnosis' where customer_id='85000000-0000-0000-0000-000000000001';
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"85000000-0000-0000-0000-000000000003","app_metadata":{"app_role":"professional"}}',true);
select public.propose_job_extra((select id from jobs where customer_id='85000000-0000-0000-0000-000000000001'),'Otra falla detectada','Reparación adicional aceptada por separado',50000,'87000000-0000-0000-0000-000000000001');
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"85000000-0000-0000-0000-000000000001","app_metadata":{"app_role":"customer"}}',true);
select public.decide_job_extra((select id from job_extras where idempotency_key='87000000-0000-0000-0000-000000000001'),'accepted');
select private.prepare_marketplace_checkout('85000000-0000-0000-0000-000000000001',(select id from jobs where customer_id='85000000-0000-0000-0000-000000000001'),(select id from job_extras where idempotency_key='87000000-0000-0000-0000-000000000001'),false);
select is((select marketplace_fee from marketplace_checkouts where extra_id=(select id from job_extras where idempotency_key='87000000-0000-0000-0000-000000000001')),0::numeric,'Extra payment has no Lysto commission');
select is((select amount from marketplace_checkouts where extra_id=(select id from job_extras where idempotency_key='87000000-0000-0000-0000-000000000001')),50000::numeric,'Extra has no second markup');
update marketplace_checkouts set checkout_protocol='orders',order_id='ORDTST01FIXTURE',status='cancelled'
  where extra_id=(select id from job_extras where idempotency_key='87000000-0000-0000-0000-000000000001');
insert into private.marketplace_order_observations(order_id,checkout_id,provider_status,provider_updated_at)
  select order_id,id,'cancelled',now() from marketplace_checkouts where order_id='ORDTST01FIXTURE';
insert into public.admin_profiles(id,profile_id,can_manage_payments)
  values('85000000-0000-0000-0000-000000000004','85000000-0000-0000-0000-000000000004',true)
  on conflict(profile_id) do nothing;
insert into private.admin_profile_permissions(admin_profile_id,permission)
  select id,'finance' from public.admin_profiles where profile_id='85000000-0000-0000-0000-000000000004'
  on conflict do nothing;
set local role authenticated;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"85000000-0000-0000-0000-000000000004","app_metadata":{"app_role":"admin","admin_permissions":["finance"]}}',true);
select lives_ok($$select public.mark_marketplace_checkout_closed(
  (select id from public.marketplace_checkouts where order_id='ORDTST01FIXTURE'),
  '{"providerOrderId":"ORDTST01FIXTURE","providerOrderStatus":"cancelled"}'::jsonb)$$,
  'Finance closes a verified cancelled Order');
select lives_ok($$select public.mark_marketplace_checkout_closed(
  (select id from public.marketplace_checkouts where order_id='ORDTST01FIXTURE'),
  '{"providerOrderId":"ORDTST01FIXTURE","providerOrderStatus":"cancelled"}'::jsonb)$$,
  'Repeating the same financial closure is idempotent');
reset role;
select ok((select private.checkout_is_financially_closed(c) from public.marketplace_checkouts c
  where c.order_id='ORDTST01FIXTURE'),'Cancelled Order is financially closed only after evidence');
select throws_ok($$update public.marketplace_checkouts set order_id=null
  where order_id='ORDTST01FIXTURE'$$,'P0001','checkout_financially_closed',
  'A financially closed Order cannot be replaced with a new payable identity');
select * from finish();
rollback;
