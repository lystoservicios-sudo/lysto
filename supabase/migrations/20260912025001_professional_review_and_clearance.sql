-- No production policy is invented here. D08 must supply the approved
-- documentary requirements; disposable tests may install explicitly test-only rows.
create table private.professional_review_policies (
  category_id uuid primary key references public.service_categories(id),
  version text not null check(length(version) between 1 and 100),
  required_documents text[] not null check(cardinality(required_documents) between 1 and 20),
  expiry_documents text[] not null default '{}',
  required_tools text[] not null default '{}',
  min_experience integer not null default 0 check(min_experience between 0 and 80),
  requires_license boolean not null default false,
  approved_at timestamptz,
  test_only boolean not null default false,
  check((approved_at is not null and not test_only) or (approved_at is null and test_only)),
  check(expiry_documents <@ required_documents)
);
alter table private.professional_review_policies enable row level security;
alter table private.professional_review_policies force row level security;
revoke all on private.professional_review_policies from public,anon,authenticated,service_role;

alter table public.professional_documents add column version integer not null default 1;
alter table public.professional_documents add column expires_at date;
alter table public.professional_documents add column review_reason text;
create trigger professional_documents_version before update on public.professional_documents for each row execute function private.advance_asset_version();
create or replace function private.stamp_professional_document_review() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then return new; end if;
  if not private.has_admin_permission('operations') then raise exception using errcode='42501',message='Operations permission required'; end if;
  if new.status is distinct from old.status or new.expires_at is distinct from old.expires_at or new.review_reason is distinct from old.review_reason then
    new.reviewed_by=private.current_profile_id();new.reviewed_at=now();
  elsif new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at then
    raise exception using errcode='42501',message='Reviewer identity is server-derived';
  end if;
  return new;
end;
$$;
revoke update on public.professional_profiles,public.professional_documents from authenticated;
revoke update(status) on public.professional_profiles,public.professional_documents from authenticated;

create table private.professional_application_submissions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  form_version integer not null,
  application jsonb not null,
  requirements jsonb not null,
  document_ids uuid[] not null,
  legal_acceptance jsonb not null,
  submitted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table private.professional_application_submissions enable row level security;
alter table private.professional_application_submissions force row level security;
revoke all on private.professional_application_submissions from public,anon,authenticated,service_role;
alter table public.professional_profiles add column current_submission_id uuid references private.professional_application_submissions(id) on delete set null;

create function private.professional_requirements(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_total integer;v_policies jsonb;v_test boolean;
begin
  select count(*) into v_total from public.professional_service_categories where professional_id=p_id;
  if v_total=0 or v_total<>(select count(*) from public.professional_service_categories c
    join public.service_categories s on s.id=c.category_id and s.active
    join private.professional_review_policies p on p.category_id=c.category_id
    where c.professional_id=p_id) then return null; end if;
  select jsonb_agg(jsonb_build_object('categoryId',p.category_id,'version',p.version,'requiredDocuments',p.required_documents,
    'expiryDocuments',p.expiry_documents,'requiredTools',p.required_tools,'minExperience',p.min_experience,'requiresLicense',p.requires_license) order by p.category_id),bool_or(p.test_only)
    into v_policies,v_test from private.professional_review_policies p join public.professional_service_categories c on c.category_id=p.category_id where c.professional_id=p_id;
  return jsonb_build_object('policies',v_policies,'testOnly',v_test);
end;
$$;
revoke all on function private.professional_requirements(uuid) from public,anon,authenticated,service_role;

create function private.professional_review_context(p_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_id uuid:=coalesce(p_id,private.current_professional_id(false));v_documents jsonb;
begin
  if not private.has_admin_permission('operations') and (v_id is null or v_id is distinct from private.current_professional_id(false)) then raise exception using errcode='42501',message='Professional review access denied'; end if;
  if not exists(select 1 from public.professional_profiles where id=v_id) then raise exception using errcode='P0002',message='Application unavailable'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'documentType',d.document_type,'status',d.status,'version',d.version,'expiresAt',d.expires_at,
    'reviewedBy',d.reviewed_by,'reviewedAt',d.reviewed_at,'reason',d.review_reason,'createdAt',d.created_at) order by d.created_at desc,d.id desc),'[]'::jsonb)
    into v_documents from public.professional_documents d where d.professional_id=v_id;
  return jsonb_build_object('application',private.professional_application_document(v_id),'requirements',private.professional_requirements(v_id),'documents',v_documents);
end;
$$;
create function public.professional_review_context(p_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select private.professional_review_context(p_id); $$;
revoke all on function private.professional_review_context(uuid),public.professional_review_context(uuid) from public,anon,authenticated,service_role;
grant execute on function private.professional_review_context(uuid),public.professional_review_context(uuid) to authenticated;

create function private.submit_professional_application(p_expected_version integer,p_terms_version text,p_privacy_version text,p_accepted boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_pro public.professional_profiles%rowtype;v_profile public.profiles%rowtype;v_requirements jsonb;v_legal jsonb;v_policy jsonb;v_type text;v_document uuid;v_documents uuid[]:='{}';v_submission uuid;v_audit uuid:=gen_random_uuid();
begin
  perform 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=private.current_session_id() and u.id=auth.uid() for share of s,u;
  if not found or not private.current_session_active(false) then raise exception using errcode='42501',message='Active professional session required'; end if;
  select * into v_pro from public.professional_profiles where id=private.current_professional_id(false) for update;
  if not found or v_pro.status not in ('form_started','rejected') then raise exception using errcode='42501',message='Editable application required'; end if;
  perform 1 from public.professional_invitations where id=v_pro.invitation_id and bound_auth_user_id=auth.uid() and consumed_at is not null and status='opened' for share;
  if not found then raise exception using errcode='42501',message='Bound application required'; end if;
  if p_expected_version is null or p_expected_version<>v_pro.version then raise exception using errcode='40001',message='Application changed'; end if;
  perform 1 from private.professional_review_policies where category_id in(select category_id from public.professional_service_categories where professional_id=v_pro.id) for share;
  perform 1 from private.account_registration_policy where singleton for share;
  v_requirements=private.professional_requirements(v_pro.id);v_legal=private.get_registration_policy();
  if v_requirements is null or v_legal is null then raise exception using errcode='P0001',message='Approved review policy unavailable'; end if;
  if p_accepted is distinct from true or p_terms_version is distinct from v_legal->>'terms_version' or p_privacy_version is distinct from v_legal->>'privacy_version' then raise exception using errcode='22023',message='Current legal acceptance required'; end if;
  select * into v_profile from public.profiles where id=v_pro.profile_id for share;
  if length(btrim(v_profile.first_name))=0 or length(btrim(v_profile.last_name))=0 or length(regexp_replace(coalesce(v_profile.phone,''),'[^0-9]','','g'))<8
    or coalesce(v_pro.dni,'')!~ '^[0-9]{7,9}$' or coalesce(v_pro.cuil,'')!~ '^[0-9]{11}$' or v_pro.birthdate is null or v_pro.birthdate>=current_date
    or not exists(select 1 from public.professional_service_zones z join public.service_zones s on s.id=z.service_zone_id and s.active where z.professional_id=v_pro.id and z.active)
    or not exists(select 1 from public.professional_availability where professional_id=v_pro.id and active) then raise exception using errcode='22023',message='Application is incomplete'; end if;
  for v_policy in select value from jsonb_array_elements(v_requirements->'policies') loop
    if v_pro.years_experience<(v_policy->>'minExperience')::integer or ((v_policy->>'requiresLicense')::boolean and (length(btrim(coalesce(v_pro.license_number,'')))=0 or length(btrim(coalesce(v_pro.license_entity,'')))=0))
      or exists(select 1 from jsonb_array_elements_text(v_policy->'requiredTools') t where not exists(select 1 from public.professional_tools where professional_id=v_pro.id and tool_code=t.value and has_tool)) then raise exception using errcode='22023',message='Professional requirements incomplete'; end if;
  end loop;
  for v_type in select distinct d.value from jsonb_array_elements(v_requirements->'policies') p cross join lateral jsonb_array_elements_text(p->'requiredDocuments') d loop
    select d.id into v_document from public.professional_documents d
      join private.upload_intents i on i.id=d.id and i.status='verified' and i.kind='professional-document' and i.entity_id=v_pro.id
      where d.professional_id=v_pro.id and d.document_type=v_type order by d.created_at desc,d.id desc limit 1 for share of d,i;
    if not found or exists(select 1 from public.professional_documents where id=v_document and status='rejected') then raise exception using errcode='22023',message='Verified required documents missing'; end if;
    v_documents=array_append(v_documents,v_document);
  end loop;
  insert into private.professional_application_submissions(professional_id,form_version,application,requirements,document_ids,legal_acceptance,submitted_by)
    values(v_pro.id,v_pro.version,private.professional_application_document(v_pro.id),v_requirements,v_documents,v_legal||jsonb_build_object('accepted',true,'acceptedAt',now()),v_profile.id) returning id into v_submission;
  update public.professional_profiles set status='form_submitted',current_submission_id=v_submission where id=v_pro.id;
  insert into public.admin_audit_logs(id,actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_audit,v_profile.id,'professional.application.submitted','professional',v_pro.id,jsonb_build_object('from_status',v_pro.status,'to_status','form_submitted'));
  insert into private.outbox_events(event_type,aggregate_type,aggregate_id,channel,recipient_profile_id,recipient_key,dedupe_key,payload)
    select 'professional.application.submitted','professional',v_pro.id,'in_app',p.id,p.id::text,v_audit::text,jsonb_build_object('professional_id',v_pro.id,'audit_id',v_audit)
    from public.admin_profiles a join public.profiles p on p.id=a.profile_id where exists(select 1 from private.admin_profile_permissions where admin_profile_id=a.id and permission in ('operations','owner'));
  return private.professional_application_document(v_pro.id);
end;
$$;
create function public.submit_professional_application(p_expected_version integer,p_terms_version text,p_privacy_version text,p_accepted boolean) returns jsonb
language sql security invoker set search_path='' as $$ select private.submit_professional_application(p_expected_version,p_terms_version,p_privacy_version,p_accepted); $$;
revoke all on function private.submit_professional_application(integer,text,text,boolean),public.submit_professional_application(integer,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function private.submit_professional_application(integer,text,text,boolean),public.submit_professional_application(integer,text,text,boolean) to authenticated;

create function private.review_professional_document(p_document_id uuid,p_expected_version integer,p_decision text,p_reason text,p_expires_at date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_document public.professional_documents%rowtype;v_pro public.professional_profiles%rowtype;v_submission private.professional_application_submissions%rowtype;
begin
  v_actor=private.lock_admin_mutation('operations');
  if p_decision is null or p_decision not in ('approved','rejected') or length(btrim(coalesce(p_reason,''))) not between 10 and 1000 or (p_expires_at is not null and p_expires_at<=current_date) then raise exception using errcode='22023',message='Valid review decision, reason and validity required'; end if;
  select * into v_document from public.professional_documents where id=p_document_id;
  if not found then raise exception using errcode='P0002',message='Document unavailable'; end if;
  select * into v_pro from public.professional_profiles where id=v_document.professional_id for update;
  if v_pro.status not in ('form_submitted','under_review') or p_expected_version is null or v_pro.version<>p_expected_version then raise exception using errcode='40001',message='Application changed or is not in review'; end if;
  select * into v_submission from private.professional_application_submissions where id=v_pro.current_submission_id;
  if not found or not (p_document_id=any(v_submission.document_ids)) then raise exception using errcode='40001',message='Document is not part of the current submission'; end if;
  if p_decision='approved' and p_expires_at is null and exists(select 1 from jsonb_array_elements(v_submission.requirements->'policies') p where p->'expiryDocuments' ? v_document.document_type) then raise exception using errcode='22023',message='Document validity date required'; end if;
  update public.professional_documents set status=p_decision,review_reason=btrim(p_reason),expires_at=p_expires_at where id=p_document_id;
  update public.professional_profiles set status='under_review' where id=v_pro.id;
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_actor,'professional.document.reviewed','professional_document',p_document_id,jsonb_build_object('professional_id',v_pro.id,'reason',btrim(p_reason),'decision',p_decision,'from_status',v_document.status,'to_status',p_decision));
  return private.professional_review_context(v_pro.id);
end;
$$;
create function public.review_professional_document(p_document_id uuid,p_expected_version integer,p_decision text,p_reason text,p_expires_at date) returns jsonb
language sql security invoker set search_path='' as $$ select private.review_professional_document(p_document_id,p_expected_version,p_decision,p_reason,p_expires_at); $$;
revoke all on function private.review_professional_document(uuid,integer,text,text,date),public.review_professional_document(uuid,integer,text,text,date) from public,anon,authenticated,service_role;
grant execute on function private.review_professional_document(uuid,integer,text,text,date),public.review_professional_document(uuid,integer,text,text,date) to authenticated;

create function private.decide_professional_application(p_professional_id uuid,p_expected_version integer,p_decision text,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_pro public.professional_profiles%rowtype;v_submission private.professional_application_submissions%rowtype;v_audit uuid:=gen_random_uuid();
begin
  v_actor=private.lock_admin_mutation('operations');
  if p_decision is null or p_decision not in ('approved','rejected') or length(btrim(coalesce(p_reason,''))) not between 10 and 1000 then raise exception using errcode='22023',message='Valid review decision and reason required'; end if;
  select * into v_pro from public.professional_profiles where id=p_professional_id for update;
  if not found then raise exception using errcode='P0002',message='Application unavailable'; end if;
  if v_pro.status not in ('form_submitted','under_review') or p_expected_version is null or v_pro.version<>p_expected_version then raise exception using errcode='40001',message='Application changed or is not in review'; end if;
  select * into v_submission from private.professional_application_submissions where id=v_pro.current_submission_id;
  if not found then raise exception using errcode='40001',message='Current submission required'; end if;
  if p_decision='approved' then
    perform 1 from public.professional_documents where id=any(v_submission.document_ids) for share;
    if v_submission.requirements is distinct from private.professional_requirements(v_pro.id)
      or exists(select 1 from unnest(v_submission.document_ids) selected(document_id) left join public.professional_documents d on d.id=selected.document_id where d.id is null or d.status<>'approved' or d.reviewed_by is null or (d.expires_at is not null and d.expires_at<=current_date)) then
      raise exception using errcode='40001',message='Current reviewed documents and policy required'; end if;
  end if;
  update public.professional_profiles set status=p_decision::public.professional_status where id=v_pro.id;
  update public.professional_service_categories set approved=(p_decision='approved') where professional_id=v_pro.id;
  update public.professional_invitations set status=case when p_decision='approved' then 'completed' else 'opened' end where id=v_pro.invitation_id;
  insert into public.admin_audit_logs(id,actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_audit,v_actor,'professional.'||p_decision,'professional',v_pro.id,jsonb_build_object('reason',btrim(p_reason),'from_status',v_pro.status,'to_status',p_decision));
  insert into private.outbox_events(event_type,aggregate_type,aggregate_id,channel,recipient_profile_id,recipient_key,dedupe_key,payload)
    values('professional.'||p_decision,'professional',v_pro.id,'in_app',v_pro.profile_id,v_pro.profile_id::text,v_audit::text,jsonb_build_object('professional_id',v_pro.id,'audit_id',v_audit,'status',p_decision));
  return private.professional_review_context(v_pro.id);
end;
$$;
create function public.decide_professional_application(p_professional_id uuid,p_expected_version integer,p_decision text,p_reason text) returns jsonb
language sql security invoker set search_path='' as $$ select private.decide_professional_application(p_professional_id,p_expected_version,p_decision,p_reason); $$;
revoke all on function private.decide_professional_application(uuid,integer,text,text),public.decide_professional_application(uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function private.decide_professional_application(uuid,integer,text,text),public.decide_professional_application(uuid,integer,text,text) to authenticated;
