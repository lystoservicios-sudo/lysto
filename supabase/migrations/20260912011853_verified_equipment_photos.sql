-- Extend the verified-upload pipeline; raw Storage access remains denied.
alter table private.upload_intents drop constraint upload_intents_kind_check;
alter table private.upload_intents add constraint upload_intents_kind_check check(kind in ('request-photo','professional-document','job-photo','job-document','equipment-photo'));
alter table private.upload_intents drop constraint upload_intents_output_bucket_check;
alter table private.upload_intents add constraint upload_intents_output_bucket_check check(output_bucket in ('request-media','professional-documents','job-evidence','equipment-media'));
create table public.equipment_media (
  id uuid primary key references private.upload_intents(id),
  equipment_id uuid not null references public.customer_equipment(id),
  storage_bucket text not null check(storage_bucket='equipment-media'),
  storage_path text not null unique,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index equipment_media_page on public.equipment_media(equipment_id,created_at desc,id desc);
alter table public.equipment_media enable row level security;
revoke all on public.equipment_media from public,anon,authenticated,service_role;
grant select on public.equipment_media to authenticated;
-- Inherit the strict session-aware owner/assigned-professional/operator RLS of equipment.
create policy equipment_media_participant_read on public.equipment_media for select to authenticated
using(exists(select 1 from public.customer_equipment e where e.id=equipment_media.equipment_id));

create or replace function private.authorize_upload_target(p_actor public.profiles,p_kind text,p_entity_id uuid,p_draft_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_kind='request-photo' and p_actor.role='customer' then
    if p_entity_id is not null then
      perform 1 from public.service_requests r join public.customer_profiles c on c.id=r.customer_id where r.id=p_entity_id and c.profile_id=p_actor.id for share of r,c;
    else
      perform 1 from private.request_upload_drafts d join public.customer_profiles c on c.id=d.customer_id where d.id=p_draft_id and d.owner_profile_id=p_actor.id and c.profile_id=p_actor.id and d.request_id is null for share of d,c;
    end if;
  elsif p_kind='equipment-photo' and p_actor.role='customer' then
    perform 1 from public.customer_equipment e join public.customer_profiles c on c.id=e.customer_id
      where e.id=p_entity_id and e.archived_at is null and c.profile_id=p_actor.id for share of e,c;
  elsif p_kind='professional-document' and p_actor.role='professional' then
    perform 1 from public.professional_profiles where id=p_entity_id and profile_id=p_actor.id and status not in ('suspended','inactive','rejected') for share;
  elsif p_kind in ('job-photo','job-document') and p_actor.role='professional' then
    perform 1 from public.jobs j join public.professional_profiles p on p.id=j.professional_id where j.id=p_entity_id and p.profile_id=p_actor.id and p.status='approved' for share of j,p;
  else
    raise exception using errcode='42501',message='Upload access denied';
  end if;
  if not found then raise exception using errcode='42501',message='Upload access denied'; end if;
end;
$$;

create or replace function private.create_upload_intent(p_kind text,p_mime_type text,p_size_bytes bigint,p_sha256 text,p_entity_id uuid,p_draft_id uuid,p_phase text,p_document_type text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles; v_intent private.upload_intents; v_id uuid:=gen_random_uuid(); v_customer uuid; v_bucket text; v_path text; v_output_mime text;
begin
  if not private.current_session_active(true) then raise exception using errcode='42501',message='Upload access denied'; end if;
  v_actor:=private.upload_actor((select auth.uid()));
  if v_actor.role::text is distinct from (select auth.jwt()->'app_metadata'->>'app_role') then raise exception using errcode='42501',message='Upload access denied'; end if;
  if p_kind is null or p_kind not in ('request-photo','professional-document','job-photo','job-document','equipment-photo')
    or p_mime_type is null or p_mime_type not in ('image/jpeg','image/png','image/webp')
    or p_size_bytes is null or p_size_bytes<=0 or p_size_bytes>(case when p_kind='job-document' then 20971520 else 10485760 end)
    or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$'
    or (p_entity_id is not null and p_draft_id is not null)
    or (p_kind<>'request-photo' and (p_entity_id is null or p_draft_id is not null))
    or (p_kind='job-photo' and (p_phase is null or p_phase not in ('before','during','after')))
    or (p_kind='job-document' and p_phase is distinct from 'document')
    or (p_kind not in ('job-photo','job-document') and p_phase is not null)
    or (p_kind='professional-document' and (p_document_type is null or p_document_type !~ '^[a-z][a-z0-9_-]{0,63}$'))
    or (p_kind<>'professional-document' and p_document_type is not null)
  then raise exception using errcode='22023',message='Invalid upload declaration'; end if;
  if p_kind='request-photo' and p_entity_id is null and p_draft_id is null then
    select id into v_customer from public.customer_profiles where profile_id=v_actor.id and v_actor.role='customer';
    if not found then raise exception using errcode='42501',message='Upload access denied'; end if;
    insert into private.request_upload_drafts(customer_id,owner_profile_id) values(v_customer,v_actor.id) returning id into p_draft_id;
  end if;
  perform private.authorize_upload_target(v_actor,p_kind,p_entity_id,p_draft_id);
  v_output_mime:=case when p_kind in ('professional-document','job-document') then 'image/jpeg' else 'image/webp' end;
  if p_kind='request-photo' then
    v_bucket:='request-media'; v_path:=v_actor.auth_user_id::text||'/'||coalesce(p_entity_id,p_draft_id)::text||'/photo/'||v_id::text||'.webp';
  elsif p_kind='equipment-photo' then
    v_bucket:='equipment-media'; v_path:=v_actor.auth_user_id::text||'/'||p_entity_id::text||'/'||v_id::text||'.webp';
  elsif p_kind='professional-document' then
    v_bucket:='professional-documents'; v_path:=v_actor.auth_user_id::text||'/'||p_entity_id::text||'/'||v_id::text||'.jpg';
  else
    v_bucket:='job-evidence'; v_path:=p_entity_id::text||'/'||v_actor.auth_user_id::text||'/'||p_phase||'/'||v_id::text||case when p_kind='job-document' then '.jpg' else '.webp' end;
  end if;
  insert into private.upload_intents(id,owner_profile_id,owner_auth_user_id,kind,entity_id,draft_id,mime_type,size_bytes,sha256,phase,document_type,quarantine_path,output_bucket,output_path,output_mime_type)
  values(v_id,v_actor.id,v_actor.auth_user_id,p_kind,p_entity_id,p_draft_id,p_mime_type,p_size_bytes,p_sha256,p_phase,p_document_type,v_actor.id::text||'/'||v_id::text,v_bucket,v_path,v_output_mime) returning * into v_intent;
  return private.upload_intent_json(v_intent);
end;
$$;

create or replace function private.can_read_upload(p_intent private.upload_intents,p_actor public.profiles) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_intent.status<>'verified' then
    if p_intent.status<>'pending' or p_intent.owner_profile_id<>p_actor.id then return false; end if;
    perform private.authorize_upload_target(p_actor,p_intent.kind,p_intent.entity_id,p_intent.draft_id);
    return true;
  end if;
  if p_intent.kind='request-photo' then
    if p_intent.entity_id is null then return p_intent.owner_profile_id=p_actor.id; end if;
    return exists(select 1 from public.service_requests r where r.id=p_intent.entity_id and (
      exists(select 1 from public.customer_profiles c where c.id=r.customer_id and c.profile_id=p_actor.id and p_actor.role='customer')
      or exists(select 1 from public.jobs j join public.professional_profiles p on p.id=j.professional_id where j.request_id=r.id and p.profile_id=p_actor.id and p.status='approved' and p_actor.role='professional')
      or (p_actor.role='admin' and exists(select 1 from public.admin_profiles a join private.admin_profile_permissions g on g.admin_profile_id=a.id where a.profile_id=p_actor.id and g.permission in ('operations','quality','owner')))));
  elsif p_intent.kind='equipment-photo' then
    return exists(select 1 from public.customer_equipment e where e.id=p_intent.entity_id and (
      exists(select 1 from public.customer_profiles c where c.id=e.customer_id and c.profile_id=p_actor.id and p_actor.role='customer')
      or exists(select 1 from public.jobs j join public.service_requests r on r.id=j.request_id join public.professional_profiles p on p.id=j.professional_id where r.equipment_id=e.id and p.profile_id=p_actor.id and p.status='approved' and p_actor.role='professional')
      or (p_actor.role='admin' and exists(select 1 from public.admin_profiles a join private.admin_profile_permissions g on g.admin_profile_id=a.id where a.profile_id=p_actor.id and g.permission in ('operations','quality','owner')))));
  elsif p_intent.kind='professional-document' then
    return exists(select 1 from public.professional_profiles p where p.id=p_intent.entity_id and (
      (p.profile_id=p_actor.id and p_actor.role='professional')
      or (p_actor.role='admin' and exists(select 1 from public.admin_profiles a join private.admin_profile_permissions g on g.admin_profile_id=a.id where a.profile_id=p_actor.id and g.permission in ('operations','owner')))));
  end if;
  return exists(select 1 from public.jobs j where j.id=p_intent.entity_id and (
    exists(select 1 from public.customer_profiles c where c.id=j.customer_id and c.profile_id=p_actor.id and p_actor.role='customer')
    or exists(select 1 from public.professional_profiles p where p.id=j.professional_id and p.profile_id=p_actor.id and p.status='approved' and p_actor.role='professional')
    or (p_actor.role='admin' and exists(select 1 from public.admin_profiles a join private.admin_profile_permissions g on g.admin_profile_id=a.id where a.profile_id=p_actor.id and g.permission in ('operations','quality','owner')))));
end;
$$;

create or replace function private.finalize_verified_upload(p_intent_id uuid,p_actor_auth_user_id uuid,p_actual_mime_type text,p_actual_size_bytes bigint,p_actual_sha256 text,p_output_size_bytes bigint,p_output_sha256 text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles; v_intent private.upload_intents; v_object storage.objects;
begin
  v_actor:=private.upload_actor(p_actor_auth_user_id);
  select * into v_intent from private.upload_intents where id=p_intent_id for update;
  if not found or v_intent.owner_profile_id<>v_actor.id or v_intent.owner_auth_user_id<>p_actor_auth_user_id then raise exception using errcode='42501',message='Upload access denied'; end if;
  perform private.authorize_upload_target(v_actor,v_intent.kind,v_intent.entity_id,v_intent.draft_id);
  if p_actual_mime_type is distinct from v_intent.mime_type or p_actual_size_bytes is distinct from v_intent.size_bytes or p_actual_sha256 is distinct from v_intent.sha256
    or p_output_size_bytes is null or p_output_size_bytes<=0 or p_output_size_bytes>(case when v_intent.kind='job-document' then 20971520 else 10485760 end)
    or p_output_sha256 is null or p_output_sha256 !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='Upload inspection does not match declaration'; end if;
  if v_intent.status='verified' then
    if v_intent.output_size_bytes<>p_output_size_bytes or v_intent.output_sha256<>p_output_sha256 then raise exception using errcode='22023',message='Upload already finalized with different inspection'; end if;
    return private.upload_intent_json(v_intent);
  end if;
  if v_intent.status<>'pending' or v_intent.expires_at<=now() then raise exception using errcode='22023',message='Upload intent expired or unavailable'; end if;
  select * into v_object from storage.objects where bucket_id='upload-quarantine' and name=v_intent.quarantine_path;
  if not found or v_object.metadata->>'mimetype' is distinct from p_actual_mime_type or v_object.metadata->>'size' is distinct from p_actual_size_bytes::text then raise exception using errcode='22023',message='Quarantine object does not match inspection'; end if;
  select * into v_object from storage.objects where bucket_id=v_intent.output_bucket and name=v_intent.output_path;
  if not found or v_object.metadata->>'mimetype' is distinct from v_intent.output_mime_type or v_object.metadata->>'size' is distinct from p_output_size_bytes::text then raise exception using errcode='22023',message='Processed object does not match inspection'; end if;
  update private.upload_intents set status='verified',verified_at=now(),attachment_id=id,output_size_bytes=p_output_size_bytes,output_sha256=p_output_sha256 where id=v_intent.id returning * into v_intent;
  if v_intent.kind='request-photo' and v_intent.entity_id is not null then
    insert into public.request_media(id,request_id,media_type,storage_bucket,storage_path,uploaded_by) values(v_intent.id,v_intent.entity_id,'photo',v_intent.output_bucket,v_intent.output_path,v_actor.id);
  elsif v_intent.kind='equipment-photo' then
    insert into public.equipment_media(id,equipment_id,storage_bucket,storage_path,uploaded_by)
      values(v_intent.id,v_intent.entity_id,v_intent.output_bucket,v_intent.output_path,v_actor.id);
  elsif v_intent.kind='professional-document' then
    insert into public.professional_documents(id,professional_id,document_type,storage_bucket,storage_path) values(v_intent.id,v_intent.entity_id,v_intent.document_type,v_intent.output_bucket,v_intent.output_path);
  elsif v_intent.kind in ('job-photo','job-document') then
    insert into public.job_media(id,job_id,media_type,phase,storage_bucket,storage_path,uploaded_by) values(v_intent.id,v_intent.entity_id,case when v_intent.kind='job-photo' then 'photo'::public.media_type else 'document'::public.media_type end,v_intent.phase,v_intent.output_bucket,v_intent.output_path,v_actor.id);
  end if;
  return private.upload_intent_json(v_intent);
end;
$$;

create or replace function private.claim_expired_upload_intents(p_limit integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if p_limit is null or p_limit<1 or p_limit>100 then raise exception using errcode='22023',message='Invalid cleanup batch size'; end if;
  with candidates as (
    select i.id from private.upload_intents i where i.status in ('pending','cleaning') and i.expires_at<now() and i.cleanup_after<=now()
      and (i.cleanup_lease_until is null or i.cleanup_lease_until<=now()) and i.attachment_id is null
      and not exists(select 1 from public.request_media m where m.storage_bucket=i.output_bucket and m.storage_path=i.output_path)
      and not exists(select 1 from public.professional_documents m where m.storage_bucket=i.output_bucket and m.storage_path=i.output_path)
      and not exists(select 1 from public.job_media m where m.storage_bucket=i.output_bucket and m.storage_path=i.output_path)
      and not exists(select 1 from public.equipment_media m where m.storage_bucket=i.output_bucket and m.storage_path=i.output_path)
    order by i.cleanup_after,i.id for update skip locked limit p_limit
  ), claimed as (
    update private.upload_intents i set status='cleaning',cleanup_lease_token=gen_random_uuid(),cleanup_lease_until=now()+interval '5 minutes'
    from candidates c where i.id=c.id returning i.*
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'leaseToken',cleanup_lease_token,'leaseUntil',cleanup_lease_until,'quarantineBucket','upload-quarantine','quarantinePath',quarantine_path,'outputBucket',output_bucket,'outputPath',output_path)),'[]'::jsonb) into v_result from claimed;
  return v_result;
end;
$$;

-- CREATE OR REPLACE preserves ACLs. Only the session-bound eight-argument wrapper
-- may invoke this internal seven-argument finalizer (T08).
revoke all on function private.finalize_verified_upload(uuid,uuid,text,bigint,text,bigint,text) from public,anon,authenticated,service_role;
