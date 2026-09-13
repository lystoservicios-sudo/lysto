-- Public web onboarding shares the hardened bootstrap and versioned quote boundary.
-- Google supplies an Auth identity only; capture_customer_registration already leaves
-- absent acceptance incomplete. No trigger creates domain profiles on auth.users insert.
-- No legal policy or account acceptance is enabled by this migration.
create function private.assert_customer_request_ready()
returns void language plpgsql security definer set search_path = '' as $$
declare cid uuid := private.current_customer_id(); p public.profiles%rowtype;
begin
  if cid is null then raise exception using errcode='42501',message='Current customer session required'; end if;
  select profile.* into p from public.profiles profile
    join public.customer_profiles customer on customer.profile_id=profile.id
    where customer.id=cid and profile.auth_user_id=auth.uid() and profile.role='customer';
  if not exists (select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) then
    raise exception using errcode='42501',message='customer_email_unverified';
  end if;
  if p.id is null or length(trim(p.first_name)) not between 1 and 100
    or length(trim(p.last_name)) not between 1 and 100
    or length(trim(coalesce(p.phone,'')))>40
    or length(regexp_replace(coalesce(p.phone,''),'[^0-9]','','g'))<8
    or not exists (select 1 from public.customer_addresses a where a.customer_id=cid and a.archived_at is null
      and length(trim(a.street)) between 1 and 200 and length(trim(a.number)) between 1 and 30
      and length(trim(a.city)) between 1 and 100 and length(trim(a.province)) between 1 and 100
      and a.property_type is not null) then
    raise exception using errcode='42501',message='customer_profile_incomplete';
  end if;
end;
$$;
revoke all on function private.assert_customer_request_ready() from public,anon,authenticated,service_role;
create or replace function private.submit_service_quote_v2(p_quote_id uuid,p_expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.service_quotes%rowtype; cid uuid; actor uuid; category uuid; issue uuid; address_id uuid; req uuid; price_id uuid; job_id uuid; result jsonb;
begin
  perform pg_advisory_xact_lock(537975841827451329::bigint);
  perform 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=private.current_session_id() and u.id=auth.uid() for share of s,u;
  cid=private.current_customer_id();actor=private.current_profile_id();
  if not found or cid is null then raise exception using errcode='42501',message='Current customer session required'; end if;
  select * into q from public.service_quotes where id=p_quote_id and customer_id=cid for update;
  if not found then raise exception using errcode='P0002',message='Quote unavailable'; end if;
  -- A committed result remains recoverable after expiry or a later tariff change.
  if q.status='accepted' then
    if q.acceptance_result is not null then return q.acceptance_result; end if;
    select id into job_id from public.jobs where request_id=q.request_id and customer_id=cid;
    return jsonb_build_object('request_id',q.request_id,'job_id',job_id,'status','pending_assignment','quote_id',q.id);
  end if;
  perform private.assert_customer_request_ready();
  if q.version is distinct from p_expected_version or q.status='superseded' then raise exception using errcode='40001',message='Quote version changed'; end if;
  if q.status<>'ready' or q.reviewed_by is null or q.reviewed_at is null then raise exception using errcode='22023',message='Quote requires review'; end if;
  perform private.assert_quote_offerable(q.id);
  select id into category from public.service_categories where slug='aire_acondicionado' and active for share;
  select id into issue from public.service_issue_types where category_id=category and slug=q.input->>'issue' and active for share;
  if issue is null then raise exception using errcode='22023',message='Service unavailable'; end if;
  insert into public.customer_addresses(customer_id,street,number,city,province,property_type,has_elevator,has_parking,stairs_required,outdoor_unit_at_height,difficult_access,floor,apartment,reference,postal_code,outdoor_unit_on_balcony)
  values(cid,q.address->>'street',q.address->>'number',q.address->>'city',q.address->>'province',(q.input->>'propertyType')::public.property_type,
    (q.input->'access'->>'hasElevator')::boolean,(q.input->'access'->>'hasParking')::boolean,(q.input->'access'->>'stairsRequired')::boolean,
    (q.input->'access'->>'outdoorUnitAtHeight')::boolean,(q.input->'access'->>'difficultAccess')::boolean,
    q.address->>'floor',q.address->>'apartment',q.address->>'reference',q.address->>'postalCode',(q.input->'access'->>'outdoorUnitOnBalcony')::boolean) returning id into address_id;
  insert into public.service_requests(customer_id,category_id,issue_type_id,address_id,status,time_since,preferred_date,preferred_time_window,urgency_level,submitted_at)
  values(cid,category,issue,address_id,'pending_assignment',q.input->>'timeSince',q.preferred_date,q.time_window,(q.input->>'urgency')::public.urgency_level,now()) returning id into req;
  perform private.attach_quote_uploads(q.id,req);
  insert into public.price_options(request_id,option_type,title,description,amount,platform_fee,professional_amount,selected)
  values(req,(q.input->>'urgency')::public.urgency_level,'Presupuesto Lysto',q.quote->>'scope',(q.quote->>'total')::numeric,(q.quote->>'platformFee')::numeric,(q.quote->>'professionalAmount')::numeric,true) returning id into price_id;
  update public.service_requests set selected_price_option_id=price_id where id=req;
  insert into public.jobs(request_id,customer_id,status,scheduled_date,scheduled_time_window,final_amount)
  values(req,cid,'pending_assignment',q.preferred_date,q.time_window,(q.quote->>'total')::numeric) returning id into job_id;
  insert into public.job_status_events(job_id,status,actor_profile_id,notes,metadata)
  values(job_id,'pending_assignment',actor,'Cliente aceptó presupuesto; pendiente de profesional. No implica pago.',jsonb_build_object('quote_id',q.id,'revision',q.revision,'policy_id',q.policy_id));
  result=jsonb_build_object('request_id',req,'job_id',job_id,'status','pending_assignment','quote_id',q.id);
  update public.service_quotes set status='accepted',request_id=req,accepted_at=now(),acceptance_result=result where id=q.id;
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(actor,'pricing.quote.accepted','service_quote',q.id,jsonb_build_object('revision',q.revision,'policyId',q.policy_id,'requestId',req,'jobId',job_id));
  return result;
end; $$;
