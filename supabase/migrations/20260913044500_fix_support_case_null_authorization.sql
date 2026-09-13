-- Prevent SQL NULL from bypassing participant authorization when an actor has only one marketplace identity.
create or replace function public.open_support_case(p_job_id uuid,p_category text,p_description text,p_has_safety_risk boolean,p_payment_blocked boolean,p_customer_waiting boolean,p_evidence_ids uuid[],p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.current_profile_id();v_customer uuid:=private.current_customer_id();v_professional uuid:=private.current_professional_id(false);v_role text;v_job public.jobs%rowtype;v_case public.complaints%rowtype;v_severity text;v_minutes integer;v_payload jsonb;v_hash text;v_cmd private.support_case_commands%rowtype;v_result jsonb;v_source text;
begin
  if v_actor is null or p_idempotency_key is null or p_category not in('delay','payment','quality','safety','warranty','other') or length(trim(coalesce(p_description,''))) not between 10 and 3000 then raise exception using errcode='22023',message='invalid_support_case';end if;
  select role::text into v_role from public.profiles where id=v_actor;
  if p_job_id is not null then
    select * into v_job from public.jobs where id=p_job_id for share;
    if not found or not(coalesce(v_job.customer_id=v_customer,false) or coalesce(v_job.professional_id=v_professional,false) or private.has_admin_permission('operations') or private.has_admin_permission('quality') or (p_category='payment' and private.has_admin_permission('finance'))) then raise exception using errcode='P0002',message='job_not_found';end if;
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
