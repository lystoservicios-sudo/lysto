-- Lysto MVP operativo - funciones de operación y endurecimiento incremental.
-- No contiene secretos. Revisar en staging antes de aplicar en producción.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select coalesce(public.current_user_role() = 'admin', false); $$;

create or replace function public.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cp.id
  from public.customer_profiles cp
  join public.profiles p on p.id = cp.profile_id
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_professional_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pp.id
  from public.professional_profiles pp
  join public.profiles p on p.id = pp.profile_id
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_profile_created on public.notifications(profile_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications for select using (profile_id = public.current_profile_id() or public.is_admin());
drop policy if exists "admins manage notifications" on public.notifications;
create policy "admins manage notifications" on public.notifications for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  final_report_id uuid not null unique references public.job_final_reports(id) on delete cascade,
  public_token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.receipts enable row level security;
drop policy if exists "receipt participants read" on public.receipts;
create policy "receipt participants read" on public.receipts for select using (
  job_id in (
    select id from public.jobs
    where customer_id = public.current_customer_id()
       or professional_id = public.current_professional_id()
  ) or public.is_admin()
);

create or replace view public.public_receipt_view
with (security_invoker = true)
as
select
  r.public_token,
  j.id as job_id,
  j.status as job_status,
  j.scheduled_date,
  j.scheduled_time_window,
  fr.real_diagnosis,
  fr.work_done,
  fr.final_state,
  fr.maintenance_option,
  fr.next_maintenance_date,
  fr.warranty_days,
  ce.nickname as equipment_nickname,
  ce.brand as equipment_brand,
  ce.model as equipment_model,
  ce.equipment_type,
  p.first_name as professional_first_name,
  p.last_name as professional_last_name,
  r.created_at
from public.receipts r
join public.jobs j on j.id = r.job_id
join public.job_final_reports fr on fr.id = r.final_report_id
left join public.customer_equipment ce on ce.id = fr.equipment_id
left join public.professional_profiles pp on pp.id = j.professional_id
left join public.profiles p on p.id = pp.profile_id
where r.expires_at is null or r.expires_at > now();

create or replace function public.create_job_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.job_status_events(job_id, status, actor_profile_id, notes)
    values (new.id, new.status, public.current_profile_id(), 'job_created');
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.job_status_events(job_id, status, actor_profile_id, notes)
    values (new.id, new.status, public.current_profile_id(), 'status_changed');
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_status_event_insert on public.jobs;
create trigger jobs_status_event_insert after insert on public.jobs for each row execute function public.create_job_status_event();
drop trigger if exists jobs_status_event_update on public.jobs;
create trigger jobs_status_event_update after update of status on public.jobs for each row execute function public.create_job_status_event();

create or replace function public.create_admin_audit_event(
  action text,
  entity_type text,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can write admin audit logs';
  end if;
  insert into public.admin_audit_logs(actor_profile_id, action, entity_type, entity_id, metadata)
  values (public.current_profile_id(), action, entity_type, entity_id, metadata)
  returning id into new_id;
  return new_id;
end;
$$;

-- Políticas adicionales de escritura acotada para profesionales asignados.
drop policy if exists "professionals update own assigned jobs limited" on public.jobs;
create policy "professionals update own assigned jobs limited" on public.jobs for update using (
  professional_id = public.current_professional_id()
) with check (
  professional_id = public.current_professional_id()
);

drop policy if exists "professionals insert job media for assigned jobs" on public.job_media;
create policy "professionals insert job media for assigned jobs" on public.job_media for insert with check (
  job_id in (select id from public.jobs where professional_id = public.current_professional_id())
);

drop policy if exists "professionals read own job media" on public.job_media;
create policy "professionals read own job media" on public.job_media for select using (
  job_id in (select id from public.jobs where professional_id = public.current_professional_id()) or public.is_admin()
);

drop policy if exists "customers read own job media" on public.job_media;
create policy "customers read own job media" on public.job_media for select using (
  job_id in (select id from public.jobs where customer_id = public.current_customer_id()) or public.is_admin()
);

drop policy if exists "professionals insert final report for own job" on public.job_final_reports;
create policy "professionals insert final report for own job" on public.job_final_reports for insert with check (
  job_id in (select id from public.jobs where professional_id = public.current_professional_id())
);

drop policy if exists "final report participants read" on public.job_final_reports;
create policy "final report participants read" on public.job_final_reports for select using (
  job_id in (select id from public.jobs where customer_id = public.current_customer_id() or professional_id = public.current_professional_id()) or public.is_admin()
);
