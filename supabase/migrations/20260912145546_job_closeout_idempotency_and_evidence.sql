alter table public.job_final_reports
  add column submission_fingerprint text,
  add column after_photo_ids uuid[] not null default '{}',
  add column version integer not null default 1 check(version>0);
alter table public.job_final_reports add constraint job_final_reports_after_photos check(cardinality(after_photo_ids) between 1 and 5) not valid;
create function private.prevent_final_report_update() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='42501',message='final_report_immutable';end;$$;
create trigger job_final_reports_immutable before update on public.job_final_reports for each row execute function private.prevent_final_report_update();

create table private.job_closeout_commands(
  actor_profile_id uuid not null references public.profiles(id),
  idempotency_key uuid not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  fingerprint text not null check(length(fingerprint)=64),
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(actor_profile_id,idempotency_key)
);
alter table private.job_closeout_commands enable row level security;
alter table private.job_closeout_commands force row level security;
revoke all on private.job_closeout_commands from public,anon,authenticated,service_role;

create table public.job_closeout_followups(
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  final_report_id uuid not null unique references public.job_final_reports(id) on delete cascade,
  kind text not null check(kind in('pending_part','second_visit','unresolved')),
  status text not null default 'open' check(status in('open','scheduled','completed','cancelled')),
  details text not null check(length(trim(details)) between 8 and 3000),
  due_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.job_closeout_followups enable row level security;
create policy closeout_followups_participant_read on public.job_closeout_followups for select to authenticated using(exists(
  select 1 from public.jobs j where j.id=job_id and (
    j.customer_id=private.current_customer_id() or j.professional_id=private.current_professional_id(false) or private.has_admin_permission('operations') or private.has_admin_permission('quality')
  )
));
revoke all on public.job_closeout_followups from public,anon,authenticated,service_role;
grant select(id,job_id,final_report_id,kind,status,details,due_at,created_at,updated_at) on public.job_closeout_followups to authenticated;

drop function public.close_job_with_final_report(uuid,uuid,text,text,text,text,public.maintenance_option,date,integer,text);
drop function private.close_job_with_final_report(uuid,uuid,text,text,text,text,public.maintenance_option,date,integer,text);

create function private.close_job_with_final_report(
  p_job_id uuid,p_equipment_id uuid,p_real_diagnosis text,p_work_done text,p_parts_used text,
  p_final_state text,p_maintenance_option public.maintenance_option,p_next_maintenance_date date,
  p_warranty_days integer,p_internal_notes text,p_after_photo_ids uuid[],p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_job public.jobs%rowtype;v_report public.job_final_reports%rowtype;v_professional uuid:=private.current_professional_id(true);
  v_actor uuid:=private.current_profile_id();v_request_equipment uuid;v_photos uuid[];v_payload jsonb;v_fingerprint text;
  v_command private.job_closeout_commands%rowtype;v_result jsonb;v_followup_kind text;
begin
  if v_professional is null or v_actor is null or p_idempotency_key is null then raise exception using errcode='42501',message='professional_required';end if;
  select array_agg(distinct value order by value) into v_photos from unnest(coalesce(p_after_photo_ids,'{}'::uuid[])) value;
  if cardinality(coalesce(v_photos,'{}'::uuid[])) not between 1 and 5 then raise exception using errcode='22023',message='after_photo_required';end if;
  v_payload=jsonb_build_object('jobId',p_job_id,'equipmentId',p_equipment_id,'realDiagnosis',trim(coalesce(p_real_diagnosis,'')),
    'workDone',trim(coalesce(p_work_done,'')),'partsUsed',trim(coalesce(p_parts_used,'')),'finalState',p_final_state,
    'maintenanceOption',p_maintenance_option,'nextMaintenanceDate',p_next_maintenance_date,'warrantyDays',p_warranty_days,
    'internalNotes',trim(coalesce(p_internal_notes,'')),'afterPhotoIds',to_jsonb(v_photos));
  v_fingerprint=encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
  select * into v_command from private.job_closeout_commands where actor_profile_id=v_actor and idempotency_key=p_idempotency_key;
  if found then
    if v_command.fingerprint<>v_fingerprint then raise exception using errcode='40001',message='idempotency_key_reused';end if;
    return v_command.result;
  end if;
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found or v_job.professional_id is distinct from v_professional then raise exception using errcode='P0002',message='job_not_found';end if;
  select * into v_report from public.job_final_reports where job_id=v_job.id;
  if found then
    if v_report.submission_fingerprint is distinct from v_fingerprint then raise exception using errcode='40001',message='final_report_changed';end if;
    v_result=jsonb_build_object('jobId',v_job.id,'finalReportId',v_report.id,'status',v_job.status,'version',v_report.version,'idempotent',true);
    insert into private.job_closeout_commands(actor_profile_id,idempotency_key,job_id,fingerprint,result) values(v_actor,p_idempotency_key,v_job.id,v_fingerprint,v_result);
    return v_result;
  end if;
  if v_job.status<>'in_progress' then raise exception using errcode='40001',message='job_not_in_progress';end if;
  if not exists(select 1 from public.onsite_diagnoses where job_id=v_job.id and professional_id=v_professional and equipment_id=p_equipment_id and status='accepted') then raise exception using errcode='40001',message='accepted_onsite_diagnosis_required';end if;
  if length(trim(coalesce(p_real_diagnosis,'')))<8 or length(trim(coalesce(p_work_done,'')))<8
    or p_final_state not in('resolved','partially_resolved','pending_part','requires_second_visit','not_resolved')
    or p_warranty_days is null or p_warranty_days not between 0 and 365
  then raise exception using errcode='22023',message='final_report_incomplete';end if;
  if p_final_state in('pending_part','requires_second_visit') and length(trim(coalesce(p_parts_used,'')))<8 then raise exception using errcode='22023',message='followup_details_required';end if;
  if p_final_state='pending_part' and p_maintenance_option not in('pending_part_replacement','second_visit_recommended') then raise exception using errcode='22023',message='pending_part_followup_required';end if;
  if p_final_state in('requires_second_visit','not_resolved') and p_maintenance_option<>'second_visit_recommended' then raise exception using errcode='22023',message='second_visit_followup_required';end if;
  select equipment_id into v_request_equipment from public.service_requests where id=v_job.request_id;
  if v_request_equipment is null or p_equipment_id is distinct from v_request_equipment or not exists(
    select 1 from public.customer_equipment where id=p_equipment_id and customer_id=v_job.customer_id
  ) then raise exception using errcode='42501',message='equipment_mismatch';end if;
  if (select count(*) from public.job_media m join private.upload_intents i on i.id=m.id
      where m.id=any(v_photos) and m.job_id=v_job.id and m.media_type='photo' and m.phase='after'
        and m.uploaded_by=v_actor and i.status='verified' and i.owner_profile_id=v_actor)<>cardinality(v_photos)
  then raise exception using errcode='22023',message='verified_after_photos_required';end if;
  if exists(select 1 from public.job_extras where job_id=v_job.id and status='proposed') or exists(
    select 1 from public.job_extras e where e.job_id=v_job.id and e.status='accepted' and not exists(
      select 1 from public.marketplace_checkouts c where c.extra_id=e.id and c.status='approved'
    )
  ) then raise exception using errcode='40001',message='extra_pending';end if;
  insert into public.job_final_reports(job_id,equipment_id,real_diagnosis,work_done,parts_used,final_state,maintenance_option,next_maintenance_date,warranty_days,internal_notes,after_photo_ids,submission_fingerprint)
    values(v_job.id,p_equipment_id,trim(p_real_diagnosis),trim(p_work_done),nullif(trim(coalesce(p_parts_used,'')),''),p_final_state,p_maintenance_option,p_next_maintenance_date,p_warranty_days,nullif(trim(coalesce(p_internal_notes,'')),''),v_photos,v_fingerprint) returning * into v_report;
  insert into public.equipment_service_records(equipment_id,job_id,professional_id,real_diagnosis,work_done,parts_used,next_maintenance_option,next_maintenance_date,notes)
    values(p_equipment_id,v_job.id,v_professional,trim(p_real_diagnosis),trim(p_work_done),nullif(trim(coalesce(p_parts_used,'')),''),p_maintenance_option,p_next_maintenance_date,nullif(trim(coalesce(p_internal_notes,'')),''));
  insert into public.receipts(job_id,final_report_id,public_token) values(v_job.id,v_report.id,v_report.public_token);
  if p_final_state in('pending_part','requires_second_visit','not_resolved') then
    v_followup_kind=case p_final_state when 'pending_part' then 'pending_part' when 'requires_second_visit' then 'second_visit' else 'unresolved' end;
    insert into public.job_closeout_followups(job_id,final_report_id,kind,details,due_at) values(v_job.id,v_report.id,v_followup_kind,coalesce(nullif(trim(p_parts_used),''),trim(p_work_done)),coalesce(p_next_maintenance_date::timestamptz,clock_timestamp()+interval '7 days'));
  end if;
  update public.jobs set status='completed_pending_customer_confirmation',completed_at=clock_timestamp(),warranty_until=case when p_warranty_days>0 then current_date+p_warranty_days else null end where id=v_job.id;
  v_result=jsonb_build_object('jobId',v_job.id,'finalReportId',v_report.id,'status','completed_pending_customer_confirmation','version',v_report.version,'idempotent',false,'evidenceCount',cardinality(v_photos));
  insert into private.job_closeout_commands(actor_profile_id,idempotency_key,job_id,fingerprint,result) values(v_actor,p_idempotency_key,v_job.id,v_fingerprint,v_result);
  return v_result;
end;$$;

create function public.close_job_with_final_report(
  p_job_id uuid,p_equipment_id uuid,p_real_diagnosis text,p_work_done text,p_parts_used text,
  p_final_state text,p_maintenance_option public.maintenance_option,p_next_maintenance_date date,
  p_warranty_days integer,p_internal_notes text,p_after_photo_ids uuid[],p_idempotency_key uuid
) returns jsonb language sql security invoker set search_path='' as $$
  select private.close_job_with_final_report(p_job_id,p_equipment_id,p_real_diagnosis,p_work_done,p_parts_used,p_final_state,p_maintenance_option,p_next_maintenance_date,p_warranty_days,p_internal_notes,p_after_photo_ids,p_idempotency_key);
$$;

revoke all on function private.close_job_with_final_report(uuid,uuid,text,text,text,text,public.maintenance_option,date,integer,text,uuid[],uuid) from public,anon,authenticated,service_role;
revoke all on function private.prevent_final_report_update() from public,anon,authenticated,service_role;
revoke all on function public.close_job_with_final_report(uuid,uuid,text,text,text,text,public.maintenance_option,date,integer,text,uuid[],uuid) from public,anon;
grant execute on function public.close_job_with_final_report(uuid,uuid,text,text,text,text,public.maintenance_option,date,integer,text,uuid[],uuid) to authenticated;
grant select(after_photo_ids,version) on public.job_final_reports to authenticated;
