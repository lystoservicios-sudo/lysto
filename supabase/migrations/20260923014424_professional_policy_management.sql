-- A draft does not affect applicants. Activation is explicit, audited and versioned.
create table private.professional_policy_versions (
  category_id uuid not null references public.service_categories(id),
  version text not null check(length(version) between 1 and 100),
  required_documents text[] not null check(cardinality(required_documents) between 1 and 20),
  expiry_documents text[] not null default '{}',
  required_tools text[] not null default '{}',
  min_experience integer not null check(min_experience between 0 and 80),
  requires_license boolean not null,
  state text not null default 'draft' check(state in ('draft','active','superseded')),
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  effective_at timestamptz,
  primary key(category_id,version),
  check(expiry_documents <@ required_documents),
  check((state='draft' and effective_at is null) or (state<>'draft' and effective_at is not null))
);
create unique index professional_policy_one_active on private.professional_policy_versions(category_id) where state='active';
create index professional_policy_created_by_idx on private.professional_policy_versions(created_by) where created_by is not null;
create index professional_policy_approved_by_idx on private.professional_policy_versions(approved_by) where approved_by is not null;
alter table private.professional_policy_versions enable row level security;
alter table private.professional_policy_versions force row level security;
revoke all on private.professional_policy_versions from public,anon,authenticated,service_role;

insert into private.professional_policy_versions(category_id,version,required_documents,expiry_documents,required_tools,
  min_experience,requires_license,state,effective_at)
select category_id,version,required_documents,expiry_documents,required_tools,min_experience,requires_license,'active',approved_at
from private.professional_review_policies where approved_at is not null and not test_only;

create function private.list_professional_policies() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.has_admin_permission('operations') or not private.current_session_has_mfa() then raise exception using errcode='42501',message='Operations MFA required'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'categoryId',c.id,'categoryName',c.name,'activeVersion',p.version,'drafts',coalesce((
      select jsonb_agg(jsonb_build_object('version',v.version,'requiredDocuments',v.required_documents,
        'expiryDocuments',v.expiry_documents,'requiredTools',v.required_tools,'minExperience',v.min_experience,
        'requiresLicense',v.requires_license,'createdAt',v.created_at) order by v.created_at desc)
      from private.professional_policy_versions v where v.category_id=c.id and v.state='draft'),'[]'::jsonb)) order by c.name)
    from public.service_categories c left join private.professional_review_policies p on p.category_id=c.id where c.active),'[]'::jsonb);
end; $$;
revoke all on function private.list_professional_policies() from public,anon,authenticated,service_role;
grant execute on function private.list_professional_policies() to authenticated;
create function public.list_professional_policies() returns jsonb
language sql stable security invoker set search_path='' as $$
  select private.list_professional_policies();
$$;
revoke all on function public.list_professional_policies() from public,anon,authenticated,service_role;
grant execute on function public.list_professional_policies() to authenticated;

create function private.save_professional_policy_draft(p_category_id uuid,p_policy jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_version text;v_documents text[];v_expiry text[];v_tools text[];v_experience integer;v_license boolean;
begin
  v_actor:=private.lock_admin_mutation('operations');
  if p_policy is null or jsonb_typeof(p_policy)<>'object'
    or jsonb_typeof(p_policy->'requiredDocuments')<>'array'
    or jsonb_typeof(p_policy->'expiryDocuments')<>'array'
    or jsonb_typeof(p_policy->'requiredTools')<>'array' then
    raise exception using errcode='22023',message='Invalid policy'; end if;
  v_version:=btrim(p_policy->>'version');
  v_documents:=array(select jsonb_array_elements_text(p_policy->'requiredDocuments'));
  v_expiry:=array(select jsonb_array_elements_text(p_policy->'expiryDocuments'));
  v_tools:=array(select jsonb_array_elements_text(p_policy->'requiredTools'));
  v_experience:=(p_policy->>'minExperience')::integer;
  v_license:=(p_policy->>'requiresLicense')::boolean;
  if not exists(select 1 from public.service_categories where id=p_category_id and active)
    or v_version is null or length(v_version) not between 1 and 100
    or cardinality(v_documents) not between 1 and 20
    or array_position(v_documents,null) is not null or array_position(v_expiry,null) is not null or array_position(v_tools,null) is not null
    or cardinality(v_documents)<>(select count(distinct value) from unnest(v_documents) as d(value))
    or cardinality(v_expiry)<>(select count(distinct value) from unnest(v_expiry) as d(value))
    or cardinality(v_tools)<>(select count(distinct value) from unnest(v_tools) as d(value))
    or not v_expiry<@v_documents or not v_documents<@array['identity','identity_front','identity_back','license','insurance','tax']::text[]
    or not v_tools<@array['vacuum_pump','manifold_r410a_r32','digital_scale','multimeter','clamp_meter','leak_detector','thermometer','ladder','safety_equipment']::text[]
    or v_experience not between 0 and 80 or v_license is null then
    raise exception using errcode='22023',message='Invalid policy requirements'; end if;
  insert into private.professional_policy_versions(category_id,version,required_documents,expiry_documents,required_tools,
    min_experience,requires_license,created_by)
    values(p_category_id,v_version,v_documents,v_expiry,v_tools,v_experience,v_license,v_actor);
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_actor,'professional.policy.drafted','service_category',p_category_id,jsonb_build_object('version',v_version));
  return jsonb_build_object('categoryId',p_category_id,'version',v_version,'state','draft');
end; $$;
revoke all on function private.save_professional_policy_draft(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.save_professional_policy_draft(uuid,jsonb) to authenticated;
create function public.save_professional_policy_draft(p_category_id uuid,p_policy jsonb) returns jsonb
language sql security invoker set search_path='' as $$
  select private.save_professional_policy_draft(p_category_id,p_policy);
$$;
revoke all on function public.save_professional_policy_draft(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_professional_policy_draft(uuid,jsonb) to authenticated;

create function private.professional_policy_impact(p_category_id uuid) returns integer
language sql stable security definer set search_path='' as $$
  select count(*)::integer from public.professional_profiles p
    join public.professional_service_categories c on c.professional_id=p.id and c.category_id=p_category_id
    where p.status='approved' and p.invitation_id is not null;
$$;
revoke all on function private.professional_policy_impact(uuid) from public,anon,authenticated,service_role;

create function private.professional_policy_legacy_count(p_category_id uuid) returns integer
language sql stable security definer set search_path='' as $$
  select count(*)::integer from public.professional_profiles p
    join public.professional_service_categories c on c.professional_id=p.id and c.category_id=p_category_id
    where p.status='approved' and p.invitation_id is null;
$$;
revoke all on function private.professional_policy_legacy_count(uuid) from public,anon,authenticated,service_role;

create function private.preview_professional_policy_activation(p_category_id uuid,p_version text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.has_admin_permission('operations') or not private.current_session_has_mfa() then raise exception using errcode='42501',message='Operations MFA required'; end if;
  if not exists(select 1 from private.professional_policy_versions where category_id=p_category_id and version=p_version and state='draft')
    then raise exception using errcode='P0002',message='Draft unavailable'; end if;
  return jsonb_build_object('categoryId',p_category_id,'version',p_version,
    'approvedProfessionalsAffected',private.professional_policy_impact(p_category_id),
    'legacyProfessionalsForManualReview',private.professional_policy_legacy_count(p_category_id));
end; $$;
revoke all on function private.preview_professional_policy_activation(uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.preview_professional_policy_activation(uuid,text) to authenticated;
create function public.preview_professional_policy_activation(p_category_id uuid,p_version text) returns jsonb
language sql stable security invoker set search_path='' as $$
  select private.preview_professional_policy_activation(p_category_id,p_version);
$$;
revoke all on function public.preview_professional_policy_activation(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.preview_professional_policy_activation(uuid,text) to authenticated;

create function private.activate_professional_policy(p_category_id uuid,p_version text,p_expected_impact integer,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_draft private.professional_policy_versions%rowtype;v_impact integer;v_previous text;
begin
  v_actor:=private.lock_admin_mutation('operations');
  if length(btrim(coalesce(p_reason,''))) not between 10 and 1000 then raise exception using errcode='22023',message='Activation reason required'; end if;
  select * into v_draft from private.professional_policy_versions
    where category_id=p_category_id and version=p_version and state='draft' for update;
  if not found then raise exception using errcode='P0002',message='Draft unavailable'; end if;
  perform 1 from private.professional_review_policies where category_id=p_category_id for update;
  v_impact:=private.professional_policy_impact(p_category_id);
  if p_expected_impact is distinct from v_impact then raise exception using errcode='40001',message='Policy impact changed'; end if;
  select version into v_previous from private.professional_review_policies where category_id=p_category_id;
  update private.professional_policy_versions set state='superseded' where category_id=p_category_id and state='active';
  update private.professional_policy_versions set state='active',approved_by=v_actor,effective_at=now()
    where category_id=p_category_id and version=p_version;
  insert into private.professional_review_policies(category_id,version,required_documents,expiry_documents,
    required_tools,min_experience,requires_license,approved_at,test_only)
    values(p_category_id,v_draft.version,v_draft.required_documents,v_draft.expiry_documents,
      v_draft.required_tools,v_draft.min_experience,v_draft.requires_license,now(),false)
    on conflict(category_id) do update set version=excluded.version,required_documents=excluded.required_documents,
      expiry_documents=excluded.expiry_documents,required_tools=excluded.required_tools,min_experience=excluded.min_experience,
      requires_license=excluded.requires_license,approved_at=excluded.approved_at,test_only=false;
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_actor,'professional.policy.activated','service_category',p_category_id,
      jsonb_build_object('version',p_version,'previousVersion',v_previous,'approvedProfessionalsAffected',v_impact,'reason',btrim(p_reason)));
  return jsonb_build_object('categoryId',p_category_id,'version',p_version,'state','active',
    'approvedProfessionalsAffected',v_impact,'legacyProfessionalsForManualReview',private.professional_policy_legacy_count(p_category_id));
end; $$;
revoke all on function private.activate_professional_policy(uuid,text,integer,text) from public,anon,authenticated,service_role;
grant execute on function private.activate_professional_policy(uuid,text,integer,text) to authenticated;
create function public.activate_professional_policy(p_category_id uuid,p_version text,p_expected_impact integer,p_reason text) returns jsonb
language sql security invoker set search_path='' as $$
  select private.activate_professional_policy(p_category_id,p_version,p_expected_impact,p_reason);
$$;
revoke all on function public.activate_professional_policy(uuid,text,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.activate_professional_policy(uuid,text,integer,text) to authenticated;

-- The upload declaration must name a document required by an active policy.
create function private.guard_professional_document_intent() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.kind='professional-document' and not exists(
    select 1 from public.professional_service_categories c
    join private.professional_review_policies p on p.category_id=c.category_id
    where c.professional_id=new.entity_id and new.document_type=any(p.required_documents)) then
    raise exception using errcode='22023',message='Document type not required by active policy';
  end if;
  return new;
end; $$;
create trigger guard_professional_document_intent before insert on private.upload_intents
for each row execute function private.guard_professional_document_intent();
revoke all on function private.guard_professional_document_intent() from public,anon,authenticated,service_role;

-- Operators explicitly reopen a stale approved dossier; the prior submission remains immutable.
create function private.request_professional_revalidation(p_professional_id uuid,p_expected_version integer,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_pro public.professional_profiles%rowtype;v_audit uuid:=gen_random_uuid();
begin
  v_actor:=private.lock_admin_mutation('operations');
  if length(btrim(coalesce(p_reason,''))) not between 10 and 1000 then
    raise exception using errcode='22023',message='Revalidation reason required'; end if;
  select * into v_pro from public.professional_profiles where id=p_professional_id for update;
  if not found then raise exception using errcode='P0002',message='Professional unavailable'; end if;
  if v_pro.version is distinct from p_expected_version or v_pro.status<>'approved'
    or v_pro.invitation_id is null or private.professional_clearance_valid(v_pro.id) then
    raise exception using errcode='40001',message='Only a stale invited dossier may be reopened'; end if;
  update public.professional_profiles set status='rejected' where id=v_pro.id;
  update public.professional_service_categories set approved=false where professional_id=v_pro.id;
  update public.professional_invitations set status='opened' where id=v_pro.invitation_id;
  insert into public.admin_audit_logs(id,actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_audit,v_actor,'professional.revalidation_requested','professional',v_pro.id,
      jsonb_build_object('reason',btrim(p_reason),'from_status','approved','to_status','rejected'));
  insert into private.outbox_events(event_type,aggregate_type,aggregate_id,channel,recipient_profile_id,recipient_key,dedupe_key,payload)
    values('professional.revalidation_requested','professional',v_pro.id,'in_app',v_pro.profile_id,
      v_pro.profile_id::text,v_audit::text,jsonb_build_object('professional_id',v_pro.id,'audit_id',v_audit));
  return private.professional_review_context(v_pro.id);
end; $$;
revoke all on function private.request_professional_revalidation(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function private.request_professional_revalidation(uuid,integer,text) to authenticated;
create function public.request_professional_revalidation(p_professional_id uuid,p_expected_version integer,p_reason text) returns jsonb
language sql security invoker set search_path='' as $$
  select private.request_professional_revalidation(p_professional_id,p_expected_version,p_reason);
$$;
revoke all on function public.request_professional_revalidation(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.request_professional_revalidation(uuid,integer,text) to authenticated;
