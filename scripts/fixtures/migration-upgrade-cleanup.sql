-- Run ONLY on the marked disposable T03 database, after comparing witnesses.
-- pgTAP uses its own fixtures and expects an otherwise seed-only database.
begin;
delete from public.payments where id = '90000000-0000-0000-0000-000000000007' and provider_payment_id = 'synthetic-migration-witness';
delete from public.jobs where id = '90000000-0000-0000-0000-000000000006';
delete from public.service_requests where id = '90000000-0000-0000-0000-000000000005';
delete from public.customer_addresses where id = '90000000-0000-0000-0000-000000000004';
delete from public.customer_profiles where id = '90000000-0000-0000-0000-000000000003';
delete from public.profiles where id = '90000000-0000-0000-0000-000000000002' and email = 'migration-witness@lysto.test';
delete from auth.users where id = '90000000-0000-0000-0000-000000000001' and email = 'migration-witness@lysto.test';
commit;
