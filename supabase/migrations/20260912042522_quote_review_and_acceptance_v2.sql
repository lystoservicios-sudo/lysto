create function private.assert_quote_offerable(p_quote_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare q public.service_quotes%rowtype; policy uuid; value jsonb; route jsonb;
begin
  select * into q from public.service_quotes where id=p_quote_id;
  select c.policy_id,v.policy into policy,value from private.quote_policy_current c left join private.quote_policy_versions v on v.id=c.policy_id where c.singleton for share of c;
  if q.id is null or policy is null or q.policy_id is distinct from policy or q.policy_snapshot is distinct from value
    or value->>'approvedUntil' is null or (value->>'approvedUntil')::date < (now() at time zone 'America/Argentina/Buenos_Aires')::date
    then raise exception using errcode='22023',message='Current approved tariff required'; end if;
  if q.expires_at<=now() or ((q.preferred_date+substring(q.time_window from '^\d{2}:\d{2}')::time) at time zone 'America/Argentina/Buenos_Aires')<=now() then raise exception using errcode='22023',message='Quote expired: recalculate'; end if;
  route=q.quote->'route';
  if q.quote->>'currency' is distinct from 'ARS' or q.quote->>'coverage' is distinct from 'covered'
    or coalesce(route->>'source','') not in ('manual','google') or coalesce(route->>'province','') not in ('CABA','Buenos Aires')
    or coalesce((route->>'outboundMinutes')::numeric,10000)>180
    or coalesce((route->>'tollsVerified')::boolean,false)=false
    or coalesce((q.input->>'materialsConfirmed')::boolean,false)=false
    or route->>'measuredAt' is null or (route->>'measuredAt')::timestamptz<now()-interval '30 minutes' or (route->>'measuredAt')::timestamptz>now()+interval '1 minute'
    or (route->>'source'='manual' and (q.created_by is null or length(trim(coalesce(q.manual_route_reason,'')))<15))
    or q.input->'equipment'->>'capacity' is null or coalesce(q.input->'equipment'->>'technology','unknown') not in ('conventional','inverter')
    or coalesce((q.quote->>'professionalAmount')::numeric,-1)-coalesce((q.quote->>'paymentCostBudget')::numeric,1000000000)<coalesce((q.quote->>'calculatorSubtotal')::numeric,1000000000)
    or coalesce((q.quote->>'platformContribution')::numeric,-1)<0
    then raise exception using errcode='22023',message='Verified complete quote inputs required'; end if;
end; $$;
revoke all on function private.assert_quote_offerable(uuid) from public,anon,authenticated,service_role;

create function private.review_service_quote_v2(p_quote_id uuid,p_expected_version integer,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; q public.service_quotes%rowtype;
begin
  actor=private.lock_admin_mutation('operations');
  if length(trim(coalesce(p_reason,''))) not between 15 and 2000 then raise exception using errcode='22023',message='Document verified scope, costs and exclusions'; end if;
  select * into q from public.service_quotes where id=p_quote_id for update;
  if not found then raise exception using errcode='P0002',message='Quote unavailable'; end if;
  if q.version is distinct from p_expected_version or q.status in ('accepted','superseded') then raise exception using errcode='40001',message='Quote version changed'; end if;
  perform private.assert_quote_offerable(q.id);
  update public.service_quotes set status='ready',reviewed_by=actor,review_reason=trim(p_reason),reviewed_at=now() where id=q.id returning * into q;
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(actor,'pricing.quote.reviewed','service_quote',q.id,jsonb_build_object('version',q.version,'revision',q.revision,'policyId',q.policy_id,'reason',trim(p_reason)));
  return jsonb_build_object('id',q.id,'version',q.version,'status',q.status);
end; $$;
create function public.review_service_quote_v2(p_quote_id uuid,p_expected_version integer,p_reason text) returns jsonb language sql security invoker set search_path='' as $$ select private.review_service_quote_v2(p_quote_id,p_expected_version,p_reason); $$;

create function private.submit_service_quote_v2(p_quote_id uuid,p_expected_version integer) returns jsonb
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
create function public.submit_service_quote_v2(p_quote_id uuid,p_expected_version integer) returns jsonb language sql security invoker set search_path='' as $$ select private.submit_service_quote_v2(p_quote_id,p_expected_version); $$;
revoke all on function public.review_service_quote_v2(uuid,integer,text),private.review_service_quote_v2(uuid,integer,text),public.submit_service_quote_v2(uuid,integer),private.submit_service_quote_v2(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.review_service_quote_v2(uuid,integer,text),private.review_service_quote_v2(uuid,integer,text),public.submit_service_quote_v2(uuid,integer),private.submit_service_quote_v2(uuid,integer) to authenticated;
