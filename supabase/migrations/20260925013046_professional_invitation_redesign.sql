-- Invitations are records in the professional directory before an auth account exists.
alter table public.professional_invitations
  add column first_name text not null default '' check (char_length(first_name) <= 100),
  add column last_name text not null default '' check (char_length(last_name) <= 100),
  add column flow_version smallint not null default 1 check (flow_version in (1,2));

create function private.invitation_document_v2(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',id,'firstName',first_name,'lastName',last_name,
    'email',email,'specialtySlug',specialty_slug,'status',status,'expiresAt',expires_at,
    'createdAt',created_at,'version',version)
  from public.professional_invitations where id=p_id;
$$;
revoke all on function private.invitation_document_v2(uuid)
  from public,anon,authenticated,service_role;

create function private.create_professional_invitation_v2(
  p_first_name text,p_last_name text,p_email text,p_specialty_slug text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_invitation jsonb;v_token text;v_first text:=btrim(p_first_name);v_last text:=btrim(p_last_name);
begin
  if v_first is null or v_last is null or length(v_first) not between 1 and 100
    or length(v_last) not between 1 and 100 then
    raise exception using errcode='22023',message='Name and surname required';
  end if;
  -- The existing routine retains its MFA, admin permission, duplicate, audit and outbox guards.
  v_invitation=private.create_professional_invitation(p_email,p_specialty_slug,'Convocatoria profesional');
  update public.professional_invitations set first_name=v_first,last_name=v_last,flow_version=2
    where id=(v_invitation->>'id')::uuid;
  select e.payload->>'invitation_token' into v_token from private.outbox_events e
    where e.aggregate_id=(v_invitation->>'id')::uuid
      and e.event_type='professional.invited' and e.channel='email';
  if v_token is null then raise exception using errcode='P0001',message='Invitation delivery token unavailable'; end if;
  return private.invitation_document_v2((v_invitation->>'id')::uuid)||jsonb_build_object('token',v_token);
end; $$;
revoke all on function private.create_professional_invitation_v2(text,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function private.create_professional_invitation_v2(text,text,text,text) to authenticated;

create function public.create_professional_invitation_v2(
  p_first_name text,p_last_name text,p_email text,p_specialty_slug text
) returns jsonb language sql security invoker set search_path='' as $$
  select private.create_professional_invitation_v2(p_first_name,p_last_name,p_email,p_specialty_slug);
$$;
revoke all on function public.create_professional_invitation_v2(text,text,text,text)
  from public,anon,service_role;
grant execute on function public.create_professional_invitation_v2(text,text,text,text) to authenticated;

-- A resend rotates the link while retaining the same directory entry. Previously
-- processed mail cannot be claimed again, so each rotation needs a fresh event.
create function private.renew_professional_invitation(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_invitation public.professional_invitations%rowtype;v_token text;
begin
  v_actor=private.lock_admin_mutation('operations');
  select * into v_invitation from public.professional_invitations where id=p_id for update;
  if not found then raise exception using errcode='P0002',message='Invitation unavailable'; end if;
  if v_invitation.bound_auth_user_id is not null or v_invitation.consumed_at is not null
    or v_invitation.status not in ('queued','sent','expired') then
    raise exception using errcode='40001',message='Invitation cannot be renewed';
  end if;
  v_token=translate(rtrim(encode(extensions.gen_random_bytes(32),'base64'),'='),'+/','-_');
  update public.professional_invitations set
    token_hash=encode(extensions.digest(v_token,'sha256'),'hex'),
    status='queued',expires_at=clock_timestamp()+interval '14 days'
    where id=p_id;
  -- Supersede only unleased pending mail; leased workers are fenced by the
  -- current token hash in resolve_outbox_context.
  update private.outbox_events set attempt_count=greatest(attempt_count,1),
    locked_at=null,locked_until=null,locked_by=null,claim_token=null,
    processed_at=clock_timestamp(),delivery_outcome='suppressed',last_error=null
    where aggregate_id=p_id and event_type='professional.invited' and channel='email'
      and processed_at is null and dead_lettered_at is null
      and (locked_until is null or locked_until<=clock_timestamp());
  insert into private.outbox_events(event_type,aggregate_type,aggregate_id,channel,
    recipient_key,dedupe_key,payload)
    values('professional.invited','professional_invitation',p_id,'email',
      lower(v_invitation.email::text),p_id::text||':'||gen_random_uuid()::text,
      jsonb_build_object('invitation_id',p_id,'invitation_token',v_token,
        'recipient_email',lower(v_invitation.email::text)));
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_actor,'professional.invitation.renewed','professional_invitation',p_id,
      jsonb_build_object('to_status','queued'));
  return private.invitation_document_v2(p_id)||jsonb_build_object('token',v_token);
end; $$;
revoke all on function private.renew_professional_invitation(uuid)
  from public,anon,authenticated,service_role;
grant execute on function private.renew_professional_invitation(uuid) to authenticated;
create function public.renew_professional_invitation(p_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
  select private.renew_professional_invitation(p_id);
$$;
revoke all on function public.renew_professional_invitation(uuid) from public,anon,service_role;
grant execute on function public.renew_professional_invitation(uuid) to authenticated;

create function private.copy_invitation_name_on_accept() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.flow_version=2 and old.bound_auth_user_id is null and new.bound_auth_user_id is not null
    and new.status='opened' then
    update public.profiles set first_name=new.first_name,last_name=new.last_name
      where auth_user_id=new.bound_auth_user_id and role='professional';
  end if;
  return new;
end; $$;
revoke all on function private.copy_invitation_name_on_accept() from public,anon,authenticated,service_role;
create trigger copy_invitation_name_on_accept after update of bound_auth_user_id
  on public.professional_invitations for each row execute function private.copy_invitation_name_on_accept();

create function private.read_professional_invitation_admin(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if not private.has_admin_permission('operations') or not private.current_session_has_mfa() then
    raise exception using errcode='42501',message='Operations permission required';
  end if;
  select private.invitation_document_v2(id) into v_result
    from public.professional_invitations where id=p_id and bound_auth_user_id is null;
  if v_result is null then raise exception using errcode='P0002',message='Invitation unavailable'; end if;
  return v_result;
end; $$;
revoke all on function private.read_professional_invitation_admin(uuid) from public,anon,authenticated,service_role;
grant execute on function private.read_professional_invitation_admin(uuid) to authenticated;
create function public.read_professional_invitation_admin(p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select private.read_professional_invitation_admin(p_id);
$$;
revoke all on function public.read_professional_invitation_admin(uuid) from public,anon,service_role;
grant execute on function public.read_professional_invitation_admin(uuid) to authenticated;

create function private.list_professional_workflow_v2(
  p_resource text,p_limit integer default 25,p_before_created_at timestamptz default null,p_before_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb;v_total bigint;
begin
  if not private.has_admin_permission('operations') or not private.current_session_has_mfa() then
    raise exception using errcode='42501',message='Operations permission required';
  end if;
  if p_resource not in ('invitations','professionals') or p_resource is null
    or p_limit is null or p_limit<1 or p_limit>100
    or (p_before_created_at is null)<>(p_before_id is null) then
    raise exception using errcode='22023',message='Invalid page';
  end if;
  if p_resource='invitations' then
    select count(*) into v_total from public.professional_invitations;
    select coalesce(jsonb_agg(private.invitation_document_v2(id) order by created_at desc,id desc),'[]'::jsonb)
      into v_items from (select id,created_at from public.professional_invitations
        where p_before_id is null or (created_at,id)<(p_before_created_at,p_before_id)
        order by created_at desc,id desc limit p_limit+1) page;
  else
    select count(*) into v_total from (
      select id from public.professional_profiles
      union all select id from public.professional_invitations where bound_auth_user_id is null
    ) all_people;
    select coalesce(jsonb_agg(
      case when person.source='invitation' then
        jsonb_build_object('id',person.id,'createdAt',person.created_at,'version',person.version,
          'firstName',person.first_name,'lastName',person.last_name,'email',person.email,
          'status','invited','eligible',false,'readyForNewWork',false,'invited',true,
          'source','invitation','specialtySlug',person.specialty_slug)
      else jsonb_build_object('id',person.id,'createdAt',person.created_at,'version',person.version,
          'firstName',person.first_name,'lastName',person.last_name,'email',person.email,
          'status',person.status,'eligible',private.professional_clearance_valid(person.id),
          'readyForNewWork',private.professional_ready_for_new_work(person.id),
          'invited',person.invited,'source','profile','specialtySlug',person.specialty_slug)
      end order by person.created_at desc,person.id desc),'[]'::jsonb) into v_items
      from (select * from (select pp.id,pp.created_at,pp.version,
          coalesce(p.first_name,'') as first_name,coalesce(p.last_name,'') as last_name,p.email::text as email,
          pp.status::text as status,pp.invitation_id is not null as invited,'profile'::text as source,
          coalesce((select c.slug from public.professional_service_categories pc
            join public.service_categories c on c.id=pc.category_id
            where pc.professional_id=pp.id order by c.name limit 1),'') as specialty_slug
        from public.professional_profiles pp join public.profiles p on p.id=pp.profile_id
        union all
        select i.id,i.created_at,i.version,i.first_name,i.last_name,i.email::text,
          'invited'::text,true,'invitation'::text,i.specialty_slug
        from public.professional_invitations i where i.bound_auth_user_id is null
      ) all_people
      where p_before_id is null or (all_people.created_at,all_people.id)<(p_before_created_at,p_before_id)
      order by all_people.created_at desc,all_people.id desc limit p_limit+1) person;
  end if;
  return jsonb_build_object('items',v_items,'total',v_total);
end; $$;
revoke all on function private.list_professional_workflow_v2(text,integer,timestamptz,uuid)
  from public,anon,authenticated,service_role;
grant execute on function private.list_professional_workflow_v2(text,integer,timestamptz,uuid)
  to authenticated;
create function public.list_professional_workflow_v2(
  p_resource text,p_limit integer default 25,p_before_created_at timestamptz default null,p_before_id uuid default null
) returns jsonb language sql stable security invoker set search_path='' as $$
  select private.list_professional_workflow_v2(p_resource,p_limit,p_before_created_at,p_before_id);
$$;
revoke all on function public.list_professional_workflow_v2(text,integer,timestamptz,uuid)
  from public,anon,service_role;
grant execute on function public.list_professional_workflow_v2(text,integer,timestamptz,uuid)
  to authenticated;

create index professional_invitations_unbound_directory
  on public.professional_invitations(created_at desc,id desc) where bound_auth_user_id is null;

create function private.save_professional_address(p_address text,p_expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_pro public.professional_profiles%rowtype;v_address text:=btrim(p_address);
begin
  perform 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=private.current_session_id() and u.id=auth.uid() for share of s,u;
  if not found or not private.current_session_active(false) then
    raise exception using errcode='42501',message='Active professional session required';
  end if;
  select * into v_pro from public.professional_profiles
    where id=private.current_professional_id(false) for update;
  if not found or v_pro.status not in ('form_started','rejected') then
    raise exception using errcode='42501',message='Editable professional application required';
  end if;
  perform 1 from public.professional_invitations where id=v_pro.invitation_id
    and bound_auth_user_id=auth.uid() and consumed_at is not null and status='opened' for share;
  if not found then raise exception using errcode='42501',message='Bound application required'; end if;
  if p_expected_version is null or v_pro.version<>p_expected_version then
    raise exception using errcode='40001',message='Application changed';
  end if;
  if v_address is null or length(v_address) not between 5 and 200 then
    raise exception using errcode='22023',message='Valid address required';
  end if;
  update public.professional_profiles set base_location=v_address where id=v_pro.id;
  return private.professional_application_document(v_pro.id)||jsonb_build_object('address',v_address);
end; $$;
revoke all on function private.save_professional_address(text,integer) from public,anon,authenticated,service_role;
grant execute on function private.save_professional_address(text,integer) to authenticated;
create function public.save_professional_address(p_address text,p_expected_version integer) returns jsonb
language sql security invoker set search_path='' as $$
  select private.save_professional_address(p_address,p_expected_version);
$$;
revoke all on function public.save_professional_address(text,integer) from public,anon,service_role;
grant execute on function public.save_professional_address(text,integer) to authenticated;

-- The invitation flow always requires both DNI sides, the matrícula and a
-- profile photo, even when a specialty has a narrower historical policy.
create function private.require_invited_professional_evidence() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_type text;
begin
  if new.status='form_submitted' and old.status is distinct from new.status
    and exists(select 1 from public.professional_invitations i
      where i.id=new.invitation_id and i.flow_version=2) then
    if length(btrim(coalesce(new.base_location,'')))<5
      or length(btrim(coalesce(new.license_number,'')))=0
      or length(btrim(coalesce(new.license_entity,'')))=0
      or not exists(select 1 from private.professional_avatars a
        where a.professional_id=new.id) then
      raise exception using errcode='22023',message='Professional address, license or photo missing';
    end if;
    foreach v_type in array array['identity_front','identity_back','license']::text[] loop
      if not exists(select 1 from public.professional_documents d
        join private.upload_intents i on i.id=d.id and i.status='verified'
          and i.kind='professional-document' and i.entity_id=new.id
        where d.professional_id=new.id and d.document_type=v_type
          and d.status<>'rejected') then
        raise exception using errcode='22023',message='Required professional document missing';
      end if;
    end loop;
  end if;
  return new;
end; $$;
revoke all on function private.require_invited_professional_evidence()
  from public,anon,authenticated,service_role;
create trigger require_invited_professional_evidence before update of status
  on public.professional_profiles for each row
  execute function private.require_invited_professional_evidence();

-- The three mandatory identity documents must be uploadable even when an
-- older specialty policy listed only the legacy single identity document.
create or replace function private.guard_professional_document_intent() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.kind='professional-document' and not (
    (new.document_type=any(array['identity_front','identity_back','license']::text[])
      and exists(select 1 from public.professional_profiles pro
        where pro.id=new.entity_id and pro.invitation_id is not null
          and pro.status in ('form_started','rejected')))
    or exists(select 1 from public.professional_service_categories c
      join private.professional_review_policies p on p.category_id=c.category_id
      where c.professional_id=new.entity_id
        and new.document_type=any(p.required_documents))
  ) then
    raise exception using errcode='22023',message='Document type not required by onboarding or active policy';
  end if;
  return new;
end; $$;

-- Baseline onboarding policy for specialties that have no approved policy yet.
-- Operations can supersede it through the existing policy workflow.
insert into private.professional_review_policies(
  category_id,version,required_documents,expiry_documents,required_tools,
  min_experience,requires_license,approved_at,test_only
)
select c.id,'2026-09-professional-baseline',array['identity_front','identity_back','license']::text[],
  '{}'::text[],'{}'::text[],0,true,now(),false
from public.service_categories c
where c.active and not exists(
  select 1 from private.professional_review_policies p where p.category_id=c.id
)
on conflict(category_id) do nothing;

insert into private.professional_policy_versions(
  category_id,version,required_documents,expiry_documents,required_tools,
  min_experience,requires_license,state,effective_at
)
select p.category_id,p.version,p.required_documents,p.expiry_documents,p.required_tools,
  p.min_experience,p.requires_license,'active',p.approved_at
from private.professional_review_policies p
where p.version='2026-09-professional-baseline'
  and not exists(select 1 from private.professional_policy_versions v
    where v.category_id=p.category_id and v.state='active')
on conflict(category_id,version) do nothing;
