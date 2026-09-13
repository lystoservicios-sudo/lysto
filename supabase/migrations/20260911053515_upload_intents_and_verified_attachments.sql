-- Raw uploads never enter evidence buckets. Only inspected, normalized bytes
-- can be linked; the service is responsible for decoding and hashing bytes.
create table private.request_upload_drafts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(id),
  owner_profile_id uuid not null references public.profiles(id),
  request_id uuid unique references public.service_requests(id),
  created_at timestamptz not null default now()
);
create table private.upload_intents (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id),
  owner_auth_user_id uuid not null references auth.users(id),
  kind text not null check(kind in ('request-photo','professional-document','job-photo','job-document')),
  entity_id uuid,
  draft_id uuid references private.request_upload_drafts(id),
  mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check(size_bytes > 0 and size_bytes <= 20971520),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  phase text,
  document_type text,
  quarantine_path text not null unique,
  output_bucket text not null check(output_bucket in ('request-media','professional-documents','job-evidence')),
  output_path text not null,
  output_mime_type text not null check(output_mime_type in ('image/jpeg','image/webp')),
  output_size_bytes bigint,
  output_sha256 text,
  status text not null default 'pending' check(status in ('pending','verified','cleaning','cleaned')),
  attachment_id uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  cleanup_after timestamptz not null default now() + interval '3 hours',
  cleanup_lease_token uuid,
  cleanup_lease_until timestamptz,
  cleaned_at timestamptz,
  unique(output_bucket,output_path),
  check(entity_id is not null or draft_id is not null),
  check(status <> 'verified' or (attachment_id is not null and verified_at is not null and output_size_bytes > 0 and output_sha256 ~ '^[a-f0-9]{64}$'))
);
create index upload_intents_cleanup on private.upload_intents(cleanup_after,cleanup_lease_until) where status in ('pending','cleaning');
create index upload_intents_draft on private.upload_intents(draft_id) where draft_id is not null;
alter table private.request_upload_drafts enable row level security;
alter table private.upload_intents enable row level security;
revoke all on private.request_upload_drafts,private.upload_intents from public,anon,authenticated,service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('upload-quarantine','upload-quarantine',false,20971520,array['image/jpeg','image/png','image/webp']);

create function private.upload_actor(p_auth_user_id uuid) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare v_profile public.profiles;
begin
  select p.* into v_profile from public.profiles p join auth.users u on u.id=p.auth_user_id
  where p.auth_user_id=p_auth_user_id and u.raw_app_meta_data->>'app_role'=p.role::text
    and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
  for share of p,u;
  if not found then raise exception using errcode='42501',message='Upload access denied'; end if;
  if v_profile.role='professional' then
    perform 1 from public.professional_profiles where profile_id=v_profile.id and status not in ('suspended','inactive','rejected') for share;
    if not found then raise exception using errcode='42501',message='Upload access denied'; end if;
  elsif v_profile.role='customer' then
    perform 1 from public.customer_profiles where profile_id=v_profile.id for share;
    if not found then raise exception using errcode='42501',message='Upload access denied'; end if;
  elsif v_profile.role='admin' then
    perform 1 from public.admin_profiles a join private.admin_profile_permissions g on g.admin_profile_id=a.id where a.profile_id=v_profile.id;
    if not found then raise exception using errcode='42501',message='Upload access denied'; end if;
  end if;
  return v_profile;
end;
$$;

create function private.authorize_upload_target(p_actor public.profiles,p_kind text,p_entity_id uuid,p_draft_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_kind='request-photo' and p_actor.role='customer' then
    if p_entity_id is not null then
      perform 1 from public.service_requests r join public.customer_profiles c on c.id=r.customer_id where r.id=p_entity_id and c.profile_id=p_actor.id for share of r,c;
    else
      perform 1 from private.request_upload_drafts d join public.customer_profiles c on c.id=d.customer_id where d.id=p_draft_id and d.owner_profile_id=p_actor.id and c.profile_id=p_actor.id and d.request_id is null for share of d,c;
    end if;
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

create function private.upload_intent_json(p_intent private.upload_intents) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id',p_intent.id,'kind',p_intent.kind,'status',p_intent.status,'ownerProfileId',p_intent.owner_profile_id,
    'entityId',p_intent.entity_id,'draftId',p_intent.draft_id,'mimeType',p_intent.mime_type,'sizeBytes',p_intent.size_bytes,'sha256',p_intent.sha256,
    'expectedMimeType',p_intent.mime_type,'expectedSizeBytes',p_intent.size_bytes,'expectedSha256',p_intent.sha256,
    'phase',p_intent.phase,'documentType',p_intent.document_type,'quarantineBucket','upload-quarantine','quarantinePath',p_intent.quarantine_path,
    'outputBucket',p_intent.output_bucket,'outputPath',p_intent.output_path,'outputMimeType',p_intent.output_mime_type,
    'outputSizeBytes',p_intent.output_size_bytes,'outputSha256',p_intent.output_sha256,'expiresAt',p_intent.expires_at,'cleanupAfter',p_intent.cleanup_after,
    'attachmentId',p_intent.attachment_id,'bucket',p_intent.output_bucket,'path',p_intent.output_path);
$$;

create function private.create_upload_intent(p_kind text,p_mime_type text,p_size_bytes bigint,p_sha256 text,p_entity_id uuid,p_draft_id uuid,p_phase text,p_document_type text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles; v_intent private.upload_intents; v_id uuid:=gen_random_uuid(); v_customer uuid; v_bucket text; v_path text; v_output_mime text;
begin
  v_actor:=private.upload_actor((select auth.uid()));
  if v_actor.role::text is distinct from (select auth.jwt()->'app_metadata'->>'app_role') then raise exception using errcode='42501',message='Upload access denied'; end if;
  if p_kind is null or p_kind not in ('request-photo','professional-document','job-photo','job-document')
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
create function public.create_upload_intent(p_kind text,p_mime_type text,p_size_bytes bigint,p_sha256 text,p_entity_id uuid,p_draft_id uuid,p_phase text,p_document_type text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.create_upload_intent(p_kind,p_mime_type,p_size_bytes,p_sha256,p_entity_id,p_draft_id,p_phase,p_document_type); $$;

create function private.can_read_upload(p_intent private.upload_intents,p_actor public.profiles) returns boolean
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
create function private.get_upload_intent(p_intent_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles; v_intent private.upload_intents;
begin
  v_actor:=private.upload_actor((select auth.uid()));
  if v_actor.role::text is distinct from (select auth.jwt()->'app_metadata'->>'app_role') then raise exception using errcode='42501',message='Upload access denied'; end if;
  select * into v_intent from private.upload_intents where id=p_intent_id;
  if not found or not private.can_read_upload(v_intent,v_actor) then raise exception using errcode='42501',message='Upload access denied'; end if;
  return private.upload_intent_json(v_intent);
end;
$$;
create function public.get_upload_intent(p_intent_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.get_upload_intent(p_intent_id); $$;

create function private.finalize_verified_upload(p_intent_id uuid,p_actor_auth_user_id uuid,p_actual_mime_type text,p_actual_size_bytes bigint,p_actual_sha256 text,p_output_size_bytes bigint,p_output_sha256 text) returns jsonb
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
  elsif v_intent.kind='professional-document' then
    insert into public.professional_documents(id,professional_id,document_type,storage_bucket,storage_path) values(v_intent.id,v_intent.entity_id,v_intent.document_type,v_intent.output_bucket,v_intent.output_path);
  elsif v_intent.kind in ('job-photo','job-document') then
    insert into public.job_media(id,job_id,media_type,phase,storage_bucket,storage_path,uploaded_by) values(v_intent.id,v_intent.entity_id,case when v_intent.kind='job-photo' then 'photo'::public.media_type else 'document'::public.media_type end,v_intent.phase,v_intent.output_bucket,v_intent.output_path,v_actor.id);
  end if;
  return private.upload_intent_json(v_intent);
end;
$$;
create function public.finalize_verified_upload(p_intent_id uuid,p_actor_auth_user_id uuid,p_actual_mime_type text,p_actual_size_bytes bigint,p_actual_sha256 text,p_output_size_bytes bigint,p_output_sha256 text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.finalize_verified_upload(p_intent_id,p_actor_auth_user_id,p_actual_mime_type,p_actual_size_bytes,p_actual_sha256,p_output_size_bytes,p_output_sha256); $$;

-- Service credentials cannot insert evidence metadata around the verifier.
revoke insert on public.request_media,public.professional_documents,public.job_media from service_role;
revoke insert(request_id,media_type,storage_bucket,storage_path,uploaded_by) on public.request_media from service_role;
revoke insert(professional_id,document_type,storage_bucket,storage_path) on public.professional_documents from service_role;
revoke insert(job_id,media_type,phase,storage_bucket,storage_path,uploaded_by) on public.job_media from service_role;
revoke all on function public.finalize_storage_upload(text,text,uuid,public.media_type,text,text) from public,anon,authenticated,service_role;

create function private.attach_verified_draft(p_draft_id uuid,p_request_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_draft private.request_upload_drafts; v_intent private.upload_intents;
begin
  select * into v_draft from private.request_upload_drafts where id=p_draft_id for update;
  if not found then raise exception using errcode='42501',message='Upload draft access denied'; end if;
  perform 1 from public.service_requests r join public.customer_profiles c on c.id=r.customer_id where r.id=p_request_id and r.customer_id=v_draft.customer_id and c.profile_id=v_draft.owner_profile_id for share of r,c;
  if not found or (v_draft.request_id is not null and v_draft.request_id<>p_request_id) then raise exception using errcode='42501',message='Upload draft access denied'; end if;
  for v_intent in select * from private.upload_intents where draft_id=p_draft_id order by id for update loop
    if v_intent.status<>'verified' or v_intent.owner_profile_id<>v_draft.owner_profile_id or v_intent.kind<>'request-photo' then raise exception using errcode='22023',message='Draft contains unverified attachments'; end if;
    update private.upload_intents set entity_id=p_request_id where id=v_intent.id;
    insert into public.request_media(id,request_id,media_type,storage_bucket,storage_path,uploaded_by) values(v_intent.id,p_request_id,'photo',v_intent.output_bucket,v_intent.output_path,v_intent.owner_profile_id) on conflict(id) do nothing;
  end loop;
  update private.request_upload_drafts set request_id=p_request_id where id=p_draft_id;
end;
$$;

create function private.claim_expired_upload_intents(p_limit integer) returns jsonb
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
    order by i.cleanup_after,i.id for update skip locked limit p_limit
  ), claimed as (
    update private.upload_intents i set status='cleaning',cleanup_lease_token=gen_random_uuid(),cleanup_lease_until=now()+interval '5 minutes'
    from candidates c where i.id=c.id returning i.*
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'leaseToken',cleanup_lease_token,'leaseUntil',cleanup_lease_until,'quarantineBucket','upload-quarantine','quarantinePath',quarantine_path,'outputBucket',output_bucket,'outputPath',output_path)),'[]'::jsonb) into v_result from claimed;
  return v_result;
end;
$$;
create function public.claim_expired_upload_intents(p_limit integer) returns jsonb
language sql security invoker set search_path = '' as $$ select private.claim_expired_upload_intents(p_limit); $$;
create function private.complete_upload_cleanup(p_intent_id uuid,p_lease_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update private.upload_intents set status='cleaned',cleaned_at=coalesce(cleaned_at,now()),cleanup_lease_until=null
  where id=p_intent_id and status in ('cleaning','cleaned') and cleanup_lease_token=p_lease_token and attachment_id is null;
  if not found then raise exception using errcode='22023',message='Cleanup lease is no longer current'; end if;
  return true;
end;
$$;
create function public.complete_upload_cleanup(p_intent_id uuid,p_lease_token uuid) returns boolean
language sql security invoker set search_path = '' as $$ select private.complete_upload_cleanup(p_intent_id,p_lease_token); $$;

create function private.can_sign_upload_quarantine(p_path text,p_owner text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles; v_intent private.upload_intents;
begin
  v_actor:=private.upload_actor((select auth.uid()));
  if v_actor.role::text is distinct from (select auth.jwt()->'app_metadata'->>'app_role') or p_owner is distinct from v_actor.auth_user_id::text then return false; end if;
  select * into v_intent from private.upload_intents where quarantine_path=p_path and owner_profile_id=v_actor.id and status='pending' and expires_at>now();
  if not found then return false; end if;
  perform private.authorize_upload_target(v_actor,v_intent.kind,v_intent.entity_id,v_intent.draft_id);
  return true;
exception when insufficient_privilege then return false;
end;
$$;
create function private.can_sign_verified_upload(p_bucket text,p_path text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles; v_intent private.upload_intents;
begin
  v_actor:=private.upload_actor((select auth.uid()));
  if v_actor.role::text is distinct from (select auth.jwt()->'app_metadata'->>'app_role') then return false; end if;
  select * into v_intent from private.upload_intents where output_bucket=p_bucket and output_path=p_path and status='verified';
  return found and private.can_read_upload(v_intent,v_actor);
exception when insufficient_privilege then return false;
end;
$$;
drop policy lysto_storage_request_media_insert on storage.objects;
drop policy lysto_storage_professional_documents_insert on storage.objects;
drop policy lysto_storage_job_evidence_insert on storage.objects;
drop policy lysto_storage_equipment_media_insert on storage.objects;
drop policy lysto_storage_request_media_sign on storage.objects;
drop policy lysto_storage_professional_documents_sign on storage.objects;
drop policy lysto_storage_job_evidence_sign on storage.objects;
drop policy lysto_storage_equipment_media_sign on storage.objects;
create policy lysto_storage_quarantine_insert on storage.objects for insert to authenticated
with check(bucket_id='upload-quarantine' and storage.allow_only_operation('storage.object.sign_upload_url') and private.can_sign_upload_quarantine(name,owner_id));
create policy lysto_storage_verified_sign on storage.objects for select to authenticated
using(bucket_id in ('request-media','professional-documents','job-evidence','equipment-media') and storage.allow_any_operation(array['storage.object.sign','storage.object.sign_many']) and private.can_sign_verified_upload(bucket_id,name));

revoke all on function private.upload_actor(uuid),private.authorize_upload_target(public.profiles,text,uuid,uuid),private.upload_intent_json(private.upload_intents),private.can_read_upload(private.upload_intents,public.profiles),private.attach_verified_draft(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.create_upload_intent(text,text,bigint,text,uuid,uuid,text,text),public.create_upload_intent(text,text,bigint,text,uuid,uuid,text,text),private.get_upload_intent(uuid),public.get_upload_intent(uuid),private.can_sign_upload_quarantine(text,text),private.can_sign_verified_upload(text,text) from public,anon,authenticated,service_role;
grant execute on function private.create_upload_intent(text,text,bigint,text,uuid,uuid,text,text),public.create_upload_intent(text,text,bigint,text,uuid,uuid,text,text),private.get_upload_intent(uuid),public.get_upload_intent(uuid),private.can_sign_upload_quarantine(text,text),private.can_sign_verified_upload(text,text) to authenticated;
revoke all on function private.finalize_verified_upload(uuid,uuid,text,bigint,text,bigint,text),public.finalize_verified_upload(uuid,uuid,text,bigint,text,bigint,text),private.claim_expired_upload_intents(integer),public.claim_expired_upload_intents(integer),private.complete_upload_cleanup(uuid,uuid),public.complete_upload_cleanup(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.finalize_verified_upload(uuid,uuid,text,bigint,text,bigint,text),public.finalize_verified_upload(uuid,uuid,text,bigint,text,bigint,text),private.claim_expired_upload_intents(integer),public.claim_expired_upload_intents(integer),private.complete_upload_cleanup(uuid,uuid),public.complete_upload_cleanup(uuid,uuid) to service_role;
