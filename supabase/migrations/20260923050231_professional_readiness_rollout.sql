-- Publishing schema must not immediately disqualify existing approved technicians.
-- Operations enables this single switch only after auditing legacy dossiers and
-- seller accounts. The application roles cannot read or change it directly.
create table private.professional_readiness_rollout (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into private.professional_readiness_rollout(singleton,enabled) values(true,false);
alter table private.professional_readiness_rollout enable row level security;
alter table private.professional_readiness_rollout force row level security;
revoke all on private.professional_readiness_rollout from public,anon,authenticated,service_role;

create function private.professional_readiness_enforced() returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select enabled from private.professional_readiness_rollout where singleton),false);
$$;
revoke all on function private.professional_readiness_enforced() from public,anon,authenticated,service_role;

create or replace function private.professional_readiness_reasons(p_id uuid) returns text[]
language sql stable security definer set search_path='' as $$
  select case when not private.professional_readiness_enforced() then array[]::text[] else
    array_remove(array[
      case when not private.professional_clearance_valid(p_id) then 'documentos' end,
      case when not exists(select 1 from private.professional_avatars a
        join public.professional_profiles pro on pro.id=a.professional_id
        join public.profiles profile on profile.id=pro.profile_id
        join storage.objects o on o.bucket_id='public-avatars' and o.name=a.object_path
        where a.professional_id=p_id and profile.avatar_url like '%/storage/v1/object/public/public-avatars/'||a.object_path)
        then 'foto' end,
      case when not exists(select 1 from public.mp_split_connected_accounts m
        where m.seller_id=p_id::text and m.enabled) then 'mercado_pago' end
    ],null)::text[] end;
$$;

create or replace function private.professional_ready_for_new_work(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select case when private.professional_readiness_enforced()
    then cardinality(private.professional_readiness_reasons(p_id))=0
    else private.professional_clearance_valid(p_id) end;
$$;

create or replace function private.assignment_candidate_is_eligible(
  p_job_id uuid,p_professional_id uuid,p_starts_at timestamptz,p_ends_at timestamptz
) returns boolean language sql stable security definer set search_path='' as $$
  select (not private.professional_readiness_enforced()
      or private.professional_ready_for_new_work(p_professional_id))
    and private.assignment_candidate_is_eligible_without_readiness(
      p_job_id,p_professional_id,p_starts_at,p_ends_at);
$$;

create or replace function private.guard_new_professional_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.status<>'pending_professional_acceptance' then return new; end if;
  elsif new.status<>'pending_professional_acceptance'
    or (old.status='pending_professional_acceptance' and new.professional_id is not distinct from old.professional_id) then
    return new;
  end if;
  if not private.professional_readiness_enforced() then return new; end if;
  perform 1 from public.professional_profiles where id=new.professional_id for share;
  perform 1 from public.mp_split_connected_accounts where seller_id=new.professional_id::text and enabled for share;
  if not private.professional_ready_for_new_work(new.professional_id) then
    raise exception using errcode='22023',message='Professional not ready for new work';
  end if;
  return new;
end; $$;

revoke all on function private.professional_readiness_reasons(uuid),
  private.professional_ready_for_new_work(uuid),
  private.assignment_candidate_is_eligible(uuid,uuid,timestamptz,timestamptz),
  private.guard_new_professional_assignment()
  from public,anon,authenticated,service_role;
