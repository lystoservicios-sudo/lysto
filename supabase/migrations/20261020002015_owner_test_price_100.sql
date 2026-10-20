-- Lower only the owner trial to ARS 100. Keep historical ARS 1000 snapshots valid and immutable.
create or replace function private.is_owner_maintenance_test_quote(
  p_customer_id uuid,
  p_input jsonb,
  p_quote jsonb
) returns boolean
language sql stable security definer set search_path='' as $$
  select p_input->>'issue'='mantenimiento'
    and (p_quote->>'total')::numeric in (100,1000)
    and p_quote->'specialPricing'=jsonb_build_object('kind','owner_maintenance_test','amount',(p_quote->>'total')::numeric)
    and (p_quote->>'platformFeeRate')::numeric=0.18
    and (p_quote->>'platformFee')::numeric=round((p_quote->>'total')::numeric*0.18,2)
    and (p_quote->>'professionalAmount')::numeric=(p_quote->>'total')::numeric-(p_quote->>'platformFee')::numeric
    and (p_quote->>'platformContribution')::numeric=(p_quote->>'platformFee')::numeric
    and exists (
      select 1
      from public.customer_profiles cp
      join public.profiles p on p.id=cp.profile_id
      join auth.users u on u.id=p.auth_user_id
      where cp.id=p_customer_id
        and lower(btrim(u.email))='quimey_boca@hotmail.com'
        and u.email_confirmed_at is not null
        and u.deleted_at is null
        and (u.banned_until is null or u.banned_until<=now())
    );
$$;
revoke all on function private.is_owner_maintenance_test_quote(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;

create or replace function private.guard_owner_maintenance_test_quote() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and new.quote->'specialPricing' is distinct from old.quote->'specialPricing' then
    raise exception using errcode='42501',message='Owner test pricing is immutable';
  end if;
  if new.quote ? 'specialPricing'
    and private.is_owner_maintenance_test_quote(new.customer_id,new.input,new.quote) is not true then
    raise exception using errcode='42501',message='Owner maintenance test price is not authorized';
  end if;
  if tg_op='INSERT' and new.quote ? 'specialPricing' then
    insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
      values(new.created_by,'pricing.owner_test_price.applied','service_quote',new.id,
        jsonb_build_object('amount',new.quote->'total','platformFee',new.quote->'platformFee','professionalAmount',new.quote->'professionalAmount'));
  end if;
  return new;
end; $$;
revoke all on function private.guard_owner_maintenance_test_quote() from public,anon,authenticated,service_role;

create or replace function private.create_owner_marketplace_split_test_job(
  p_actor_user_id uuid,
  p_actor_session_id uuid,
  p_customer_id uuid,
  p_professional_id uuid,
  p_quote jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_actor_email text;
  v_actor_aal text;
  v_actor_profile_id uuid;
  v_customer_id uuid;
  v_category_id uuid;
  v_issue_type_id uuid;
  v_request_id uuid;
  v_job_id uuid;
  v_saved_claims text;
  v_approved_sellers integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('lysto-owner-split-test:' || p_customer_id::text, 0));

  select u.raw_app_meta_data->>'app_role', lower(btrim(u.email)), s.aal::text
    into v_actor_role, v_actor_email, v_actor_aal
  from auth.sessions s
  join auth.users u on u.id = s.user_id
  where s.id = p_actor_session_id and u.id = p_actor_user_id
  for share of s, u;

  if not found or not private.session_is_active(p_actor_user_id, p_actor_session_id)
    or v_actor_role <> 'customer' or v_actor_email <> 'quimey_boca@hotmail.com' then
    raise exception using errcode = '42501', message = 'Owner split test customer session required';
  end if;

  v_saved_claims = current_setting('request.jwt.claims', true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_actor_user_id,
    'session_id', p_actor_session_id,
    'aal', v_actor_aal,
    'app_metadata', jsonb_build_object('app_role', 'customer')
  )::text, true);

  v_actor_profile_id = private.current_profile_id();
  v_customer_id = private.current_customer_id();
  if v_actor_profile_id is null or v_customer_id is distinct from p_customer_id then
    raise exception using errcode = '42501', message = 'Owner split test customer mismatch';
  end if;

  select count(*) into v_approved_sellers
  from public.professional_profiles p
  join public.mp_split_connected_accounts a on a.seller_id = p.id::text
  where p.status = 'approved' and a.enabled and a.mercado_pago_user_id is not null;
  if v_approved_sellers <> 1 or not exists (
    select 1 from public.professional_profiles p
    join public.mp_split_connected_accounts a on a.seller_id = p.id::text
    where p.id = p_professional_id and p.status = 'approved'
      and a.enabled and a.mercado_pago_user_id is not null
  ) then
    raise exception using errcode = '42501', message = 'Owner split test seller is not uniquely connected';
  end if;

  if jsonb_typeof(p_quote) is distinct from 'object'
    or p_quote->'specialPricing' is distinct from jsonb_build_object('kind', 'owner_maintenance_test', 'amount', 100)
    or coalesce((p_quote->>'total')::numeric, -1) <> 100
    or coalesce((p_quote->>'platformFee')::numeric, -1) <> 18
    or coalesce((p_quote->>'professionalAmount')::numeric, -1) <> 82
    or coalesce((p_quote->>'platformFeeRate')::numeric, -1) <> 0.18
    or coalesce((p_quote->>'platformContribution')::numeric, -1) <> 18
    or coalesce((p_quote->>'calculatorSubtotal')::numeric, -1) <> 76.92
    or coalesce((p_quote->>'safetyAmount')::numeric, -1) <> 23.08
    or coalesce((p_quote->>'safetyRate')::numeric, -1) <> 0.30
    or p_quote->>'currency' is distinct from 'ARS' then
    raise exception using errcode = '22023', message = 'Owner split test quote must remain ARS 100 with the 18/82 split';
  end if;

  select j.id into v_job_id
  from public.jobs j
  join public.service_quotes q on q.request_id = j.request_id
  where j.customer_id = v_customer_id and j.professional_id = p_professional_id
    and q.input->>'marketplaceSplitTest' = 'true'
    and q.input->>'marketplaceSplitSellerId' = p_professional_id::text
    and q.quote->'specialPricing' = jsonb_build_object('kind', 'owner_maintenance_test', 'amount', 100)
  order by q.created_at desc
  limit 1
  for update of j;

  if v_job_id is not null then
    perform set_config('request.jwt.claims', coalesce(v_saved_claims, ''), true);
    return v_job_id;
  end if;

  select c.id, i.id into v_category_id, v_issue_type_id
  from public.service_categories c
  join public.service_issue_types i on i.category_id = c.id
  where c.active and i.active and c.slug = 'aire_acondicionado' and i.slug = 'mantenimiento'
  limit 1;
  if v_category_id is null or v_issue_type_id is null then
    raise exception using errcode = 'P0002', message = 'Owner split test maintenance service is unavailable';
  end if;

  insert into public.service_requests(customer_id, category_id, issue_type_id, status, submitted_at)
  values(v_customer_id, v_category_id, v_issue_type_id, 'assigned', now())
  returning id into v_request_id;

  insert into public.request_answers(request_id, question_code, answer_value, answer_json)
  values(v_request_id, 'owner_marketplace_split_test', 'Prueba real de split',
    jsonb_build_object('seller_id', p_professional_id));

  insert into public.service_quotes(
    customer_id, address, input, quote, preferred_date, time_window,
    status, expires_at, request_id, accepted_at, created_by
  ) values (
    v_customer_id,
    jsonb_build_object('label', 'Prueba de pago'),
    jsonb_build_object('issue', 'mantenimiento', 'materialsConfirmed', true,
      'marketplaceSplitTest', true, 'marketplaceSplitSellerId', p_professional_id),
    p_quote,
    (now() at time zone 'America/Argentina/Buenos_Aires')::date + 1,
    '09:00–11:00', 'accepted', now() + interval '7 days', v_request_id, now(), v_actor_profile_id
  );

  insert into public.jobs(request_id, customer_id, professional_id, status, accepted_at, final_amount)
  values(v_request_id, v_customer_id, p_professional_id, 'confirmed', now(), 100)
  returning id into v_job_id;

  perform set_config('request.jwt.claims', coalesce(v_saved_claims, ''), true);
  return v_job_id;
end;
$$;

revoke all on function private.create_owner_marketplace_split_test_job(uuid, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

