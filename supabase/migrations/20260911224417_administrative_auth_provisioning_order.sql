-- GoTrue Admin API may insert the user before applying trusted app metadata.
-- Without submitted acceptance the Auth identity remains incomplete; bootstrap
-- cannot create customer data until an immutable valid acceptance exists.
create or replace function private.capture_customer_registration() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_app_meta_data->>'app_role' = 'customer'
    and new.raw_app_meta_data->>'signup_source' = 'customer_public'
    and coalesce(new.raw_user_meta_data,'{}'::jsonb) ?| array['accepted','terms_version','privacy_version'] then
    perform private.record_customer_acceptance(new.id,new.raw_user_meta_data->>'first_name',new.raw_user_meta_data->>'last_name',new.raw_user_meta_data->>'phone',
      new.raw_user_meta_data->>'terms_version',new.raw_user_meta_data->>'privacy_version',new.raw_user_meta_data->'accepted' = 'true'::jsonb);
  end if;
  return new;
end;
$$;
revoke all on function private.capture_customer_registration() from public,anon,authenticated,service_role;
