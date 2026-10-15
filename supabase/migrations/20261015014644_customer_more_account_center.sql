-- Más: customer-owned preferences, real Auth sessions and auditable privacy requests.
-- No account/customer/payment deletion and no change to historical financial data.
alter table public.customer_contact_preferences
  add column email_support_updates boolean not null default true,
  add column reduce_motion boolean not null default false,
  add column version integer not null default 0 check(version>=0);
grant select(email_support_updates,reduce_motion,version) on public.customer_contact_preferences to authenticated;

create table public.customer_account_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customer_profiles(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  session_id uuid not null,
  idempotency_key uuid not null,
  support_case_id uuid not null unique references public.complaints(id) on delete restrict,
  pending_snapshot jsonb not null check(jsonb_typeof(pending_snapshot)='object'),
  created_at timestamptz not null default clock_timestamp()
);
create index customer_privacy_requested_by_idx on public.customer_account_privacy_requests(requested_by);
alter table public.customer_account_privacy_requests enable row level security;
revoke all on public.customer_account_privacy_requests from public,anon,authenticated,service_role;
grant select(id,customer_id,support_case_id,created_at) on public.customer_account_privacy_requests to authenticated;
create policy customer_privacy_owner_read on public.customer_account_privacy_requests
  for select to authenticated using(customer_id=(select private.current_customer_id()));

create table private.customer_account_reauth_receipts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '5 minutes',
  consumed_at timestamptz
);
create index customer_account_reauth_user_idx on private.customer_account_reauth_receipts(auth_user_id);
create index customer_account_reauth_session_idx on private.customer_account_reauth_receipts(session_id);
alter table private.customer_account_reauth_receipts enable row level security;
alter table private.customer_account_reauth_receipts force row level security;
revoke all on private.customer_account_reauth_receipts from public,anon,authenticated,service_role;

-- One authority lock order for all account functions prevents parallel device
-- revocation from racing sensitive writes or deadlocking opposite sessions.
create function private.require_customer_account() returns uuid
language plpgsql security definer set search_path='' as $$
declare v_customer uuid;
begin
  perform 1 from auth.users where id=auth.uid() for update;
  if not found then raise exception using errcode='42501',message='customer_session_required';end if;
  perform 1 from auth.sessions where id=private.current_session_id() and user_id=auth.uid() for share;
  if not found or not coalesce(private.current_session_active(true),false) then
    raise exception using errcode='42501',message='customer_session_required';end if;
  v_customer:=private.current_customer_id();
  if v_customer is null then raise exception using errcode='42501',message='customer_required';end if;
  return v_customer;
end;$$;

create function private.read_customer_preferences() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_customer uuid:=private.require_customer_account();v_pref public.customer_contact_preferences%rowtype;
begin
  select * into v_pref from public.customer_contact_preferences where customer_id=v_customer;
  return jsonb_build_object('essentialEmail',true,'preferences',jsonb_build_object(
    'version',coalesce(v_pref.version,0),'emailMaintenance',coalesce(v_pref.email_enabled,true),
    'emailSupportUpdates',coalesce(v_pref.email_support_updates,true),
    'marketingEmail',coalesce(v_pref.commercial_reminders_enabled,false),'reduceMotion',coalesce(v_pref.reduce_motion,false)));
end;$$;
create function public.read_customer_preferences() returns jsonb language sql security invoker set search_path='' as $$select private.read_customer_preferences();$$;

create function private.write_customer_preferences(p_expected_version integer,p_email_maintenance boolean,p_email_support_updates boolean,p_marketing_email boolean,p_reduce_motion boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_customer uuid:=private.require_customer_account();v_version integer;
begin
  if p_expected_version is null or p_expected_version<0 or p_email_maintenance is null or p_email_support_updates is null or p_marketing_email is null or p_reduce_motion is null then
    raise exception using errcode='22023',message='invalid_preferences';end if;
  insert into public.customer_contact_preferences(customer_id) values(v_customer) on conflict(customer_id) do nothing;
  select version into v_version from public.customer_contact_preferences where customer_id=v_customer for update;
  if v_version<>p_expected_version then raise exception using errcode='PT409',message='preferences_version_conflict';end if;
  update public.customer_contact_preferences set email_enabled=p_email_maintenance,
    email_support_updates=p_email_support_updates,commercial_reminders_enabled=p_marketing_email,
    reduce_motion=p_reduce_motion,version=version+1,updated_at=clock_timestamp() where customer_id=v_customer;
  return private.read_customer_preferences();
end;$$;
create function public.write_customer_preferences(p_expected_version integer,p_email_maintenance boolean,p_email_support_updates boolean,p_marketing_email boolean,p_reduce_motion boolean) returns jsonb
language sql security invoker set search_path='' as $$select private.write_customer_preferences(p_expected_version,p_email_maintenance,p_email_support_updates,p_marketing_email,p_reduce_motion);$$;

create function private.list_customer_account_sessions() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_customer_account();
  return (select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'current',s.id=private.current_session_id(),
    'createdAt',s.created_at,'lastSeenAt',coalesce(s.refreshed_at at time zone 'UTC',s.updated_at),
    'device',(case when s.user_agent ilike '%Edg/%' then 'Edge' when s.user_agent ilike '%Firefox/%' then 'Firefox' when s.user_agent ilike '%Chrome/%' then 'Chrome' when s.user_agent ilike '%Safari/%' then 'Safari' else 'Navegador' end)||' · '||
      (case when s.user_agent ilike '%Android%' then 'Android' when s.user_agent ilike '%iPhone%' or s.user_agent ilike '%iPad%' then 'iOS' when s.user_agent ilike '%Windows%' then 'Windows' when s.user_agent ilike '%Macintosh%' then 'macOS' when s.user_agent ilike '%Linux%' then 'Linux' else 'Dispositivo' end))
    order by (s.id=private.current_session_id()) desc,s.created_at desc),'[]'::jsonb)
    from auth.sessions s where s.user_id=auth.uid() and (s.not_after is null or s.not_after>now()));
end;$$;
create function public.list_customer_account_sessions() returns jsonb language sql security invoker set search_path='' as $$select private.list_customer_account_sessions();$$;

create function private.revoke_customer_account_sessions(p_session_id uuid,p_all_others boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  perform private.require_customer_account();
  if p_all_others is null or (p_all_others and p_session_id is not null) or (not p_all_others and (p_session_id is null or p_session_id=private.current_session_id())) then
    raise exception using errcode='22023',message='invalid_session_revocation';end if;
  if not p_all_others and not exists(select 1 from auth.sessions where id=p_session_id and user_id=auth.uid()) then
    raise exception using errcode='P0002',message='session_not_found';end if;
  -- Supabase Auth's refresh-token FK cascades. Existing JWTs also immediately
  -- fail the app's current_session_active guard after removal of this row.
  delete from auth.sessions where user_id=auth.uid() and id<>private.current_session_id()
    and (p_all_others or id=p_session_id);
  get diagnostics v_count=row_count;
  return jsonb_build_object('revoked',v_count);
end;$$;
create function public.revoke_customer_account_sessions(p_session_id uuid,p_all_others boolean) returns jsonb language sql security invoker set search_path='' as $$select private.revoke_customer_account_sessions(p_session_id,p_all_others);$$;

-- This is a server-only attestation after a real Auth password check. A browser
-- can neither create receipts nor choose a different authenticated customer.
create function private.issue_customer_account_reauth(p_auth_user_id uuid,p_session_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_receipt uuid;
begin
  perform 1 from auth.users u where u.id=p_auth_user_id for update;
  perform 1 from auth.sessions s where s.id=p_session_id and s.user_id=p_auth_user_id for share;
  if not found or not private.session_is_active(p_auth_user_id,p_session_id)
    or not exists(select 1 from auth.users u join public.profiles p on p.auth_user_id=u.id join public.customer_profiles c on c.profile_id=p.id
      where u.id=p_auth_user_id and u.raw_app_meta_data->>'app_role'='customer' and p.role='customer') then
    raise exception using errcode='42501',message='customer_session_required';end if;
  insert into private.customer_account_reauth_receipts(auth_user_id,session_id) values(p_auth_user_id,p_session_id) returning id into v_receipt;
  return jsonb_build_object('receiptId',v_receipt);
end;$$;
create function public.issue_customer_account_reauth(p_auth_user_id uuid,p_session_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.issue_customer_account_reauth(p_auth_user_id,p_session_id);$$;

create function private.customer_account_pending(p_customer uuid) returns jsonb
language sql security definer set search_path='' as $$
  select jsonb_build_object('jobs',(select count(*) from public.jobs j where j.customer_id=p_customer and j.status::text not in('completed','cancelled','cancelled_by_customer','cancelled_by_professional','cancelled_by_admin')),
    'payments',(select count(*) from (
      select c.id from public.marketplace_checkouts c where c.customer_id=p_customer and c.status in('creating','ready','pending','in_process','review')
      union all
      select p.id from public.payments p where p.customer_id=p_customer and p.status::text in('pending','in_process','authorized','in_mediation')
        and not exists(select 1 from public.marketplace_checkouts c where c.customer_id=p_customer and c.job_id=p.job_id)
    ) outstanding));
$$;
create function private.read_customer_account_privacy() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_customer uuid:=private.require_customer_account();v_request jsonb;
begin
  select jsonb_build_object('id',r.id,'status',case when c.status in('resolved','rejected') then 'closed' when c.status='open' then 'requested' else 'in_review' end,
    'createdAt',r.created_at,'supportCaseId',r.support_case_id) into v_request
    from public.customer_account_privacy_requests r join public.complaints c on c.id=r.support_case_id where r.customer_id=v_customer;
  return jsonb_build_object('request',v_request,'pending',private.customer_account_pending(v_customer));
end;$$;
create function public.read_customer_account_privacy() returns jsonb language sql security invoker set search_path='' as $$select private.read_customer_account_privacy();$$;

create function private.request_customer_account_deletion(p_idempotency_key uuid,p_receipt_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_customer uuid:=private.require_customer_account();v_receipt private.customer_account_reauth_receipts%rowtype;v_case jsonb;v_pending jsonb;
begin
  if p_idempotency_key is null or p_receipt_id is null then raise exception using errcode='22023',message='confirmation_required';end if;
  select * into v_receipt from private.customer_account_reauth_receipts where id=p_receipt_id and auth_user_id=auth.uid() and session_id=private.current_session_id() for update;
  if not found or v_receipt.expires_at<=clock_timestamp() or v_receipt.consumed_at is not null then
    raise exception using errcode='42501',message='recent_password_verification_required';end if;
  update private.customer_account_reauth_receipts set consumed_at=clock_timestamp() where id=v_receipt.id;
  if exists(select 1 from public.customer_account_privacy_requests where customer_id=v_customer) then return private.read_customer_account_privacy();end if;
  v_pending:=private.customer_account_pending(v_customer);
  v_case:=public.open_support_case(null,'other','Solicito la eliminación de mi cuenta y el tratamiento de mis datos personales. Entiendo que el equipo revisará las operaciones pendientes y la conservación legal de los registros.',false,false,false,'{}'::uuid[],p_idempotency_key);
  insert into public.customer_account_privacy_requests(customer_id,requested_by,session_id,idempotency_key,support_case_id,pending_snapshot)
    values(v_customer,private.current_profile_id(),private.current_session_id(),p_idempotency_key,(v_case->>'id')::uuid,v_pending);
  return private.read_customer_account_privacy();
end;$$;
create function public.request_customer_account_deletion(p_idempotency_key uuid,p_receipt_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.request_customer_account_deletion(p_idempotency_key,p_receipt_id);$$;

-- All fields below are deliberately enumerated. No auth token/password/session
-- row, service internal note, provider raw payload or seller credential leaves.
create function private.export_customer_account() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_customer uuid:=private.require_customer_account();v_profile uuid:=private.current_profile_id();
begin
  return jsonb_build_object('schemaVersion',1,'exportedAt',clock_timestamp(),
    'profile',(select jsonb_build_object('id',p.id,'firstName',p.first_name,'lastName',p.last_name,'email',p.email,'phone',p.phone,'createdAt',p.created_at) from public.profiles p where p.id=v_profile),
    'addresses',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'street',a.street,'number',a.number,'floor',a.floor,'apartment',a.apartment,'city',a.city,'province',a.province,'postalCode',a.postal_code,'reference',a.reference,'propertyType',a.property_type,'createdAt',a.created_at,'archivedAt',a.archived_at) order by a.created_at),'[]'::jsonb) from public.customer_addresses a where a.customer_id=v_customer),
    'homes',(select coalesce(jsonb_agg(private.customer_home_document(h.id)||jsonb_build_object('archivedAt',h.archived_at) order by h.created_at),'[]'::jsonb) from public.customer_homes h where h.customer_id=v_customer),
    'equipment',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'addressId',e.address_id,'nickname',e.nickname,'brand',e.brand,'model',e.model,'type',e.equipment_type,'frigorias',e.frigorias,'serialNumber',e.serial_number,'createdAt',e.created_at,'archivedAt',e.archived_at) order by e.created_at),'[]'::jsonb) from public.customer_equipment e where e.customer_id=v_customer),
    'serviceRequests',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'status',r.status,'categoryId',r.category_id,'issueTypeId',r.issue_type_id,'equipmentId',r.equipment_id,'addressId',r.address_id,'preferredDate',r.preferred_date,'preferredTimeWindow',r.preferred_time_window,'urgency',r.urgency_level,'createdAt',r.created_at) order by r.created_at),'[]'::jsonb) from public.service_requests r where r.customer_id=v_customer),
    'requestAnswers',(select coalesce(jsonb_agg(jsonb_build_object('requestId',a.request_id,'question',a.question_code,'answer',a.answer_value,'details',a.answer_json)),'[]'::jsonb) from public.request_answers a join public.service_requests r on r.id=a.request_id where r.customer_id=v_customer),
    'jobs',(select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'requestId',j.request_id,'status',j.status,'scheduledDate',j.scheduled_date,'scheduledTimeWindow',j.scheduled_time_window,'finalAmount',j.final_amount,'warrantyUntil',j.warranty_until,'completedAt',j.completed_at,'createdAt',j.created_at) order by j.created_at),'[]'::jsonb) from public.jobs j where j.customer_id=v_customer),
    'payments',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'jobId',p.job_id,'requestId',p.request_id,'provider',p.provider,'providerPaymentId',p.provider_payment_id,'amount',p.amount,'currency',p.currency,'status',p.status,'type',p.payment_type,'createdAt',p.created_at) order by p.created_at),'[]'::jsonb) from public.payments p where p.customer_id=v_customer),
    'serviceReports',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'jobId',r.job_id,'equipmentId',r.equipment_id,'diagnosis',r.real_diagnosis,'workDone',r.work_done,'partsUsed',r.parts_used,'finalState',r.final_state,'maintenance',r.maintenance_option,'nextMaintenanceDate',r.next_maintenance_date,'warrantyDays',r.warranty_days,'createdAt',r.created_at) order by r.created_at),'[]'::jsonb) from public.job_final_reports r join public.jobs j on j.id=r.job_id where j.customer_id=v_customer),
    'warrantyClaims',(select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'jobId',w.job_id,'status',w.status,'description',w.description,'coverageUntil',w.coverage_until,'coverageEligible',w.coverage_eligible,'createdAt',w.created_at) order by w.created_at),'[]'::jsonb) from public.warranty_claims w where w.customer_id=v_customer),
    'maintenancePlans',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'equipmentId',m.equipment_id,'sourceJobId',m.source_job_id,'recommendation',m.recommendation,'dueDate',m.due_date,'status',m.status,'createdAt',m.created_at) order by m.created_at),'[]'::jsonb) from public.maintenance_plans m where m.customer_id=v_customer),
    'supportCases',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'jobId',c.job_id,'category',c.category,'status',c.status,'description',c.description,'publicResolution',c.public_resolution,'createdAt',c.created_at,
      'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'type',e.event_type,'message',e.public_message,'createdAt',e.created_at) order by e.created_at),'[]'::jsonb) from public.support_case_events e where e.case_id=c.id)) order by c.created_at),'[]'::jsonb) from public.complaints c where c.customer_id=v_customer),
    'reviews',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'jobId',r.job_id,'serviceRating',r.service_rating,'professionalRating',r.professional_rating,'problemResolved',r.problem_resolved,'wouldHireAgain',r.would_hire_again,'comment',r.comment,'createdAt',r.created_at) order by r.created_at),'[]'::jsonb) from public.reviews r where r.customer_id=v_customer),
    'preferences',private.read_customer_preferences()->'preferences',
    'privacyRequests',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'supportCaseId',r.support_case_id,'createdAt',r.created_at)),'[]'::jsonb) from public.customer_account_privacy_requests r where r.customer_id=v_customer));
end;$$;
create function public.export_customer_account() returns jsonb language sql security invoker set search_path='' as $$select private.export_customer_account();$$;

create function private.customer_outbox_email_allowed(p_event_id uuid,p_claim_token uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_event private.outbox_events%rowtype;v_customer uuid;v_pref public.customer_contact_preferences%rowtype;
begin
  select * into v_event from private.outbox_events where id=p_event_id for share;
  if not found or v_event.claim_token is distinct from p_claim_token or p_claim_token is null
    or v_event.locked_until<=clock_timestamp() or v_event.processed_at is not null or v_event.dead_lettered_at is not null or v_event.channel<>'email' then
    raise exception using errcode='PT409',message='notification_lease_expired';end if;
  -- Reuse the canonical account/aggregate ownership and recipient validation;
  -- the boolean preference check must not legitimize a stale/mismatched event.
  perform private.outbox_recipient(v_event);
  select id into v_customer from public.customer_profiles where profile_id=v_event.recipient_profile_id;
  if v_customer is null then return true;end if;
  select * into v_pref from public.customer_contact_preferences where customer_id=v_customer;
  -- Transactional visit, payment and security notices cannot be disabled.
  if v_event.event_type like 'support.%' then
    if v_event.aggregate_type='complaint' and exists(select 1 from public.complaints c where c.id=v_event.aggregate_id and c.customer_id=v_customer and (c.category in('payment','safety') or c.severity='critical')) then return true;end if;
    return coalesce(v_pref.email_support_updates,true);
  elsif v_event.event_type like 'maintenance.%' then return coalesce(v_pref.email_enabled,true);
  elsif v_event.event_type like 'marketing.%' then return coalesce(v_pref.commercial_reminders_enabled,false);
  end if;
  return true;
end;$$;
create function public.customer_outbox_email_allowed(p_event_id uuid,p_claim_token uuid) returns boolean language sql security invoker set search_path='' as $$select private.customer_outbox_email_allowed(p_event_id,p_claim_token);$$;

revoke all on function private.require_customer_account(),private.customer_account_pending(uuid) from public,anon,authenticated,service_role;
revoke all on function private.read_customer_preferences(),public.read_customer_preferences(),
  private.write_customer_preferences(integer,boolean,boolean,boolean,boolean),public.write_customer_preferences(integer,boolean,boolean,boolean,boolean),
  private.list_customer_account_sessions(),public.list_customer_account_sessions(),
  private.revoke_customer_account_sessions(uuid,boolean),public.revoke_customer_account_sessions(uuid,boolean),
  private.read_customer_account_privacy(),public.read_customer_account_privacy(),
  private.request_customer_account_deletion(uuid,uuid),public.request_customer_account_deletion(uuid,uuid),
  private.export_customer_account(),public.export_customer_account() from public,anon,authenticated,service_role;
grant execute on function private.read_customer_preferences(),public.read_customer_preferences(),
  private.write_customer_preferences(integer,boolean,boolean,boolean,boolean),public.write_customer_preferences(integer,boolean,boolean,boolean,boolean),
  private.list_customer_account_sessions(),public.list_customer_account_sessions(),
  private.revoke_customer_account_sessions(uuid,boolean),public.revoke_customer_account_sessions(uuid,boolean),
  private.read_customer_account_privacy(),public.read_customer_account_privacy(),
  private.request_customer_account_deletion(uuid,uuid),public.request_customer_account_deletion(uuid,uuid),
  private.export_customer_account(),public.export_customer_account() to authenticated;
revoke all on function private.issue_customer_account_reauth(uuid,uuid),public.issue_customer_account_reauth(uuid,uuid),
  private.customer_outbox_email_allowed(uuid,uuid),public.customer_outbox_email_allowed(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.issue_customer_account_reauth(uuid,uuid),public.issue_customer_account_reauth(uuid,uuid),
  private.customer_outbox_email_allowed(uuid,uuid),public.customer_outbox_email_allowed(uuid,uuid) to service_role;
