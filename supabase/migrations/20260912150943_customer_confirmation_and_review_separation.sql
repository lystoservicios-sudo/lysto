create table public.job_customer_decisions(
  id uuid primary key default gen_random_uuid(),job_id uuid not null unique references public.jobs(id) on delete cascade,
  customer_id uuid not null references public.customer_profiles(id),decision text not null check(decision in('confirmed','disputed')),
  reason text,idempotency_key uuid not null,created_by uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
  unique(customer_id,idempotency_key),check((decision='confirmed' and reason is null) or (decision='disputed' and length(trim(reason)) between 10 and 3000))
);
alter table public.job_customer_decisions enable row level security;
revoke all on public.job_customer_decisions from public,anon,authenticated,service_role;
grant select(id,job_id,customer_id,decision,reason,created_at) on public.job_customer_decisions to authenticated;
create policy customer_decisions_participant_read on public.job_customer_decisions for select to authenticated using(
  customer_id=private.current_customer_id() or exists(select 1 from public.jobs j where j.id=job_id and j.professional_id=private.current_professional_id(false)) or private.has_admin_permission('operations') or private.has_admin_permission('quality')
);

alter table public.reviews add column idempotency_key uuid,add column submission_fingerprint text;
create unique index reviews_customer_idempotency on public.reviews(customer_id,idempotency_key) where idempotency_key is not null;
alter table public.complaints add column source text not null default 'operator' check(source in('operator','customer_dispute','review_quality','warranty'));
create unique index complaints_job_automatic_source on public.complaints(job_id,source) where source in('customer_dispute','review_quality');

create function public.confirm_job_outcome(p_job_id uuid,p_decision text,p_reason text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job public.jobs%rowtype;v_customer uuid:=private.current_customer_id();v_actor uuid:=private.current_profile_id();v_existing public.job_customer_decisions%rowtype;v_result jsonb;
begin
  if v_customer is null or p_idempotency_key is null or p_decision not in('confirmed','disputed') then raise exception using errcode='42501',message='customer_required';end if;
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found or v_job.customer_id<>v_customer then raise exception using errcode='P0002',message='job_not_found';end if;
  select * into v_existing from public.job_customer_decisions where job_id=v_job.id;
  if found then
    if v_existing.decision<>p_decision or coalesce(v_existing.reason,'')<>case when p_decision='disputed' then trim(coalesce(p_reason,'')) else '' end then raise exception using errcode='40001',message='customer_decision_conflict';end if;
    return jsonb_build_object('jobId',v_job.id,'decisionId',v_existing.id,'decision',v_existing.decision,'status',v_job.status,'idempotent',true);
  end if;
  if v_job.status<>'completed_pending_customer_confirmation' or not exists(select 1 from public.job_final_reports where job_id=v_job.id) then raise exception using errcode='40001',message='final_report_confirmation_unavailable';end if;
  if p_decision='disputed' and length(trim(coalesce(p_reason,'')))<10 then raise exception using errcode='22023',message='dispute_reason_required';end if;
  insert into public.job_customer_decisions(job_id,customer_id,decision,reason,idempotency_key,created_by) values(v_job.id,v_customer,p_decision,case when p_decision='disputed' then trim(p_reason) else null end,p_idempotency_key,v_actor) returning * into v_existing;
  if p_decision='confirmed' then
    update public.jobs set status='completed' where id=v_job.id;
    update public.professional_profiles p set jobs_completed=(select count(*) from public.jobs j where j.professional_id=p.id and j.status='completed') where p.id=v_job.professional_id;
    v_result=jsonb_build_object('jobId',v_job.id,'decisionId',v_existing.id,'decision','confirmed','status','completed','idempotent',false);
  else
    update public.jobs set status='disputed' where id=v_job.id;
    insert into public.complaints(job_id,customer_id,professional_id,severity,description,source) values(v_job.id,v_customer,v_job.professional_id,'high',trim(p_reason),'customer_dispute') on conflict(job_id,source) where source in('customer_dispute','review_quality') do nothing;
    v_result=jsonb_build_object('jobId',v_job.id,'decisionId',v_existing.id,'decision','disputed','status','disputed','idempotent',false);
  end if;
  return v_result;
end;$$;

drop function public.submit_customer_review_transaction(uuid,uuid,integer,integer,boolean,boolean,text);
drop function private.submit_customer_review_transaction(uuid,uuid,integer,integer,boolean,boolean,text);
create function private.submit_customer_review_transaction(p_job_id uuid,p_service_rating integer,p_professional_rating integer,p_problem_resolved boolean,p_would_hire_again boolean,p_comment text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job public.jobs%rowtype;v_customer uuid:=private.current_customer_id();v_review public.reviews%rowtype;v_fingerprint text;v_result jsonb;
begin
  if v_customer is null or p_idempotency_key is null then raise exception using errcode='42501',message='customer_required';end if;
  if p_service_rating not between 1 and 5 or p_professional_rating not between 1 and 5 or p_problem_resolved is null or p_would_hire_again is null or length(coalesce(p_comment,''))>800 then raise exception using errcode='22023',message='invalid_review';end if;
  v_fingerprint=encode(extensions.digest(convert_to(jsonb_build_object('service',p_service_rating,'professional',p_professional_rating,'resolved',p_problem_resolved,'again',p_would_hire_again,'comment',trim(coalesce(p_comment,'')))::text,'UTF8'),'sha256'),'hex');
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found or v_job.customer_id<>v_customer then raise exception using errcode='P0002',message='job_not_found';end if;
  select * into v_review from public.reviews where job_id=v_job.id;
  if found then
    if v_review.submission_fingerprint is distinct from v_fingerprint then raise exception using errcode='40001',message='review_already_submitted';end if;
    return jsonb_build_object('reviewId',v_review.id,'jobId',v_job.id,'status',v_job.status,'idempotent',true);
  end if;
  if v_job.status<>'completed' or not exists(select 1 from public.job_customer_decisions where job_id=v_job.id and decision='confirmed') then raise exception using errcode='40001',message='confirmation_required';end if;
  insert into public.reviews(job_id,customer_id,professional_id,service_rating,professional_rating,problem_resolved,would_hire_again,comment,idempotency_key,submission_fingerprint)
    values(v_job.id,v_customer,v_job.professional_id,p_service_rating,p_professional_rating,p_problem_resolved,p_would_hire_again,nullif(trim(coalesce(p_comment,'')),''),p_idempotency_key,v_fingerprint) returning * into v_review;
  update public.professional_profiles p set rating_avg=(select round(avg(r.professional_rating)::numeric,2) from public.reviews r where r.professional_id=p.id),jobs_completed=(select count(*) from public.jobs j where j.professional_id=p.id and j.status='completed') where p.id=v_job.professional_id;
  if p_service_rating<=2 or p_professional_rating<=2 or not p_problem_resolved then
    insert into public.complaints(job_id,customer_id,professional_id,severity,description,source) values(v_job.id,v_customer,v_job.professional_id,'high',coalesce(nullif(trim(p_comment),''),'Calificación baja o problema no resuelto'),'review_quality') on conflict(job_id,source) where source in('customer_dispute','review_quality') do nothing;
  end if;
  return jsonb_build_object('reviewId',v_review.id,'jobId',v_job.id,'status','completed','idempotent',false);
end;$$;
create function public.submit_customer_review_transaction(p_job_id uuid,p_service_rating integer,p_professional_rating integer,p_problem_resolved boolean,p_would_hire_again boolean,p_comment text,p_idempotency_key uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.submit_customer_review_transaction(p_job_id,p_service_rating,p_professional_rating,p_problem_resolved,p_would_hire_again,p_comment,p_idempotency_key);$$;

revoke all on function public.confirm_job_outcome(uuid,text,text,uuid),public.submit_customer_review_transaction(uuid,integer,integer,boolean,boolean,text,uuid) from public,anon;
grant execute on function public.confirm_job_outcome(uuid,text,text,uuid),public.submit_customer_review_transaction(uuid,integer,integer,boolean,boolean,text,uuid) to authenticated;
revoke all on function private.submit_customer_review_transaction(uuid,integer,integer,boolean,boolean,text,uuid) from public,anon,authenticated,service_role;
