create table public.onsite_diagnoses(
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(id),
  equipment_id uuid not null references public.customer_equipment(id),
  actual_diagnosis text not null check(length(trim(actual_diagnosis)) between 10 and 5000),
  base_scope text not null check(length(trim(base_scope)) between 10 and 5000),
  evidence_ids uuid[] not null check(cardinality(evidence_ids) between 1 and 5),
  status text not null default 'submitted' check(status in('submitted','changes_requested','accepted')),
  version integer not null default 1 check(version>0),
  submitted_by uuid not null references public.profiles(id),
  submitted_at timestamptz not null default clock_timestamp(),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_reason text,
  check((status='submitted' and decided_by is null and decided_at is null and decision_reason is null)
    or (status in('changes_requested','accepted') and decided_by is not null and decided_at is not null))
);
alter table public.onsite_diagnoses enable row level security;
revoke all on public.onsite_diagnoses from anon,authenticated;
grant select on public.onsite_diagnoses to authenticated;
create policy onsite_diagnosis_participant_read on public.onsite_diagnoses for select to authenticated using(
  exists(select 1 from public.jobs j where j.id=job_id and (j.customer_id=(select private.current_customer_id())
    or j.professional_id=(select private.current_professional_id(false)) or private.has_admin_permission('operations'))));

create table private.onsite_commands(
  id uuid primary key default gen_random_uuid(),actor_profile_id uuid not null references public.profiles(id),
  idempotency_key uuid not null,command_type text not null,entity_id uuid not null,
  fingerprint jsonb not null check(jsonb_typeof(fingerprint)='object'),result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),unique(actor_profile_id,idempotency_key)
);
alter table private.onsite_commands enable row level security;
alter table private.onsite_commands force row level security;
revoke all on private.onsite_commands from public,anon,authenticated,service_role;

create function private.read_onsite_command(p_actor uuid,p_key uuid,p_fingerprint jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v private.onsite_commands%rowtype;
begin
  select * into v from private.onsite_commands where actor_profile_id=p_actor and idempotency_key=p_key;
  if not found then return null; end if;
  if v.fingerprint is distinct from p_fingerprint then raise exception using errcode='40001',message='idempotency_conflict'; end if;
  return v.result;
end; $$;

create function public.advance_service_job_v2(p_job_id uuid,p_expected_status text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job public.jobs%rowtype;v_next public.job_status;v_pro uuid:=private.current_professional_id(true);
  v_actor uuid:=private.current_profile_id();v_fingerprint jsonb;v_result jsonb;
begin
  v_fingerprint=jsonb_build_object('command','advance','jobId',p_job_id,'expectedStatus',p_expected_status);
  v_result=private.read_onsite_command(v_actor,p_idempotency_key,v_fingerprint);if v_result is not null then return v_result;end if;
  select * into v_job from public.jobs where id=p_job_id for update;
  if v_pro is null or not found or v_job.professional_id is distinct from v_pro then raise exception using errcode='42501',message='assigned_professional_required'; end if;
  if v_job.status::text is distinct from p_expected_status then raise exception using errcode='40001',message='job_status_changed'; end if;
  v_next=case v_job.status when 'confirmed' then 'technician_on_way'::public.job_status when 'technician_on_way' then 'arrived'::public.job_status when 'arrived' then 'onsite_diagnosis'::public.job_status end;
  if v_next is null then raise exception using errcode='22023',message='diagnosis_submission_required'; end if;
  if not exists(select 1 from public.marketplace_checkouts where job_id=v_job.id and extra_id is null and status='approved') then
    raise exception using errcode='40001',message='initial_payment_required'; end if;
  update public.jobs set status=v_next,
    technician_on_way_at=case when v_next='technician_on_way' then clock_timestamp() else technician_on_way_at end,
    arrived_at=case when v_next='arrived' then clock_timestamp() else arrived_at end where id=v_job.id;
  v_result=jsonb_build_object('jobId',v_job.id,'status',v_next,'idempotent',false);
  insert into private.onsite_commands(actor_profile_id,idempotency_key,command_type,entity_id,fingerprint,result)
    values(v_actor,p_idempotency_key,'advance_job',v_job.id,v_fingerprint,v_result);
  insert into public.job_status_events(job_id,status,actor_profile_id,notes,metadata) values(v_job.id,v_next,v_actor,'Avance confirmado durante la visita',jsonb_build_object('commandId',p_idempotency_key));
  return v_result;
end; $$;

create function public.submit_onsite_diagnosis(
  p_job_id uuid,p_expected_status text,p_actual_diagnosis text,p_base_scope text,p_equipment_id uuid,
  p_evidence_ids uuid[],p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job public.jobs%rowtype;v_diag public.onsite_diagnoses%rowtype;v_pro uuid:=private.current_professional_id(true);
  v_actor uuid:=private.current_profile_id();v_fingerprint jsonb;v_result jsonb;v_count integer;
begin
  v_fingerprint=jsonb_build_object('command','submit_diagnosis','jobId',p_job_id,'expectedStatus',p_expected_status,
    'actualDiagnosis',trim(p_actual_diagnosis),'baseScope',trim(p_base_scope),'equipmentId',p_equipment_id,'evidenceIds',to_jsonb(p_evidence_ids));
  v_result=private.read_onsite_command(v_actor,p_idempotency_key,v_fingerprint);if v_result is not null then return v_result;end if;
  if length(trim(coalesce(p_actual_diagnosis,''))) not between 10 and 5000 or length(trim(coalesce(p_base_scope,''))) not between 10 and 5000
    or cardinality(p_evidence_ids) not between 1 and 5 or (select count(distinct x) from unnest(p_evidence_ids)x)<>cardinality(p_evidence_ids) then
    raise exception using errcode='22023',message='invalid_diagnosis'; end if;
  select * into v_job from public.jobs where id=p_job_id for update;
  if v_pro is null or not found or v_job.professional_id is distinct from v_pro then raise exception using errcode='42501',message='assigned_professional_required'; end if;
  if v_job.status::text is distinct from p_expected_status or v_job.status not in('onsite_diagnosis','waiting_customer_approval') then raise exception using errcode='40001',message='job_status_changed'; end if;
  if not exists(select 1 from public.service_requests r join public.customer_equipment e on e.id=r.equipment_id and e.customer_id=r.customer_id where r.id=v_job.request_id and e.id=p_equipment_id) then
    raise exception using errcode='22023',message='verified_equipment_required'; end if;
  select count(*) into v_count from public.job_media m join storage.objects o on o.bucket_id=m.storage_bucket and o.name=m.storage_path
    where m.id=any(p_evidence_ids) and m.job_id=v_job.id and m.media_type='photo' and m.phase in('before','during') and m.uploaded_by=v_actor;
  if v_count<>cardinality(p_evidence_ids) then raise exception using errcode='22023',message='verified_job_evidence_required'; end if;
  select * into v_diag from public.onsite_diagnoses where job_id=v_job.id for update;
  if found and v_diag.status<>'changes_requested' then raise exception using errcode='40001',message='diagnosis_already_submitted'; end if;
  if found then update public.onsite_diagnoses set actual_diagnosis=trim(p_actual_diagnosis),base_scope=trim(p_base_scope),equipment_id=p_equipment_id,
    evidence_ids=p_evidence_ids,status='submitted',version=version+1,submitted_at=clock_timestamp(),submitted_by=v_actor,
    decided_by=null,decided_at=null,decision_reason=null where id=v_diag.id returning * into v_diag;
  else insert into public.onsite_diagnoses(job_id,professional_id,equipment_id,actual_diagnosis,base_scope,evidence_ids,submitted_by)
    values(v_job.id,v_pro,p_equipment_id,trim(p_actual_diagnosis),trim(p_base_scope),p_evidence_ids,v_actor) returning * into v_diag; end if;
  update public.jobs set status='waiting_customer_approval' where id=v_job.id and status='onsite_diagnosis';
  v_result=jsonb_build_object('id',v_diag.id,'jobId',v_job.id,'status',v_diag.status,'version',v_diag.version,'jobStatus','waiting_customer_approval','idempotent',false);
  insert into private.onsite_commands(actor_profile_id,idempotency_key,command_type,entity_id,fingerprint,result) values(v_actor,p_idempotency_key,'submit_diagnosis',v_diag.id,v_fingerprint,v_result);
  insert into public.job_status_events(job_id,status,actor_profile_id,notes,metadata) values(v_job.id,'waiting_customer_approval',v_actor,'Diagnóstico presencial y alcance base enviados',jsonb_build_object('diagnosisId',v_diag.id,'version',v_diag.version,'evidenceIds',p_evidence_ids));
  return v_result;
end; $$;

create function public.decide_onsite_scope(
  p_job_id uuid,p_decision text,p_reason text,p_expected_version integer,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job public.jobs%rowtype;v_diag public.onsite_diagnoses%rowtype;v_customer uuid:=private.current_customer_id();
  v_actor uuid:=private.current_profile_id();v_fingerprint jsonb;v_result jsonb;
begin
  v_fingerprint=jsonb_build_object('command','decide_scope','jobId',p_job_id,'decision',p_decision,'reason',trim(coalesce(p_reason,'')),'expectedVersion',p_expected_version);
  v_result=private.read_onsite_command(v_actor,p_idempotency_key,v_fingerprint);if v_result is not null then return v_result;end if;
  if v_customer is null or p_decision not in('accepted','changes_requested') then raise exception using errcode='42501',message='customer_required'; end if;
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found or v_job.customer_id<>v_customer then raise exception using errcode='P0002',message='job_not_found'; end if;
  select * into v_diag from public.onsite_diagnoses where job_id=v_job.id for update;
  if not found then raise exception using errcode='P0002',message='diagnosis_not_found'; end if;
  if v_diag.status='accepted' and p_decision='accepted' then
    v_result=jsonb_build_object('id',v_diag.id,'jobId',v_job.id,'status','accepted','version',v_diag.version,'jobStatus',v_job.status,'idempotent',true);
  else
    if v_job.status<>'waiting_customer_approval' or v_diag.status<>'submitted' or v_diag.version<>p_expected_version then raise exception using errcode='40001',message='diagnosis_version_changed'; end if;
    if p_decision='changes_requested' then
      if length(trim(coalesce(p_reason,'')))<10 then raise exception using errcode='22023',message='reason_required'; end if;
      update public.onsite_diagnoses set status='changes_requested',decided_by=v_actor,decided_at=clock_timestamp(),decision_reason=trim(p_reason) where id=v_diag.id returning * into v_diag;
      v_result=jsonb_build_object('id',v_diag.id,'jobId',v_job.id,'status',v_diag.status,'version',v_diag.version,'jobStatus',v_job.status,'idempotent',false);
    else
      if exists(select 1 from public.job_extras where job_id=v_job.id and status='proposed') then raise exception using errcode='40001',message='extra_decision_pending'; end if;
      if exists(select 1 from public.job_extras e where e.job_id=v_job.id and e.status='accepted' and not exists(
        select 1 from public.marketplace_checkouts c where c.extra_id=e.id and c.status='approved')) then raise exception using errcode='40001',message='accepted_extra_payment_required'; end if;
      if not exists(select 1 from public.marketplace_checkouts where job_id=v_job.id and extra_id is null and status='approved') then raise exception using errcode='40001',message='initial_payment_required'; end if;
      update public.onsite_diagnoses set status='accepted',decided_by=v_actor,decided_at=clock_timestamp(),decision_reason=null where id=v_diag.id returning * into v_diag;
      update public.jobs set status='in_progress',started_at=coalesce(started_at,clock_timestamp()) where id=v_job.id;
      v_result=jsonb_build_object('id',v_diag.id,'jobId',v_job.id,'status','accepted','version',v_diag.version,'jobStatus','in_progress','idempotent',false);
      insert into public.job_status_events(job_id,status,actor_profile_id,notes,metadata) values(v_job.id,'in_progress',v_actor,'Cliente aceptó diagnóstico, alcance y adicionales cobrados',jsonb_build_object('diagnosisId',v_diag.id,'version',v_diag.version));
    end if;
  end if;
  insert into private.onsite_commands(actor_profile_id,idempotency_key,command_type,entity_id,fingerprint,result) values(v_actor,p_idempotency_key,'decide_scope',v_diag.id,v_fingerprint,v_result);
  return v_result;
end; $$;

create function public.decide_job_extra_v2(p_extra_id uuid,p_decision text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.current_profile_id();v_fingerprint jsonb;v_result jsonb;
begin
  v_fingerprint=jsonb_build_object('command','decide_extra','extraId',p_extra_id,'decision',p_decision);
  v_result=private.read_onsite_command(v_actor,p_idempotency_key,v_fingerprint);if v_result is not null then return v_result;end if;
  v_result=private.decide_job_extra(p_extra_id,p_decision);
  insert into private.onsite_commands(actor_profile_id,idempotency_key,command_type,entity_id,fingerprint,result) values(v_actor,p_idempotency_key,'decide_extra',p_extra_id,v_fingerprint,v_result);
  return v_result;
end; $$;

revoke execute on function public.advance_service_job(uuid,text),private.advance_service_job(uuid,text),public.decide_job_extra(uuid,text),private.decide_job_extra(uuid,text) from authenticated;
revoke all on function private.read_onsite_command(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.advance_service_job_v2(uuid,text,uuid),public.submit_onsite_diagnosis(uuid,text,text,text,uuid,uuid[],uuid),
  public.decide_onsite_scope(uuid,text,text,integer,uuid),public.decide_job_extra_v2(uuid,text,uuid) from public,anon;
grant execute on function public.advance_service_job_v2(uuid,text,uuid),public.submit_onsite_diagnosis(uuid,text,text,text,uuid,uuid[],uuid),
  public.decide_onsite_scope(uuid,text,text,integer,uuid),public.decide_job_extra_v2(uuid,text,uuid) to authenticated;
