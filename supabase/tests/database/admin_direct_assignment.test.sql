-- Transactional verification against the real schema. Every test row is rolled back.
-- No professional session/action, payment provider call, or notification delivery.
begin;
-- Appended only inside a transaction that also rolls back the candidate migration.
-- No Auth rows, existing business rows or remote payment provider are modified.
do $$
declare v_admin jsonb; v_customer jsonb; v_fixture record; v_input jsonb; v_saved jsonb; v_sent jsonb;
  v_summary jsonb; v_confirmed jsonb; v_checkout public.marketplace_checkouts%rowtype;
  v_replayed public.marketplace_checkouts%rowtype; v_q public.service_quotes%rowtype;
  v_event private.outbox_events%rowtype; v_delivery jsonb;
  v_case private.financial_exception_cases%rowtype;
begin
  select jsonb_build_object('sub',u.id,'session_id',s.id,'role','authenticated','aal','aal2','app_metadata',jsonb_build_object('app_role','admin'))
  into v_admin from auth.sessions s join auth.users u on u.id=s.user_id join auth.mfa_factors f on f.id=s.factor_id and f.user_id=u.id
  join public.profiles p on p.auth_user_id=u.id join public.admin_profiles a on a.profile_id=p.id
  where s.aal='aal2' and f.status='verified' and p.role='admin' and (s.not_after is null or s.not_after>now())
    and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
    and exists(select 1 from private.admin_profile_permissions g where g.admin_profile_id=a.id and g.permission='owner') limit 1;
  if v_admin is null then raise exception 'No live owner context for transactional verification'; end if;
  select cp.id as customer_id,a.id as address_id,e.id as equipment_id,pc.category_id,i.id as issue_id,pro.id as professional_id,
    ((day::date+av.start_time) at time zone 'America/Argentina/Buenos_Aires') as starts_at,
    cu.id as customer_user,cs.id as customer_session
  into v_fixture from public.professional_profiles pro
  join public.mp_split_connected_accounts mp on mp.seller_id=pro.id::text and mp.enabled
  join public.professional_service_categories pc on pc.professional_id=pro.id and pc.approved
  join public.service_categories cat on cat.id=pc.category_id and cat.active
  join public.service_issue_types i on i.category_id=cat.id and i.active
  join public.professional_service_zones z on z.professional_id=pro.id and z.active
  join public.professional_availability av on av.professional_id=pro.id and av.active
  join public.customer_addresses a on a.archived_at is null and
    (lower(z.zone_name)=lower(a.city) or lower(z.zone_slug)=regexp_replace(lower(a.city),'[^a-z0-9]+','_','g'))
  join public.customer_profiles cp on cp.id=a.customer_id
  left join public.customer_equipment e on e.customer_id=cp.id and e.address_id=a.id and e.category_id=pc.category_id and e.archived_at is null
  join public.profiles cprof on cprof.id=cp.profile_id
  join auth.users cu on cu.id=cprof.auth_user_id and cu.raw_app_meta_data->>'app_role'='customer'
    and cu.email_confirmed_at is not null and cu.deleted_at is null and (cu.banned_until is null or cu.banned_until<=now())
  join auth.sessions cs on cs.user_id=cu.id and (cs.not_after is null or cs.not_after>now())
  cross join generate_series(private.minimum_customer_visit_date(clock_timestamp()),private.minimum_customer_visit_date(clock_timestamp())+17,interval '1 day') day
  where pro.status='approved' and private.professional_clearance_valid(pro.id)
    and exists(select 1 from public.professional_tools t where t.professional_id=pro.id and t.has_tool)
    and av.weekday=extract(dow from day)::integer and av.end_time-av.start_time>=interval '1 hour'
    and not exists(select 1 from public.professional_absences ab where ab.professional_id=pro.id and tstzrange(ab.starts_at,ab.ends_at,'[)')&&
      tstzrange((day::date+av.start_time) at time zone 'America/Argentina/Buenos_Aires',((day::date+av.start_time) at time zone 'America/Argentina/Buenos_Aires')+interval '1 hour','[)'))
    and not exists(select 1 from public.job_schedule_reservations r where r.professional_id=pro.id and r.state in('hold','confirmed')
      and tstzrange(r.starts_at-r.travel_buffer_minutes*interval '1 minute',r.ends_at+r.travel_buffer_minutes*interval '1 minute','[)')&&
      tstzrange((day::date+av.start_time) at time zone 'America/Argentina/Buenos_Aires',((day::date+av.start_time) at time zone 'America/Argentina/Buenos_Aires')+interval '1 hour','[)'))
  order by day,a.id limit 1;
  if v_fixture.customer_id is null then raise exception 'No eligible live context for transactional verification'; end if;
  if v_fixture.equipment_id is null then
    insert into public.customer_equipment(customer_id,address_id,category_id,nickname)
      values(v_fixture.customer_id,v_fixture.address_id,v_fixture.category_id,'Equipo de verificación transaccional') returning id into v_fixture.equipment_id;
  end if;
  v_customer=jsonb_build_object('sub',v_fixture.customer_user,'session_id',v_fixture.customer_session,'role','authenticated','aal','aal1','app_metadata',jsonb_build_object('app_role','customer'));
  v_input=jsonb_build_object('id',gen_random_uuid(),'expectedVersion',0,'action','draft','customerId',v_fixture.customer_id,
    'addressId',v_fixture.address_id,'equipmentId',v_fixture.equipment_id,'categoryId',v_fixture.category_id,'issueTypeId',v_fixture.issue_id,
    'professionalId',v_fixture.professional_id,'serviceTitle','Verificación transaccional sin persistencia',
    'description','Servicio de comprobación que se revierte en esta misma transacción; no enviar ni cobrar.',
    'startsAt',v_fixture.starts_at,'durationMinutes',60,'travelBufferMinutes',0,'total',100.05,
    'commission',jsonb_build_object('mode','percentage','value',17.5));
  perform set_config('request.jwt.claims',v_admin::text,true);
  v_saved=public.save_admin_service_request(v_input);
  if v_saved->>'state'<>'draft' then raise exception 'Draft not saved'; end if;
  begin perform public.save_admin_service_request(v_input); raise exception 'Stale draft must fail'; exception when serialization_failure then null; end;
  v_input=v_input||jsonb_build_object('action','send','expectedVersion',(v_saved->>'version')::integer);
  begin perform public.save_admin_service_request(v_input||'{"equipmentId":null}'::jsonb);
    raise exception 'A request without equipment must not be sent'; exception when invalid_parameter_value then null; end;
  v_sent=public.save_admin_service_request(v_input);
  if v_sent->>'state'<>'sent' or public.save_admin_service_request(v_input)->>'jobId' is distinct from v_sent->>'jobId' then raise exception 'Send must be idempotent'; end if;
  begin perform public.save_admin_service_request(v_input||'{"total":200}'::jsonb); raise exception 'Sent money must be immutable'; exception when serialization_failure then null; end;
  if exists(select 1 from public.assignment_offers where job_id=(v_sent->>'jobId')::uuid) then
    raise exception 'Administrative dispatch must not create a technician acceptance offer'; end if;
  if not exists(select 1 from public.jobs where id=(v_sent->>'jobId')::uuid and status='confirmed'
      and professional_id=v_fixture.professional_id and automatic_assignment_at is not null and accepted_at is null and assignment_version=1) then
    raise exception 'The technician must be assigned directly without individual acceptance'; end if;
  if not exists(select 1 from public.job_schedule_reservations where job_id=(v_sent->>'jobId')::uuid
      and professional_id=v_fixture.professional_id and state='confirmed' and version=1) then
    raise exception 'Dispatch must reserve the agreed visit'; end if;
  begin perform public.save_admin_service_request(v_input||jsonb_build_object('id',gen_random_uuid(),'expectedVersion',0));
    raise exception 'Concurrent requests must not reserve the same technician and time';
  exception when invalid_parameter_value then
    if sqlerrm<>'professional_ineligible_or_unavailable' then raise; end if;
  end;
  begin
    insert into public.service_requests(customer_id,category_id,issue_type_id,address_id,equipment_id,status,replacement_of_request_id)
      select customer_id,category_id,issue_type_id,address_id,equipment_id,'draft',id from public.service_requests where id=(v_sent->>'requestId')::uuid;
    raise exception 'Direct administrative replacement must retain a reviewable contract';
  exception when invalid_parameter_value then
    if sqlerrm<>'administrative_replacement_requires_new_request' then raise; end if;
  end;
  begin
    perform public.request_professional_replacement((v_sent->>'jobId')::uuid,'Verificar bloqueo de reemplazo anterior al consentimiento',1);
    select * into v_case from private.financial_exception_cases where job_id=(v_sent->>'jobId')::uuid and kind='professional_replacement';
    perform public.resolve_financial_exception(v_case.id,v_case.version,'La solicitud personalizada debe gestionarse con una nueva solicitud administrativa.');
    raise exception 'Manual requests must not lose their contract through a pre-consent replacement';
  exception when invalid_parameter_value then
    if sqlerrm<>'administrative_replacement_requires_new_request' then raise; end if;
  end;
  select * into v_event from private.outbox_events where aggregate_id=(v_sent->>'jobId')::uuid
    and event_type='job.confirmed' and channel='email'
    and recipient_profile_id=(select profile_id from public.customer_profiles where id=v_fixture.customer_id) limit 1;
  if not found then raise exception 'Customer payment-ready email intent must exist'; end if;
  v_delivery=private.outbox_recipient(v_event);
  if v_delivery->'context'->>'audience' is distinct from 'customer'
    or v_delivery->'context'->>'eventType' is distinct from 'job.confirmed'
    or v_delivery->'context'->>'aggregateId' is distinct from v_sent->>'jobId' then
    raise exception 'Customer notification context must be valid before quote acceptance';
  end if;
  perform set_config('request.jwt.claims',v_customer::text,true);
  v_summary=public.get_admin_service_request_for_job((v_sent->>'jobId')::uuid)->'summary';
  if not (v_summary->>'canAccept')::boolean then raise exception 'Sending must immediately enable customer confirmation and payment without technician response'; end if;
  if (public.get_admin_service_request_for_job((v_sent->>'jobId')::uuid)->'savedQuote'->'quote') ? 'platformFee' then raise exception 'Customer quote must hide commission'; end if;
  begin perform private.prepare_marketplace_checkout(v_fixture.customer_id,(v_sent->>'jobId')::uuid,null,false);
    raise exception 'Checkout before customer acceptance must fail'; exception when raise_exception then
      if sqlerrm<>'accepted_quote_required' then raise; end if;
  end;
  begin perform public.accept_admin_service_request((v_sent->>'id')::uuid,(v_sent->>'version')::integer,999,(v_summary->>'scheduleVersion')::integer);
    raise exception 'Stale assignment must fail'; exception when serialization_failure then null; end;
  begin perform public.accept_admin_service_request((v_sent->>'id')::uuid,(v_sent->>'version')::integer,(v_summary->>'assignmentVersion')::integer,999);
    raise exception 'Stale schedule must fail'; exception when serialization_failure then null; end;
  v_confirmed=public.accept_admin_service_request((v_sent->>'id')::uuid,(v_sent->>'version')::integer,(v_summary->>'assignmentVersion')::integer,(v_summary->>'scheduleVersion')::integer);
  if v_confirmed->'summary'->>'acceptedAt' is null then raise exception 'Customer acceptance not recorded'; end if;
  v_checkout=private.prepare_marketplace_checkout(v_fixture.customer_id,(v_sent->>'jobId')::uuid,null,false);
  v_replayed=private.prepare_marketplace_checkout(v_fixture.customer_id,(v_sent->>'jobId')::uuid,null,false);
  if v_checkout.id<>v_replayed.id or v_checkout.amount<>100.05 or v_checkout.marketplace_fee<>17.51 or v_checkout.professional_amount<>82.54 then
    raise exception 'Checkout must pin the exact customized split';
  end if;
  begin update public.jobs set status='technician_on_way' where id=(v_sent->>'jobId')::uuid;
    raise exception 'Visit before payment must fail'; exception when invalid_parameter_value then null; end;
  perform set_config('test.admin_request.checkout',v_checkout.id::text,true);
  perform set_config('test.admin_request.request',v_sent->>'requestId',true);
  select * into v_q from public.service_quotes where request_id=(v_sent->>'requestId')::uuid;
  perform set_config('test.admin_request.quote',v_q.id::text,true);
end $$;
set local role authenticated;
do $$ begin
  if exists(select 1 from public.marketplace_checkouts where id=current_setting('test.admin_request.checkout')::uuid)
    or exists(select 1 from public.price_options where request_id=current_setting('test.admin_request.request')::uuid)
    or exists(select 1 from public.service_quotes where id=current_setting('test.admin_request.quote')::uuid) then
    raise exception 'The customer must not read internal financial snapshots';
  end if;
  if exists(select 1 from jsonb_array_elements(public.read_customer_payment_summaries()->'items') row
    where row ? 'marketplace_fee' or row ? 'professional_amount') then raise exception 'Payment summaries must not expose commissions'; end if;
end $$;
reset role;

rollback;
select 'direct assignment and customer checkout verified; all test rows rolled back' as verification;
