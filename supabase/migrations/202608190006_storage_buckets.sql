-- Managed Storage buckets and least-privilege object access.
-- Authenticated callers may reserve immutable paths only through
-- createSignedUploadUrl. Replacement, rename, delete, list, and direct upload
-- remain server-side concerns and receive no authenticated policy.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('request-media', 'request-media', false, 31457280, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
  ('professional-documents', 'professional-documents', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf']),
  ('equipment-media', 'equipment-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('job-evidence', 'job-evidence', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('public-avatars', 'public-avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Greenfield contract: all evidence uses job-evidence. Fail rather than retain
-- an ungoverned legacy bucket if an environment unexpectedly contains objects.
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.buckets where id = 'job-media';
select set_config('storage.allow_delete_query', 'false', true);

alter table public.request_media
  drop constraint if exists request_media_storage_bucket_check;
alter table public.request_media
  add constraint request_media_storage_bucket_check
  check (storage_bucket = 'request-media') not valid;
alter table public.request_media validate constraint request_media_storage_bucket_check;

alter table public.professional_documents
  drop constraint if exists professional_documents_storage_bucket_check;
alter table public.professional_documents
  add constraint professional_documents_storage_bucket_check
  check (storage_bucket = 'professional-documents') not valid;
alter table public.professional_documents validate constraint professional_documents_storage_bucket_check;

alter table public.job_media
  drop constraint if exists job_media_storage_bucket_check;
alter table public.job_media
  add constraint job_media_storage_bucket_check
  check (storage_bucket = 'job-evidence') not valid;
alter table public.job_media validate constraint job_media_storage_bucket_check;

drop policy if exists "authenticated request media upload" on storage.objects;
drop policy if exists "authenticated job media upload" on storage.objects;
drop policy if exists "authenticated professional docs upload" on storage.objects;
drop policy if exists lysto_storage_request_media_insert on storage.objects;
drop policy if exists lysto_storage_request_media_sign on storage.objects;
drop policy if exists lysto_storage_professional_documents_insert on storage.objects;
drop policy if exists lysto_storage_professional_documents_sign on storage.objects;
drop policy if exists lysto_storage_equipment_media_insert on storage.objects;
drop policy if exists lysto_storage_equipment_media_sign on storage.objects;
drop policy if exists lysto_storage_job_evidence_insert on storage.objects;
drop policy if exists lysto_storage_job_evidence_sign on storage.objects;
drop policy if exists lysto_storage_public_avatars_insert on storage.objects;

-- request-media:
-- <customer-auth-uid>/<request-uuid>/<photo|video>/<object-uuid>.<ext>
create policy lysto_storage_request_media_insert
on storage.objects for insert to authenticated
with check (
  (select storage.allow_only_operation('storage.object.sign_upload_url'))
  and bucket_id = 'request-media'
  and owner_id = (select auth.uid()::text)
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (
    ((storage.foldername(name))[3] = 'photo'
      and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$')
    or
    ((storage.foldername(name))[3] = 'video'
      and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|mov)$')
  )
  and exists (
    select 1 from public.service_requests as request
    where request.id::text = (storage.foldername(name))[2]
      and request.customer_id = (select private.current_customer_id())
  )
);

create policy lysto_storage_request_media_sign
on storage.objects for select to authenticated
using (
  bucket_id = 'request-media'
  and storage.allow_any_operation(array['storage.object.sign', 'storage.object.sign_many'])
  and array_length(storage.foldername(name), 1) = 3
  and owner_id = (storage.foldername(name))[1]
  and owner_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (
    ((storage.foldername(name))[3] = 'photo'
      and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$')
    or
    ((storage.foldername(name))[3] = 'video'
      and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|mov)$')
  )
  and exists (
    select 1 from public.service_requests as request
    where request.id::text = (storage.foldername(name))[2]
      and (
        request.customer_id = (select private.current_customer_id())
        or exists (
          select 1 from public.jobs as job
          where job.request_id = request.id
            and job.professional_id = (select private.current_professional_id(true))
        )
        or (select private.has_admin_permission('operations'::public.admin_permission))
        or (select private.has_admin_permission('quality'::public.admin_permission))
      )
  )
);

-- professional-documents:
-- <professional-auth-uid>/<professional-profile-uuid>/<object-uuid>.<ext>
create policy lysto_storage_professional_documents_insert
on storage.objects for insert to authenticated
with check (
  (select storage.allow_only_operation('storage.object.sign_upload_url'))
  and bucket_id = 'professional-documents'
  and owner_id = (select auth.uid()::text)
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|pdf)$'
  and (storage.foldername(name))[2] = (select private.current_professional_id(false)::text)
);

create policy lysto_storage_professional_documents_sign
on storage.objects for select to authenticated
using (
  bucket_id = 'professional-documents'
  and storage.allow_any_operation(array['storage.object.sign', 'storage.object.sign_many'])
  and array_length(storage.foldername(name), 1) = 2
  and owner_id = (storage.foldername(name))[1]
  and owner_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|pdf)$'
  and exists (
    select 1 from public.professional_profiles as professional
    where professional.id::text = (storage.foldername(name))[2]
      and (
        professional.id = (select private.current_professional_id(false))
        or (select private.has_admin_permission('operations'::public.admin_permission))
      )
  )
);

-- equipment-media customer path:
-- <customer-auth-uid>/<equipment-uuid>/<object-uuid>.<ext>
-- equipment-media assigned professional path:
-- <job-uuid>/<equipment-uuid>/<professional-auth-uid>/<object-uuid>.<ext>
create policy lysto_storage_equipment_media_insert
on storage.objects for insert to authenticated
with check (
  (select storage.allow_only_operation('storage.object.sign_upload_url'))
  and bucket_id = 'equipment-media'
  and owner_id = (select auth.uid()::text)
  and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  and (
    (
      array_length(storage.foldername(name), 1) = 2
      and (storage.foldername(name))[1] = (select auth.uid()::text)
      and exists (
        select 1 from public.customer_equipment as equipment
        where equipment.id::text = (storage.foldername(name))[2]
          and equipment.customer_id = (select private.current_customer_id())
      )
    )
    or
    (
      array_length(storage.foldername(name), 1) = 3
      and (storage.foldername(name))[3] = (select auth.uid()::text)
      and exists (
        select 1 from public.jobs as job
        join public.service_requests as request on request.id = job.request_id
        where job.id::text = (storage.foldername(name))[1]
          and request.equipment_id::text = (storage.foldername(name))[2]
          and job.professional_id = (select private.current_professional_id(true))
      )
    )
  )
);

create policy lysto_storage_equipment_media_sign
on storage.objects for select to authenticated
using (
  bucket_id = 'equipment-media'
  and storage.allow_any_operation(array['storage.object.sign', 'storage.object.sign_many'])
  and owner_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  and (
    (
      array_length(storage.foldername(name), 1) = 2
      and owner_id = (storage.foldername(name))[1]
      and exists (
        select 1 from public.customer_equipment as equipment
        where equipment.id::text = (storage.foldername(name))[2]
          and (
            equipment.customer_id = (select private.current_customer_id())
            or exists (
              select 1
              from public.service_requests as request
              join public.jobs as job on job.request_id = request.id
              where request.equipment_id = equipment.id
                and job.professional_id = (select private.current_professional_id(true))
            )
            or (select private.has_admin_permission('operations'::public.admin_permission))
            or (select private.has_admin_permission('quality'::public.admin_permission))
          )
      )
    )
    or
    (
      array_length(storage.foldername(name), 1) = 3
      and owner_id = (storage.foldername(name))[3]
      and exists (
        select 1 from public.jobs as job
        join public.service_requests as request on request.id = job.request_id
        where job.id::text = (storage.foldername(name))[1]
          and request.equipment_id::text = (storage.foldername(name))[2]
          and (
            job.customer_id = (select private.current_customer_id())
            or job.professional_id = (select private.current_professional_id(true))
            or (select private.has_admin_permission('operations'::public.admin_permission))
            or (select private.has_admin_permission('quality'::public.admin_permission))
          )
      )
    )
  )
);

-- job-evidence:
-- <job-uuid>/<professional-auth-uid>/<before|during|after|document>/<object-uuid>.<ext>
create policy lysto_storage_job_evidence_insert
on storage.objects for insert to authenticated
with check (
  (select storage.allow_only_operation('storage.object.sign_upload_url'))
  and bucket_id = 'job-evidence'
  and owner_id = (select auth.uid()::text)
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[2] = (select auth.uid()::text)
  and (
    ((storage.foldername(name))[3] in ('before', 'during', 'after')
      and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$')
    or
    ((storage.foldername(name))[3] = 'document'
      and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$')
  )
  and exists (
    select 1 from public.jobs as job
    where job.id::text = (storage.foldername(name))[1]
      and job.professional_id = (select private.current_professional_id(true))
  )
);

create policy lysto_storage_job_evidence_sign
on storage.objects for select to authenticated
using (
  bucket_id = 'job-evidence'
  and storage.allow_any_operation(array['storage.object.sign', 'storage.object.sign_many'])
  and array_length(storage.foldername(name), 1) = 3
  and owner_id = (storage.foldername(name))[2]
  and owner_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (
    ((storage.foldername(name))[3] in ('before', 'during', 'after')
      and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$')
    or
    ((storage.foldername(name))[3] = 'document'
      and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$')
  )
  and exists (
    select 1 from public.jobs as job
    where job.id::text = (storage.foldername(name))[1]
      and (
        job.customer_id = (select private.current_customer_id())
        or job.professional_id = (select private.current_professional_id(true))
        or (select private.has_admin_permission('operations'::public.admin_permission))
        or (select private.has_admin_permission('quality'::public.admin_permission))
      )
  )
);

-- public-avatars: <auth-uid>/<object-uuid>.<ext>
-- The bucket is public, so no SELECT policy is needed and listing stays denied.
-- Task 8 owns avatar quotas, canonical replacement, and orphan cleanup.
create policy lysto_storage_public_avatars_insert
on storage.objects for insert to authenticated
with check (
  (select storage.allow_only_operation('storage.object.sign_upload_url'))
  and (select private.current_profile_id()) is not null
  and bucket_id = 'public-avatars'
  and owner_id = (select auth.uid()::text)
  and array_length(storage.foldername(name), 1) = 1
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
);

-- Metadata is written only after the object exists and Storage-reported
-- metadata matches the immutable path. Task 8 owns pre-sign authorization,
-- actual byte inspection, and orphan cleanup.
drop policy if exists request_media_customer_insert on public.request_media;
drop policy if exists professional_documents_owner_insert on public.professional_documents;
drop policy if exists job_media_professional_insert on public.job_media;

revoke insert, delete on public.request_media from authenticated;
revoke insert (request_id, media_type, storage_bucket, storage_path, uploaded_by)
on public.request_media from authenticated;
revoke insert, delete on public.professional_documents from authenticated;
revoke insert (professional_id, document_type, storage_bucket, storage_path)
on public.professional_documents from authenticated;
revoke insert, delete on public.job_media from authenticated;
revoke insert (job_id, media_type, phase, storage_bucket, storage_path, uploaded_by)
on public.job_media from authenticated;

grant select (id, storage_bucket, storage_path, request_id, media_type, uploaded_by)
on public.request_media to service_role;
grant insert (request_id, media_type, storage_bucket, storage_path, uploaded_by)
on public.request_media to service_role;

grant select (id, storage_bucket, storage_path, professional_id, document_type)
on public.professional_documents to service_role;
grant insert (professional_id, document_type, storage_bucket, storage_path)
on public.professional_documents to service_role;

grant select (id, storage_bucket, storage_path, job_id, media_type, phase, uploaded_by)
on public.job_media to service_role;
grant insert (job_id, media_type, phase, storage_bucket, storage_path, uploaded_by)
on public.job_media to service_role;

grant select (id, customer_id) on public.service_requests to service_role;
grant select (id, profile_id) on public.customer_profiles to service_role;
grant select (id, profile_id, status) on public.professional_profiles to service_role;
grant select (id, auth_user_id) on public.profiles to service_role;
grant select (id, professional_id) on public.jobs to service_role;
grant select on storage.objects to service_role;

create or replace function public.finalize_storage_upload(
  p_bucket text,
  p_path text,
  p_entity_id uuid,
  p_media_type public.media_type default null,
  p_phase text default null,
  p_document_type text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id text;
  v_mimetype text;
  v_size bigint;
  v_parts text[];
  v_filename text;
  v_extension text;
  v_expected_mimetype text;
  v_profile_id uuid;
  v_metadata_id uuid;
begin
  if current_user <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Storage metadata finalization is server-only';
  end if;

  select object.owner_id,
         lower(object.metadata ->> 'mimetype'),
         case when object.metadata ->> 'size' ~ '^[0-9]+$'
           then (object.metadata ->> 'size')::bigint else null end
  into v_owner_id, v_mimetype, v_size
  from storage.objects as object
  where object.bucket_id = p_bucket and object.name = p_path;

  if not found then
    raise exception 'Storage object does not exist';
  end if;

  v_parts := storage.foldername(p_path);
  v_filename := storage.filename(p_path);
  v_extension := lower(substring(v_filename from '\.([^.]+)$'));

  if v_owner_id is null
     or v_owner_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_size is null or v_size <= 0 or v_mimetype is null then
    raise exception 'Storage object metadata is incomplete';
  end if;

  v_expected_mimetype := case v_extension
    when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg'
    when 'png' then 'image/png' when 'webp' then 'image/webp'
    when 'mp4' then 'video/mp4' when 'mov' then 'video/quicktime'
    when 'pdf' then 'application/pdf' else null
  end;
  if v_expected_mimetype is null or v_mimetype <> v_expected_mimetype then
    raise exception 'Storage MIME does not match the immutable extension';
  end if;

  case p_bucket
    when 'request-media' then
      if array_length(v_parts, 1) <> 3
         or v_owner_id <> v_parts[1]
         or v_parts[2] <> p_entity_id::text
         or p_phase is not null or p_document_type is not null
         or p_media_type is null
         or p_media_type not in ('photo'::public.media_type, 'video'::public.media_type)
         or v_parts[3] <> p_media_type::text
         or (p_media_type = 'photo'::public.media_type and (
           v_filename !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
           or v_mimetype not like 'image/%' or v_size > 10485760))
         or (p_media_type = 'video'::public.media_type and (
           v_filename !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|mov)$'
           or v_mimetype not like 'video/%' or v_size > 31457280)) then
        raise exception 'Invalid request-media finalization';
      end if;

      select profile.id into v_profile_id
      from public.service_requests as request
      join public.customer_profiles as customer on customer.id = request.customer_id
      join public.profiles as profile on profile.id = customer.profile_id
      where request.id = p_entity_id and profile.auth_user_id::text = v_owner_id;
      if v_profile_id is null then
        raise exception 'Request-media owner does not own the request';
      end if;

      insert into public.request_media
        (request_id, media_type, storage_bucket, storage_path, uploaded_by)
      values (p_entity_id, p_media_type, p_bucket, p_path, v_profile_id)
      on conflict (storage_bucket, storage_path) do nothing;
      select media.id into v_metadata_id from public.request_media as media
      where media.storage_bucket = p_bucket and media.storage_path = p_path
        and media.request_id = p_entity_id and media.media_type = p_media_type
        and media.uploaded_by = v_profile_id;

    when 'professional-documents' then
      if array_length(v_parts, 1) <> 2
         or v_owner_id <> v_parts[1] or v_parts[2] <> p_entity_id::text
         or p_media_type is not null or p_phase is not null
         or nullif(btrim(p_document_type), '') is null
         or v_filename !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|pdf)$'
         or v_size > 10485760 then
        raise exception 'Invalid professional-document finalization';
      end if;

      select profile.id into v_profile_id
      from public.professional_profiles as professional
      join public.profiles as profile on profile.id = professional.profile_id
      where professional.id = p_entity_id and profile.auth_user_id::text = v_owner_id;
      if v_profile_id is null then
        raise exception 'Document owner does not match the professional';
      end if;

      insert into public.professional_documents
        (professional_id, document_type, storage_bucket, storage_path)
      values (p_entity_id, btrim(p_document_type), p_bucket, p_path)
      on conflict (storage_bucket, storage_path) do nothing;
      select document.id into v_metadata_id from public.professional_documents as document
      where document.storage_bucket = p_bucket and document.storage_path = p_path
        and document.professional_id = p_entity_id
        and document.document_type = btrim(p_document_type);

    when 'job-evidence' then
      if array_length(v_parts, 1) <> 3
         or v_owner_id <> v_parts[2] or v_parts[1] <> p_entity_id::text
         or p_document_type is not null
         or p_media_type is null or p_phase is null
         or p_phase not in ('before', 'during', 'after', 'document')
         or v_parts[3] <> p_phase
         or (p_phase in ('before', 'during', 'after') and (
           p_media_type <> 'photo'::public.media_type
           or v_filename !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
           or v_mimetype not like 'image/%'))
         or (p_phase = 'document' and (
           p_media_type <> 'document'::public.media_type
           or v_filename !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
           or v_mimetype <> 'application/pdf'))
         or v_size > 20971520 then
        raise exception 'Invalid job-evidence finalization';
      end if;

      select profile.id into v_profile_id
      from public.jobs as job
      join public.professional_profiles as professional on professional.id = job.professional_id
      join public.profiles as profile on profile.id = professional.profile_id
      where job.id = p_entity_id and professional.status = 'approved'
        and profile.auth_user_id::text = v_owner_id;
      if v_profile_id is null then
        raise exception 'Evidence owner is not the assigned approved professional';
      end if;

      insert into public.job_media
        (job_id, media_type, phase, storage_bucket, storage_path, uploaded_by)
      values (p_entity_id, p_media_type, p_phase, p_bucket, p_path, v_profile_id)
      on conflict (storage_bucket, storage_path) do nothing;
      select media.id into v_metadata_id from public.job_media as media
      where media.storage_bucket = p_bucket and media.storage_path = p_path
        and media.job_id = p_entity_id and media.media_type = p_media_type
        and media.phase = p_phase and media.uploaded_by = v_profile_id;

    else
      raise exception 'Bucket does not support finalized metadata';
  end case;

  if v_metadata_id is null then
    raise exception 'Storage path is already finalized with different metadata';
  end if;
  return v_metadata_id;
end;
$$;

comment on function public.finalize_storage_upload(text, text, uuid, public.media_type, text, text) is
'Service-role-only metadata finalization. It validates the existing object, immutable entity path, and Storage-reported MIME/size. Task 8 must validate the session and declared upload before signing, inspect actual bytes after upload, and remove orphan objects on every failed finalization.';

revoke all on function public.finalize_storage_upload(text, text, uuid, public.media_type, text, text)
from public, anon, authenticated;
grant execute on function public.finalize_storage_upload(text, text, uuid, public.media_type, text, text)
to service_role;
