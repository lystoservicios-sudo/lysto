alter table public.service_quotes add column upload_intent_ids uuid[] not null default '{}';
create function private.validate_quote_uploads(p_customer_id uuid,p_ids uuid[],p_request_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare item private.upload_intents%rowtype; verified integer=0; draft uuid;
begin
  if p_ids is null or cardinality(p_ids)>5 or exists(select 1 from unnest(p_ids) v group by v having count(*)>1) then raise exception using errcode='22023',message='Select up to five distinct photos'; end if;
  for item in select i.* from private.upload_intents i join private.request_upload_drafts d on d.id=i.draft_id
    join public.customer_profiles c on c.id=d.customer_id and c.profile_id=d.owner_profile_id
    where i.id=any(p_ids) and c.id=p_customer_id and i.owner_profile_id=d.owner_profile_id and i.status='verified' and i.kind='request-photo'
      and (i.entity_id is null or i.entity_id=p_request_id) and (d.request_id is null or d.request_id=p_request_id)
    order by i.id for share of i,d loop
    if draft is not null and draft<>item.draft_id then raise exception using errcode='22023',message='Photos must belong to one request draft'; end if;
    draft=item.draft_id;
    perform 1 from storage.objects where bucket_id=item.output_bucket and name=item.output_path for share;
    if not found then raise exception using errcode='22023',message='Verified photo object unavailable'; end if;
    verified=verified+1;
  end loop;
  if verified<>cardinality(p_ids) then raise exception using errcode='42501',message='Customer verified photos required'; end if;
end; $$;
create function private.attach_quote_uploads(p_quote_id uuid,p_request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare q public.service_quotes%rowtype; item private.upload_intents%rowtype;
begin
  select * into q from public.service_quotes where id=p_quote_id;
  perform private.validate_quote_uploads(q.customer_id,q.upload_intent_ids,p_request_id);
  for item in select * from private.upload_intents where id=any(q.upload_intent_ids) order by id for update loop
    update private.request_upload_drafts set request_id=p_request_id where id=item.draft_id;
    update private.upload_intents set entity_id=p_request_id where id=item.id;
    insert into public.request_media(id,request_id,media_type,storage_bucket,storage_path,uploaded_by)
      values(item.id,p_request_id,'photo',item.output_bucket,item.output_path,item.owner_profile_id);
  end loop;
end; $$;
create function private.protect_quote_upload_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
  if new.upload_intent_ids is distinct from old.upload_intent_ids then raise exception using errcode='42501',message='Quote photo snapshot is immutable'; end if;
  return new;
end; $$;
create trigger service_quotes_photos_immutable before update on public.service_quotes for each row execute function private.protect_quote_upload_snapshot();
revoke all on function private.validate_quote_uploads(uuid,uuid[],uuid),private.attach_quote_uploads(uuid,uuid),private.protect_quote_upload_snapshot() from public,anon,authenticated,service_role;

create or replace function private.persist_calculated_quote(p_actor_user_id uuid,p_actor_session_id uuid,p_customer_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; actor_role text; session_aal text; old_claims text; q public.service_quotes%rowtype; policy uuid; value jsonb;
  new_id uuid=gen_random_uuid(); root_id uuid; revision_number integer=1; prior uuid; selected_photos uuid[];
begin
  perform pg_advisory_xact_lock(537975841827451329::bigint);
  select u.raw_app_meta_data->>'app_role',s.aal::text into actor_role,session_aal
    from auth.sessions s join auth.users u on u.id=s.user_id where s.id=p_actor_session_id and u.id=p_actor_user_id for share of s,u;
  if not found or not private.session_is_active(p_actor_user_id,p_actor_session_id) or actor_role not in ('customer','admin') then raise exception using errcode='42501',message='Current session required'; end if;
  old_claims=current_setting('request.jwt.claims',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor_user_id,'session_id',p_actor_session_id,'aal',session_aal,'app_metadata',jsonb_build_object('app_role',actor_role))::text,true);
  actor=case when actor_role='admin' then private.lock_admin_mutation('operations') else private.current_profile_id() end;
  if actor is null or (actor_role='customer' and p_customer_id is distinct from private.current_customer_id()) then raise exception using errcode='42501',message='Quote customer authority required'; end if;
  perform 1 from public.customer_profiles cp join public.profiles p on p.id=cp.profile_id join auth.users u on u.id=p.auth_user_id
    where cp.id=p_customer_id and p.role='customer' and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()) for share of cp,p,u;
  if not found then raise exception using errcode='42501',message='Active customer required'; end if;
  select c.policy_id,v.policy into policy,value from private.quote_policy_current c left join private.quote_policy_versions v on v.id=c.policy_id where c.singleton for share of c;
  if (p_payload->>'policyId')::uuid is distinct from policy or (policy is not null and p_payload->'policySnapshot' is distinct from value) then raise exception using errcode='40001',message='Policy changed while calculating'; end if;
  if p_payload->'quote'->>'currency' is distinct from 'ARS' or jsonb_typeof(p_payload->'policySnapshot') is distinct from 'object'
    or (policy is null and p_payload->'policySnapshot'->>'approvedUntil' is not null)
    or p_payload->'quote'->>'version' is distinct from p_payload->'policySnapshot'->>'version'
    or (p_payload->>'expiresAt')::timestamptz<=now()
    or ((p_payload->>'preferredDate')::date+substring(p_payload->>'timeWindow' from '^\d{2}:\d{2}')::time) at time zone 'America/Argentina/Buenos_Aires'<=now()
    then raise exception using errcode='22023',message='Invalid calculated quote'; end if;
  if p_payload->'input'->'route'->>'source'='manual' and (actor_role<>'admin' or length(trim(coalesce(p_payload->>'manualRouteReason',''))) not between 15 and 2000) then raise exception using errcode='22023',message='Attributed manual route required'; end if;
  select coalesce(array_agg(value::uuid),'{}'::uuid[]) into selected_photos from jsonb_array_elements_text(coalesce(p_payload->'uploadIntentIds','[]'::jsonb));
  prior=(p_payload->>'previousQuoteId')::uuid;
  if prior is not null then
    if actor_role<>'admin' then raise exception using errcode='42501',message='Operations revision required'; end if;
    select * into q from public.service_quotes where id=prior and customer_id=p_customer_id for update;
    if not found then raise exception using errcode='P0002',message='Quote unavailable'; end if;
    if q.version is distinct from (p_payload->>'expectedVersion')::integer or q.status in ('accepted','superseded') then raise exception using errcode='40001',message='Quote version changed'; end if;
    if length(trim(coalesce(p_payload->>'revisionReason',''))) not between 15 and 2000 then raise exception using errcode='22023',message='Revision reason required'; end if;
    if cardinality(selected_photos)>0 then raise exception using errcode='22023',message='A revision inherits its customer photo snapshot'; end if;
    selected_photos=q.upload_intent_ids;
    root_id=coalesce(q.root_quote_id,q.id);revision_number=q.revision+1;
    update public.service_quotes set status='superseded' where id=q.id;
  else root_id=new_id; end if;
  perform private.validate_quote_uploads(p_customer_id,selected_photos);
  insert into public.service_quotes(id,customer_id,address,input,quote,preferred_date,time_window,status,expires_at,root_quote_id,previous_quote_id,revision,created_by,revision_reason,manual_route_reason,policy_id,policy_snapshot,upload_intent_ids)
    values(new_id,p_customer_id,p_payload->'address',p_payload->'input',p_payload->'quote',(p_payload->>'preferredDate')::date,p_payload->>'timeWindow','needs_review',(p_payload->>'expiresAt')::timestamptz,root_id,prior,revision_number,actor,p_payload->>'revisionReason',p_payload->>'manualRouteReason',policy,p_payload->'policySnapshot',selected_photos);
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(actor,'pricing.quote.calculated','service_quote',new_id,jsonb_build_object('revision',revision_number,'previousQuoteId',prior,'policyId',policy,'reason',p_payload->>'revisionReason','manualRouteReason',p_payload->>'manualRouteReason'));
  perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
  return jsonb_build_object('id',new_id,'revision',revision_number,'version',1,'status','needs_review');
end; $$;

create or replace function private.assert_quote_offerable(p_quote_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare q public.service_quotes%rowtype; policy uuid; value jsonb; route jsonb;
begin
  select * into q from public.service_quotes where id=p_quote_id;
  select c.policy_id,v.policy into policy,value from private.quote_policy_current c left join private.quote_policy_versions v on v.id=c.policy_id where c.singleton for share of c;
  if q.id is null or policy is null or q.policy_id is distinct from policy or q.policy_snapshot is distinct from value
    or value->>'approvedUntil' is null or (value->>'approvedUntil')::date < (now() at time zone 'America/Argentina/Buenos_Aires')::date
    then raise exception using errcode='22023',message='Current approved tariff required'; end if;
  if q.expires_at<=now() or ((q.preferred_date+substring(q.time_window from '^\d{2}:\d{2}')::time) at time zone 'America/Argentina/Buenos_Aires')<=now() then raise exception using errcode='22023',message='Quote expired: recalculate'; end if;
  perform private.validate_quote_uploads(q.customer_id,q.upload_intent_ids);
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
