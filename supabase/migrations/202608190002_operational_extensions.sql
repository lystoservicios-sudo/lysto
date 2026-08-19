-- Lysto MVP operativo - extensiones de operación
-- Complementa el esquema inicial con tablas auxiliares usadas por admin, capacitación, zonas, notificaciones y comprobantes.

create table if not exists public.service_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  province text not null default 'Buenos Aires',
  city text not null default 'CABA',
  active boolean not null default true,
  priority_weight int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists service_zones_updated_at on public.service_zones;
create trigger service_zones_updated_at before update on public.service_zones for each row execute function public.set_updated_at();

create table if not exists public.professional_training_modules (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  description text,
  category_slug text not null default 'aire_acondicionado',
  required_for_approval boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists professional_training_modules_updated_at on public.professional_training_modules;
create trigger professional_training_modules_updated_at before update on public.professional_training_modules for each row execute function public.set_updated_at();

create table if not exists public.professional_training_completions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  module_id uuid not null references public.professional_training_modules(id) on delete cascade,
  completed_at timestamptz not null default now(),
  score int check (score between 0 and 100),
  unique(professional_id, module_id)
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  channel text not null check (channel in ('in_app','email','whatsapp_manual','push')),
  event_type text not null,
  entity_type text,
  entity_id uuid,
  title text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists idx_notification_events_recipient on public.notification_events(recipient_profile_id, created_at desc);

create table if not exists public.public_receipts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  service_name text not null,
  professional_public_name text not null,
  work_done text not null,
  warranty_text text not null,
  next_maintenance_text text,
  published_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists idx_public_receipts_token on public.public_receipts(token) where revoked_at is null;

-- RLS para nuevas tablas
alter table public.service_zones enable row level security;
alter table public.professional_training_modules enable row level security;
alter table public.professional_training_completions enable row level security;
alter table public.notification_events enable row level security;
alter table public.public_receipts enable row level security;

drop policy if exists "service zones readable" on public.service_zones;
create policy "service zones readable" on public.service_zones for select using (active = true or public.current_user_role() = 'admin');
drop policy if exists "admins manage service zones" on public.service_zones;
create policy "admins manage service zones" on public.service_zones for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

drop policy if exists "training modules readable" on public.professional_training_modules;
create policy "training modules readable" on public.professional_training_modules for select using (active = true or public.current_user_role() = 'admin');
drop policy if exists "admins manage training modules" on public.professional_training_modules;
create policy "admins manage training modules" on public.professional_training_modules for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

drop policy if exists "professional training own read" on public.professional_training_completions;
create policy "professional training own read" on public.professional_training_completions for select using (
  professional_id in (select id from public.professional_profiles where profile_id = public.current_profile_id()) or public.current_user_role() = 'admin'
);
drop policy if exists "admins manage training completions" on public.professional_training_completions;
create policy "admins manage training completions" on public.professional_training_completions for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

drop policy if exists "notification recipient read" on public.notification_events;
create policy "notification recipient read" on public.notification_events for select using (recipient_profile_id = public.current_profile_id() or public.current_user_role() = 'admin');
drop policy if exists "admins manage notifications" on public.notification_events;
create policy "admins manage notifications" on public.notification_events for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

drop policy if exists "public receipts are public with token" on public.public_receipts;
create policy "public receipts are public with token" on public.public_receipts for select using (revoked_at is null);
drop policy if exists "admins manage public receipts" on public.public_receipts;
create policy "admins manage public receipts" on public.public_receipts for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- Función auxiliar: deja constancia de auditoría. Se invoca desde server actions/admin routes.
create or replace function public.log_admin_action(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admin can log admin actions';
  end if;
  insert into public.admin_audit_logs(actor_profile_id, action, entity_type, entity_id, metadata)
  values (public.current_profile_id(), p_action, p_entity_type, p_entity_id, p_metadata)
  returning id into v_id;
  return v_id;
end;
$$;
