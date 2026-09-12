insert into public.platform_settings(key,value,description)
values
  ('support.sla_minutes','{"critical":10,"high":30,"medium":120,"low":1440}'::jsonb,'Plazos operativos configurables; D02/D06 deben ratificarlos antes del lanzamiento.'),
  ('support.business_hours','{"timezone":"America/Argentina/Buenos_Aires","weekdays":[1,2,3,4,5],"start":"09:00","end":"18:00"}'::jsonb,'Horario usado para informar el vencimiento; hasta D02/D06 no implica atención 24/7.')
on conflict(key) do nothing;

alter table public.complaints drop constraint if exists complaints_status_check;
alter table public.complaints drop constraint if exists complaints_source_check;
alter table public.complaints
  add constraint complaints_status_check check(status in('open','in_review','waiting_customer','waiting_professional','resolved','rejected')),
  add constraint complaints_source_check check(source in('operator','customer','professional','customer_dispute','review_quality','warranty')),
  add column category text not null default 'other' check(category in('delay','payment','quality','safety','warranty','other')),
  add column opened_by uuid references public.profiles(id),
  add column assigned_to uuid references public.profiles(id),
  add column due_at timestamptz,
  add column policy_snapshot jsonb not null default '{}'::jsonb check(jsonb_typeof(policy_snapshot)='object'),
  add column evidence_ids uuid[] not null default '{}',
  add column public_resolution text,
  add column resolved_at timestamptz,
  add column version integer not null default 1 check(version>0),
  add column last_communication_failed_at timestamptz;
update public.complaints set category=case when source in('customer_dispute','review_quality') then 'quality' when source='warranty' then 'warranty' else category end;
update public.complaints set opened_by=coalesce(opened_by,(select jse.actor_profile_id from public.job_status_events jse where jse.job_id=complaints.job_id and jse.actor_profile_id is not null order by jse.created_at limit 1));
create index complaints_operational_queue on public.complaints(status,severity,due_at,created_at);
create function private.normalize_complaint_category() returns trigger language plpgsql set search_path='' as $$begin new.category=case when new.source in('customer_dispute','review_quality') then 'quality' when new.source='warranty' then 'warranty' else new.category end;return new;end;$$;
create trigger complaints_normalize_category before insert on public.complaints for each row execute function private.normalize_complaint_category();

alter table public.warranty_claims drop constraint if exists warranty_claims_status_check;
alter table public.warranty_claims
  add constraint warranty_claims_status_check check(status in('open','in_review','approved','rejected','completed')),
  add column complaint_id uuid unique references public.complaints(id) on delete restrict,
  add column coverage_until date,
  add column coverage_eligible boolean not null default false,
  add column same_problem boolean not null default false,
  add column decision_reason text,
  add column decided_at timestamptz,
  add column revisit_job_id uuid unique references public.jobs(id),
  add column version integer not null default 1 check(version>0),
  add column idempotency_key uuid,
  add column submission_fingerprint text;
create unique index warranty_claim_customer_command on public.warranty_claims(customer_id,idempotency_key) where idempotency_key is not null;
create unique index warranty_claim_one_per_job on public.warranty_claims(job_id);

create table public.support_case_events(
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.complaints(id) on delete cascade,
  event_type text not null check(event_type in('opened','assigned','status_changed','public_response','internal_note','evidence_added','communication_failed','reopened','warranty_decided','revisit_created')),
  from_status text,
  to_status text,
  public_message text,
  internal_note text,
  evidence_ids uuid[] not null default '{}',
  actor_profile_id uuid not null references public.profiles(id),
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default clock_timestamp(),
  check(public_message is null or length(trim(public_message)) between 2 and 3000),
  check(internal_note is null or length(trim(internal_note)) between 2 and 3000)
);
create index support_case_events_timeline on public.support_case_events(case_id,created_at,id);
alter table public.support_case_events enable row level security;
revoke all on public.support_case_events from public,anon,authenticated,service_role;
grant select(id,case_id,event_type,from_status,to_status,public_message,evidence_ids,actor_profile_id,metadata,created_at) on public.support_case_events to authenticated;
create policy support_case_events_participant_read on public.support_case_events for select to authenticated using(
  exists(select 1 from public.complaints c where c.id=case_id and (
    c.customer_id=private.current_customer_id() or c.professional_id=private.current_professional_id(false)
    or private.has_admin_permission('operations') or private.has_admin_permission('quality') or private.has_admin_permission('finance')
  ))
);

create table private.support_case_commands(
  actor_profile_id uuid not null references public.profiles(id),
  idempotency_key uuid not null,
  fingerprint text not null check(length(fingerprint)=64),
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(actor_profile_id,idempotency_key)
);
alter table private.support_case_commands enable row level security;
alter table private.support_case_commands force row level security;
revoke all on private.support_case_commands from public,anon,authenticated,service_role;

create function private.support_due_at(p_minutes integer,p_now timestamptz default clock_timestamp()) returns timestamptz
language sql stable set search_path='' as $$
  select case when extract(isodow from p_now at time zone 'America/Argentina/Buenos_Aires') in(6,7)
    then date_trunc('week',p_now at time zone 'America/Argentina/Buenos_Aires')+interval '7 days 9 hours'+make_interval(mins=>p_minutes)
    else p_now+make_interval(mins=>p_minutes) end;
$$;

create function private.support_case_visible(p_case public.complaints) returns boolean language sql stable set search_path='' as $$
  select p_case.customer_id=private.current_customer_id()
    or p_case.professional_id=private.current_professional_id(false)
    or private.has_admin_permission('operations') or private.has_admin_permission('quality')
    or (p_case.category='payment' and private.has_admin_permission('finance'));
$$;

drop policy if exists complaints_customer_read on public.complaints;
drop policy if exists complaints_professional_read on public.complaints;
drop policy if exists complaints_quality_read on public.complaints;
drop policy if exists complaints_quality_update on public.complaints;
create policy complaints_participant_read on public.complaints for select to authenticated using(private.support_case_visible(complaints));
revoke insert,update,delete on public.complaints from authenticated;
grant select(id,job_id,customer_id,professional_id,status,severity,description,category,opened_by,assigned_to,due_at,policy_snapshot,evidence_ids,public_resolution,resolved_at,version,source,created_at,updated_at) on public.complaints to authenticated;

drop policy if exists warranty_claims_customer_read on public.warranty_claims;
drop policy if exists warranty_claims_professional_read on public.warranty_claims;
drop policy if exists warranty_claims_quality_read on public.warranty_claims;
drop policy if exists warranty_claims_quality_update on public.warranty_claims;
create policy warranty_claims_participant_read on public.warranty_claims for select to authenticated using(
  customer_id=private.current_customer_id() or exists(select 1 from public.jobs j where j.id=job_id and j.professional_id=private.current_professional_id(false))
  or private.has_admin_permission('quality') or private.has_admin_permission('operations')
);
revoke insert,update,delete on public.warranty_claims from authenticated;
grant select(id,job_id,customer_id,status,description,resolution,complaint_id,coverage_until,coverage_eligible,same_problem,decision_reason,decided_at,revisit_job_id,created_at,updated_at) on public.warranty_claims to authenticated;

create function public.open_support_case(p_job_id uuid,p_category text,p_description text,p_has_safety_risk boolean,p_payment_blocked boolean,p_customer_waiting boolean,p_evidence_ids uuid[],p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.current_profile_id();v_customer uuid:=private.current_customer_id();v_professional uuid:=private.current_professional_id(false);v_role text;v_job public.jobs%rowtype;v_case public.complaints%rowtype;v_severity text;v_minutes integer;v_payload jsonb;v_hash text;v_cmd private.support_case_commands%rowtype;v_result jsonb;v_source text;
begin
  if v_actor is null or p_idempotency_key is null or p_category not in('delay','payment','quality','safety','warranty','other') or length(trim(coalesce(p_description,''))) not between 10 and 3000 then raise exception using errcode='22023',message='invalid_support_case';end if;
  select role::text into v_role from public.profiles where id=v_actor;
  if p_job_id is not null then
    select * into v_job from public.jobs where id=p_job_id for share;
    if not found or not(v_job.customer_id=v_customer or v_job.professional_id=v_professional or private.has_admin_permission('operations') or private.has_admin_permission('quality') or (p_category='payment' and private.has_admin_permission('finance'))) then raise exception using errcode='P0002',message='job_not_found';end if;
    v_customer:=v_job.customer_id;v_professional:=v_job.professional_id;
  elsif v_customer is null and v_professional is null and not private.has_admin_permission('operations') and not private.has_admin_permission('quality') then raise exception using errcode='42501',message='support_actor_required';end if;
  if coalesce(cardinality(p_evidence_ids),0)>10 or exists(select 1 from unnest(coalesce(p_evidence_ids,'{}'::uuid[])) e where not exists(select 1 from private.upload_intents u where u.id=e and u.status='verified' and u.attachment_id=e and (u.owner_profile_id=v_actor or u.entity_id=p_job_id))) then raise exception using errcode='22023',message='unverified_evidence';end if;
  v_payload=jsonb_build_object('jobId',p_job_id,'category',p_category,'description',trim(p_description),'safety',coalesce(p_has_safety_risk,false),'payment',coalesce(p_payment_blocked,false),'waiting',coalesce(p_customer_waiting,false),'evidence',coalesce(p_evidence_ids,'{}'::uuid[]));
  v_hash=encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
  select * into v_cmd from private.support_case_commands where actor_profile_id=v_actor and idempotency_key=p_idempotency_key;
  if found then if v_cmd.fingerprint<>v_hash then raise exception using errcode='40001',message='idempotency_key_reused';end if;return v_cmd.result;end if;
  v_severity=case when p_category='safety' or coalesce(p_has_safety_risk,false) then 'critical' when p_category in('payment','delay') or coalesce(p_payment_blocked,false) or coalesce(p_customer_waiting,false) then 'high' when p_category in('quality','warranty') then 'medium' else 'low' end;
  v_minutes=case v_severity when 'critical' then 10 when 'high' then 30 when 'medium' then 120 else 1440 end;
  v_source=case when p_category='warranty' then 'warranty' when v_role='customer' then 'customer' when v_role='professional' then 'professional' else 'operator' end;
  insert into public.complaints(job_id,customer_id,professional_id,severity,description,source,category,opened_by,due_at,policy_snapshot,evidence_ids)
    values(p_job_id,v_customer,v_professional,v_severity,trim(p_description),v_source,p_category,v_actor,private.support_due_at(v_minutes),jsonb_build_object('slaMinutes',v_minutes,'timezone','America/Argentina/Buenos_Aires','decisionStatus','pending_D02_D06'),coalesce(p_evidence_ids,'{}'::uuid[])) returning * into v_case;
  insert into public.support_case_events(case_id,event_type,to_status,public_message,evidence_ids,actor_profile_id) values(v_case.id,'opened','open',trim(p_description),coalesce(p_evidence_ids,'{}'::uuid[]),v_actor);
  v_result=jsonb_build_object('id',v_case.id,'status',v_case.status,'severity',v_case.severity,'dueAt',v_case.due_at,'version',v_case.version,'idempotent',false);
  insert into private.support_case_commands values(v_actor,p_idempotency_key,v_hash,v_result,clock_timestamp());return v_result;
end;$$;

create function public.open_warranty_claim(p_job_id uuid,p_description text,p_same_problem boolean,p_evidence_ids uuid[],p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.current_profile_id();v_customer uuid:=private.current_customer_id();v_job public.jobs%rowtype;v_claim public.warranty_claims%rowtype;v_case jsonb;v_eligible boolean;v_hash text;
begin
  if v_customer is null or p_idempotency_key is null or length(trim(coalesce(p_description,''))) not between 10 and 3000 then raise exception using errcode='22023',message='invalid_warranty_claim';end if;
  select * into v_job from public.jobs where id=p_job_id and customer_id=v_customer for update;
  if not found then raise exception using errcode='P0002',message='job_not_found';end if;
  v_hash=encode(extensions.digest(convert_to(jsonb_build_object('jobId',p_job_id,'description',trim(p_description),'sameProblem',p_same_problem,'evidence',coalesce(p_evidence_ids,'{}'::uuid[]))::text,'UTF8'),'sha256'),'hex');
  select * into v_claim from public.warranty_claims where customer_id=v_customer and idempotency_key=p_idempotency_key;
  if found then if v_claim.submission_fingerprint<>v_hash then raise exception using errcode='40001',message='idempotency_key_reused';end if;return jsonb_build_object('id',v_claim.id,'caseId',v_claim.complaint_id,'status',v_claim.status,'coverageEligible',v_claim.coverage_eligible,'coverageUntil',v_claim.coverage_until,'idempotent',true);end if;
  if exists(select 1 from public.warranty_claims where job_id=p_job_id) then raise exception using errcode='40001',message='warranty_claim_exists';end if;
  v_eligible=v_job.completed_at is not null and exists(select 1 from public.job_final_reports r where r.job_id=v_job.id) and v_job.warranty_until is not null and current_date<=v_job.warranty_until and coalesce(p_same_problem,false);
  v_case=public.open_support_case(p_job_id,'warranty',p_description,false,false,false,p_evidence_ids,p_idempotency_key);
  insert into public.warranty_claims(job_id,customer_id,status,description,complaint_id,coverage_until,coverage_eligible,same_problem,decision_reason,idempotency_key,submission_fingerprint)
    values(p_job_id,v_customer,case when v_eligible then 'open' else 'rejected' end,trim(p_description),(v_case->>'id')::uuid,v_job.warranty_until,v_eligible,coalesce(p_same_problem,false),case when v_job.completed_at is null or not exists(select 1 from public.job_final_reports r where r.job_id=v_job.id) then 'service_not_closed' when v_job.warranty_until is null then 'job_without_warranty' when current_date>v_job.warranty_until then 'warranty_expired' when not coalesce(p_same_problem,false) then 'different_problem' else null end,p_idempotency_key,v_hash) returning * into v_claim;
  if not v_eligible then update public.complaints set status='in_review',version=version+1 where id=v_claim.complaint_id;end if;
  return jsonb_build_object('id',v_claim.id,'caseId',v_claim.complaint_id,'status',v_claim.status,'coverageEligible',v_claim.coverage_eligible,'coverageUntil',v_claim.coverage_until,'supportContinues',not v_eligible,'idempotent',false);
end;$$;

create function public.update_support_case(p_case_id uuid,p_action text,p_expected_version integer,p_public_message text,p_internal_note text,p_assigned_to uuid,p_evidence_ids uuid[],p_resolution_reason text,p_communication_failed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case public.complaints%rowtype;v_actor uuid:=private.current_profile_id();v_next text;v_old text;v_event text:='status_changed';v_is_admin boolean:=private.has_admin_permission('operations') or private.has_admin_permission('quality');
begin
  select * into v_case from public.complaints where id=p_case_id for update;
  if not found or not private.support_case_visible(v_case) then raise exception using errcode='P0002',message='case_not_found';end if;
  v_is_admin:=v_is_admin or (v_case.category='payment' and private.has_admin_permission('finance'));
  if v_case.version<>p_expected_version then raise exception using errcode='40001',message='case_version_conflict';end if;
  if p_internal_note is not null and not v_is_admin then raise exception using errcode='42501',message='internal_note_forbidden';end if;
  if p_assigned_to is not null and not v_is_admin then raise exception using errcode='42501',message='assignment_forbidden';end if;
  if p_action='customer_replied' and v_case.customer_id<>private.current_customer_id() then raise exception using errcode='42501',message='customer_required';
  elsif p_action='professional_replied' and v_case.professional_id<>private.current_professional_id(false) then raise exception using errcode='42501',message='professional_required';
  elsif p_action not in('customer_replied','professional_replied') and not v_is_admin then raise exception using errcode='42501',message='operator_required';end if;
  v_next=case
    when v_case.status='open' and p_action='start_review' then 'in_review'
    when v_case.status='open' and p_action='reject' then 'rejected'
    when v_case.status='in_review' and p_action='wait_customer' then 'waiting_customer'
    when v_case.status='in_review' and p_action='wait_professional' then 'waiting_professional'
    when v_case.status='waiting_customer' and p_action='customer_replied' then 'in_review'
    when v_case.status='waiting_professional' and p_action='professional_replied' then 'in_review'
    when v_case.status='in_review' and p_action in('resolve','reject') then case when p_action='resolve' then 'resolved' else 'rejected' end
    when v_case.status in('resolved','rejected') and p_action='reopen' then 'in_review' end;
  if v_next is null then raise exception using errcode='22023',message='invalid_case_transition';end if;
  if p_action in('resolve','reject') and length(trim(coalesce(p_resolution_reason,'')))<10 then raise exception using errcode='22023',message='resolution_required';end if;
  if p_action in('customer_replied','professional_replied') and length(trim(coalesce(p_public_message,'')))<2 then raise exception using errcode='22023',message='public_response_required';end if;
  if coalesce(cardinality(p_evidence_ids),0)>10 or exists(select 1 from unnest(coalesce(p_evidence_ids,'{}'::uuid[])) e where not exists(select 1 from private.upload_intents u where u.id=e and u.status='verified' and u.attachment_id=e and (u.owner_profile_id=v_actor or u.entity_id=v_case.job_id))) then raise exception using errcode='22023',message='unverified_evidence';end if;
  if coalesce(p_communication_failed,false) then v_event='communication_failed';elsif p_action='reopen' then v_event='reopened';end if;
  v_old:=v_case.status;
  update public.complaints set status=v_next,assigned_to=coalesce(p_assigned_to,assigned_to,case when v_is_admin then v_actor end),evidence_ids=evidence_ids||coalesce(p_evidence_ids,'{}'::uuid[]),public_resolution=case when p_action in('resolve','reject') then trim(p_resolution_reason) else public_resolution end,resolution=case when p_action in('resolve','reject') then trim(p_resolution_reason) else resolution end,resolved_at=case when p_action in('resolve','reject') then clock_timestamp() when p_action='reopen' then null else resolved_at end,last_communication_failed_at=case when coalesce(p_communication_failed,false) then clock_timestamp() else last_communication_failed_at end,version=version+1 where id=v_case.id returning * into v_case;
  insert into public.support_case_events(case_id,event_type,from_status,to_status,public_message,internal_note,evidence_ids,actor_profile_id,metadata) values(v_case.id,v_event,v_old,v_next,nullif(trim(coalesce(p_public_message,'')),''),nullif(trim(coalesce(p_internal_note,'')),''),coalesce(p_evidence_ids,'{}'::uuid[]),v_actor,jsonb_build_object('action',p_action,'resolutionReason',p_resolution_reason,'assignedTo',p_assigned_to));
  if v_is_admin then perform private.append_admin_audit('support.case_'||p_action,'complaint',v_case.id,jsonb_build_object('status',v_next,'version',v_case.version));end if;
  return jsonb_build_object('id',v_case.id,'status',v_case.status,'version',v_case.version,'assignedTo',v_case.assigned_to,'resolvedAt',v_case.resolved_at);
end;$$;

alter table public.jobs add column warranty_revisit_of_job_id uuid unique references public.jobs(id),add column billing_policy text check(billing_policy is null or billing_policy in('standard','warranty_no_charge'));

create function public.decide_warranty_claim(p_claim_id uuid,p_decision text,p_expected_version integer,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_claim public.warranty_claims%rowtype;v_job public.jobs%rowtype;v_request public.service_requests%rowtype;v_new_request uuid;v_new_job uuid;v_actor uuid:=private.current_profile_id();
begin
  if not(private.has_admin_permission('quality') or private.has_admin_permission('operations')) then raise exception using errcode='42501',message='quality_required';end if;
  if p_decision not in('approve','reject') or length(trim(coalesce(p_reason,''))) not between 10 and 3000 then raise exception using errcode='22023',message='decision_reason_required';end if;
  select * into v_claim from public.warranty_claims where id=p_claim_id for update;
  if not found then raise exception using errcode='P0002',message='claim_not_found';end if;
  if v_claim.version<>p_expected_version then raise exception using errcode='40001',message='claim_version_conflict';end if;
  if v_claim.status in('approved','rejected','completed') then raise exception using errcode='40001',message='claim_already_decided';end if;
  if p_decision='approve' and not v_claim.coverage_eligible then raise exception using errcode='40001',message='claim_not_covered';end if;
  select * into v_job from public.jobs where id=v_claim.job_id for share;select * into v_request from public.service_requests where id=v_job.request_id for share;
  if p_decision='approve' then
    insert into public.service_requests(customer_id,category_id,issue_type_id,status,time_since,address_id,preferred_date,preferred_time_window,urgency_level,submitted_at,equipment_id,replacement_of_request_id)
      values(v_request.customer_id,v_request.category_id,v_request.issue_type_id,'pending_assignment',v_request.time_since,v_request.address_id,null,null,'priority',clock_timestamp(),v_request.equipment_id,v_request.id) returning id into v_new_request;
    insert into public.request_answers(request_id,question_code,answer_value,answer_json) select v_new_request,question_code,answer_value,answer_json from public.request_answers where request_id=v_request.id;
    insert into public.jobs(request_id,customer_id,status,final_amount,warranty_revisit_of_job_id,billing_policy) values(v_new_request,v_job.customer_id,'pending_assignment',0,v_job.id,'warranty_no_charge') returning id into v_new_job;
    update public.warranty_claims set status='approved',resolution=trim(p_reason),decision_reason=trim(p_reason),decided_at=clock_timestamp(),revisit_job_id=v_new_job,version=version+1 where id=v_claim.id returning * into v_claim;
    update public.complaints set status='resolved',public_resolution=trim(p_reason),resolution=trim(p_reason),resolved_at=clock_timestamp(),version=version+1 where id=v_claim.complaint_id;
    insert into public.support_case_events(case_id,event_type,from_status,to_status,public_message,actor_profile_id,metadata) values(v_claim.complaint_id,'revisit_created','in_review','resolved',trim(p_reason),v_actor,jsonb_build_object('claimId',v_claim.id,'revisitJobId',v_new_job,'billingPolicy','warranty_no_charge'));
  else
    update public.warranty_claims set status='rejected',resolution=trim(p_reason),decision_reason=trim(p_reason),decided_at=clock_timestamp(),version=version+1 where id=v_claim.id returning * into v_claim;
    update public.complaints set status='resolved',public_resolution=trim(p_reason),resolution=trim(p_reason),resolved_at=clock_timestamp(),version=version+1 where id=v_claim.complaint_id;
    insert into public.support_case_events(case_id,event_type,from_status,to_status,public_message,actor_profile_id,metadata) values(v_claim.complaint_id,'warranty_decided','in_review','resolved',trim(p_reason),v_actor,jsonb_build_object('claimId',v_claim.id,'decision','rejected'));
  end if;
  perform private.append_admin_audit('warranty.'||p_decision,'warranty_claim',v_claim.id,jsonb_build_object('reason',trim(p_reason),'revisitJobId',v_new_job,'billingPolicy',case when v_new_job is null then null else 'warranty_no_charge' end));
  return jsonb_build_object('id',v_claim.id,'status',v_claim.status,'version',v_claim.version,'revisitJobId',v_claim.revisit_job_id,'billingPolicy',case when v_new_job is null then null else 'warranty_no_charge' end);
end;$$;

create function public.list_support_cases(p_limit integer default 50) returns jsonb language sql security definer set search_path='' stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'jobId',c.job_id,'category',c.category,'status',c.status,'severity',c.severity,'description',c.description,'dueAt',c.due_at,'assignedTo',c.assigned_to,'publicResolution',c.public_resolution,'version',c.version,'createdAt',c.created_at,'warrantyClaim',(select jsonb_build_object('id',w.id,'status',w.status,'version',w.version,'coverageEligible',w.coverage_eligible,'coverageUntil',w.coverage_until,'revisitJobId',w.revisit_job_id) from public.warranty_claims w where w.complaint_id=c.id),'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'type',e.event_type,'fromStatus',e.from_status,'toStatus',e.to_status,'message',e.public_message,'internalNote',case when private.has_admin_permission('operations') or private.has_admin_permission('quality') then e.internal_note else null end,'evidenceIds',e.evidence_ids,'createdAt',e.created_at) order by e.created_at),'[]'::jsonb) from public.support_case_events e where e.case_id=c.id)) order by c.created_at desc),'[]'::jsonb)
  from public.complaints c where private.support_case_visible(c) limit greatest(1,least(p_limit,100));
$$;

revoke all on function private.support_due_at(integer,timestamptz),private.support_case_visible(public.complaints),private.normalize_complaint_category() from public,anon,service_role;
grant execute on function private.support_case_visible(public.complaints) to authenticated;
revoke all on function public.open_support_case(uuid,text,text,boolean,boolean,boolean,uuid[],uuid),public.open_warranty_claim(uuid,text,boolean,uuid[],uuid),public.update_support_case(uuid,text,integer,text,text,uuid,uuid[],text,boolean),public.decide_warranty_claim(uuid,text,integer,text),public.list_support_cases(integer) from public,anon;
grant execute on function public.open_support_case(uuid,text,text,boolean,boolean,boolean,uuid[],uuid),public.open_warranty_claim(uuid,text,boolean,uuid[],uuid),public.update_support_case(uuid,text,integer,text,text,uuid,uuid[],text,boolean),public.decide_warranty_claim(uuid,text,integer,text),public.list_support_cases(integer) to authenticated;
