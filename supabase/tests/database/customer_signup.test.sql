begin;
select plan(7);

insert into auth.users(id, email, raw_app_meta_data, raw_user_meta_data)
values ('c3130000-0000-4000-8000-000000000001', 'signup-isolation@example.test', '{}', '{"first_name":"Ana","last_name":"Pérez","role":"admin","app_role":"admin"}');

select is((select raw_app_meta_data->>'app_role' from auth.users where id = 'c3130000-0000-4000-8000-000000000001'), 'customer', 'Public signup gets only the customer application role');
select is((select role::text from public.profiles where auth_user_id = 'c3130000-0000-4000-8000-000000000001'), 'customer', 'User-editable metadata cannot elevate database role');
select is((select count(*)::int from public.customer_profiles cp join public.profiles p on cp.profile_id=p.id where p.auth_user_id = 'c3130000-0000-4000-8000-000000000001'), 1, 'Customer subtype is provisioned exactly once');
select is((select first_name from public.profiles where auth_user_id = 'c3130000-0000-4000-8000-000000000001'), 'Ana', 'Personal profile data is saved');

insert into auth.users(id, email, raw_app_meta_data) values ('c3130000-0000-4000-8000-000000000002', 'staff-signup-isolation@example.test', '{"app_role":"professional"}');
select is((select count(*)::int from public.profiles where auth_user_id = 'c3130000-0000-4000-8000-000000000002'), 0, 'Staff provisioning remains separate');
select ok(not has_function_privilege('authenticated', 'private.provision_signup_customer()', 'execute'), 'Public sessions cannot invoke the privileged provisioning function');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'role', 'update'), 'Signup does not grant role updates');
select * from finish();
rollback;
