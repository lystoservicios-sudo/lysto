-- Readiness requirements remain visible in the dossier before enforcement.
-- Only the assignment gate, not the diagnostic, is controlled by rollout.
create or replace function private.professional_readiness_reasons(p_id uuid) returns text[]
language sql stable security definer set search_path='' as $$
  select array_remove(array[
    case when not private.professional_clearance_valid(p_id) then 'documentos' end,
    case when not exists(select 1 from private.professional_avatars a
      join public.professional_profiles pro on pro.id=a.professional_id
      join public.profiles profile on profile.id=pro.profile_id
      join storage.objects o on o.bucket_id='public-avatars' and o.name=a.object_path
      where a.professional_id=p_id and profile.avatar_url like '%/storage/v1/object/public/public-avatars/'||a.object_path)
      then 'foto' end,
    case when not exists(select 1 from public.mp_split_connected_accounts m
      where m.seller_id=p_id::text and m.enabled) then 'mercado_pago' end
  ],null)::text[];
$$;

-- Legacy dossiers without an approved policy may still upload their existing
-- document types until Operations activates the new-work readiness rollout.
-- Once a policy exists, only its exact required types are accepted.
create or replace function private.guard_professional_document_intent() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.kind<>'professional-document' then return new; end if;
  if not private.professional_readiness_enforced() and not exists(
    select 1 from public.professional_service_categories c
    join private.professional_review_policies p on p.category_id=c.category_id
    where c.professional_id=new.entity_id) then
    return new;
  end if;
  if not exists(
    select 1 from public.professional_service_categories c
    join private.professional_review_policies p on p.category_id=c.category_id
    where c.professional_id=new.entity_id and new.document_type=any(p.required_documents)) then
    raise exception using errcode='22023',message='Document type not required by active policy';
  end if;
  return new;
end; $$;

revoke all on function private.professional_readiness_reasons(uuid),
  private.guard_professional_document_intent() from public,anon,authenticated,service_role;
