-- Synthetic data for the disposable T03 database ONLY, after migration 202608190007.
-- Run as postgres. Never apply to a linked or persistent environment.
begin;
insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values ('90000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'migration-witness@lysto.test', '', '{"app_role":"customer"}', '{}');
insert into public.profiles (id, auth_user_id, role, first_name, last_name, email)
values ('90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 'customer', 'Migration', 'Witness', 'migration-witness@lysto.test');
insert into public.customer_profiles (id, profile_id)
values ('90000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000002');
insert into public.customer_addresses (id, customer_id, street, number, city, province)
values ('90000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000003', 'Synthetic', '1', 'CABA', 'CABA');
insert into public.service_requests (id, customer_id, category_id, issue_type_id, address_id, status)
select '90000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000003', category.id, issue.id, '90000000-0000-0000-0000-000000000004', 'payment_approved'
from public.service_categories category join public.service_issue_types issue on issue.category_id = category.id
where category.slug = 'aire_acondicionado' order by issue.id limit 1;
insert into public.jobs (id, request_id, customer_id, status)
values ('90000000-0000-0000-0000-000000000006', '90000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000003', 'pending_assignment');
insert into public.payments (id, job_id, request_id, customer_id, provider_payment_id, amount, marketplace_fee, professional_amount)
values ('90000000-0000-0000-0000-000000000007', '90000000-0000-0000-0000-000000000006', '90000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000003', 'synthetic-migration-witness', 1000, 180, 820);
commit;
