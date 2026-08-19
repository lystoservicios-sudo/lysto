-- Lysto MVP operativo - esquema inicial Supabase
-- No contiene secretos. Aplicar primero en un branch o entorno de staging.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- Enums idempotentes
DO $$ BEGIN CREATE TYPE public.user_role AS ENUM ('customer', 'professional', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.professional_status AS ENUM ('invited','form_started','form_submitted','under_review','approved','rejected','suspended','inactive'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.request_status AS ENUM ('draft','diagnosis_completed','address_completed','schedule_completed','price_selected','pending_payment','payment_approved','matching','pending_assignment','pending_professional_acceptance','assigned','cancelled','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.job_status AS ENUM ('pending_assignment','pending_professional_acceptance','confirmed','technician_on_way','arrived','onsite_diagnosis','waiting_customer_approval','in_progress','completed_pending_customer_confirmation','completed','cancelled_by_customer','cancelled_by_professional','cancelled_by_admin','disputed','warranty_claim'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_status AS ENUM ('pending','authorized','approved','rejected','cancelled','refunded','partially_refunded','captured','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.media_type AS ENUM ('photo','video','document'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.property_type AS ENUM ('house','apartment','commercial','office'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.urgency_level AS ENUM ('flexible','priority'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.maintenance_option AS ENUM ('none','filters_30_days','filters_60_days','filters_90_days','deep_cleaning_6_months','deep_cleaning_annual','gas_review_30_days','outdoor_unit_review','electrical_review','pending_part_replacement','second_visit_recommended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  role public.user_role not null default 'customer',
  first_name text not null default '',
  last_name text not null default '',
  email citext not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(role, email)
);
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists customer_profiles_updated_at on public.customer_profiles;
create trigger customer_profiles_updated_at before update on public.customer_profiles for each row execute function public.set_updated_at();

create table if not exists public.admin_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  can_manage_payments boolean not null default false,
  can_manage_professionals boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists admin_profiles_updated_at on public.admin_profiles;
create trigger admin_profiles_updated_at before update on public.admin_profiles for each row execute function public.set_updated_at();

create table if not exists public.professional_invitations (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  phone text,
  specialty_slug text not null default 'aire_acondicionado',
  token_hash text not null unique,
  status text not null default 'sent' check (status in ('sent','opened','completed','expired','cancelled')),
  expires_at timestamptz not null default now() + interval '14 days',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists professional_invitations_updated_at on public.professional_invitations;
create trigger professional_invitations_updated_at before update on public.professional_invitations for each row execute function public.set_updated_at();

create table if not exists public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  invitation_id uuid references public.professional_invitations(id),
  status public.professional_status not null default 'invited',
  birthdate date,
  dni text,
  cuil text,
  base_location text,
  years_experience int not null default 0 check (years_experience >= 0),
  license_number text,
  license_entity text,
  license_expires_at date,
  bio text,
  has_mobility boolean not null default false,
  mobility_type text,
  rating_avg numeric(3,2),
  jobs_completed int not null default 0,
  acceptance_rate numeric(4,3) not null default 1,
  internal_score int not null default 50 check (internal_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists professional_profiles_updated_at on public.professional_profiles;
create trigger professional_profiles_updated_at before update on public.professional_profiles for each row execute function public.set_updated_at();

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  street text not null,
  number text not null,
  floor text,
  apartment text,
  city text not null default 'Buenos Aires',
  province text not null default 'Buenos Aires',
  postal_code text,
  reference text,
  property_type public.property_type not null default 'apartment',
  has_elevator boolean,
  has_parking boolean,
  stairs_required boolean,
  outdoor_unit_at_height boolean,
  outdoor_unit_on_balcony boolean,
  difficult_access boolean,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customer_addresses_customer on public.customer_addresses(customer_id);
drop trigger if exists customer_addresses_updated_at on public.customer_addresses;
create trigger customer_addresses_updated_at before update on public.customer_addresses for each row execute function public.set_updated_at();

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists service_categories_updated_at on public.service_categories;
create trigger service_categories_updated_at before update on public.service_categories for each row execute function public.set_updated_at();

create table if not exists public.service_issue_types (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  icon text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category_id, slug)
);
drop trigger if exists service_issue_types_updated_at on public.service_issue_types;
create trigger service_issue_types_updated_at before update on public.service_issue_types for each row execute function public.set_updated_at();

create table if not exists public.service_questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id) on delete cascade,
  issue_type_id uuid references public.service_issue_types(id) on delete cascade,
  code text not null,
  label text not null,
  input_type text not null default 'single_choice',
  required boolean not null default false,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category_id, code)
);
drop trigger if exists service_questions_updated_at on public.service_questions;
create trigger service_questions_updated_at before update on public.service_questions for each row execute function public.set_updated_at();

create table if not exists public.service_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.service_questions(id) on delete cascade,
  value text not null,
  label text not null,
  sort_order int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(question_id, value)
);

create table if not exists public.diagnosis_rules (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id) on delete cascade,
  issue_type_id uuid not null references public.service_issue_types(id) on delete cascade,
  cause_code text not null,
  cause_label text not null,
  base_score numeric(4,3) not null check (base_score between 0 and 1),
  customer_hint text not null,
  technician_checklist text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(issue_type_id, cause_code)
);
drop trigger if exists diagnosis_rules_updated_at on public.diagnosis_rules;
create trigger diagnosis_rules_updated_at before update on public.diagnosis_rules for each row execute function public.set_updated_at();

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  category_id uuid not null references public.service_categories(id),
  issue_type_id uuid not null references public.service_issue_types(id),
  status public.request_status not null default 'draft',
  time_since text check (time_since in ('today','days','weeks','months')),
  address_id uuid references public.customer_addresses(id),
  preferred_date date,
  preferred_time_window text,
  urgency_level public.urgency_level,
  selected_price_option_id uuid,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_service_requests_customer on public.service_requests(customer_id);
create index if not exists idx_service_requests_status on public.service_requests(status);
drop trigger if exists service_requests_updated_at on public.service_requests;
create trigger service_requests_updated_at before update on public.service_requests for each row execute function public.set_updated_at();

create table if not exists public.request_answers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  question_code text not null,
  answer_value text,
  answer_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(request_id, question_code)
);

create table if not exists public.request_media (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  media_type public.media_type not null,
  storage_bucket text not null,
  storage_path text not null,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_request_media_request on public.request_media(request_id);

create table if not exists public.diagnosis_reports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.service_requests(id) on delete cascade,
  level text not null check (level in ('low','medium','high')),
  top_cause_code text not null,
  top_cause_label text not null,
  possible_causes jsonb not null default '[]'::jsonb,
  customer_summary text not null,
  technician_summary text not null,
  disclaimer text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.price_options (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  option_type public.urgency_level not null,
  title text not null,
  description text,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'ARS',
  platform_fee numeric(12,2) not null default 0,
  professional_amount numeric(12,2) not null default 0,
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  unique(request_id, option_type)
);

DO $$
BEGIN
  alter table public.service_requests add constraint service_requests_selected_price_fk foreign key (selected_price_option_id) references public.price_options(id) deferrable initially deferred;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

create table if not exists public.professional_documents (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  document_type text not null,
  storage_bucket text not null,
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.professional_tools (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  tool_code text not null,
  tool_label text not null,
  has_tool boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique(professional_id, tool_code)
);

create table if not exists public.professional_service_categories (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  category_id uuid not null references public.service_categories(id) on delete cascade,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique(professional_id, category_id)
);

create table if not exists public.professional_service_zones (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  zone_slug text not null,
  zone_name text not null,
  radius_km int not null default 10,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(professional_id, zone_slug)
);

create table if not exists public.professional_availability (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(professional_id, weekday, start_time, end_time)
);

create table if not exists public.professional_payment_accounts (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  provider text not null default 'mercadopago',
  provider_user_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  status text not null default 'not_connected' check (status in ('not_connected','pending','connected','error','revoked')),
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(professional_id, provider)
);
drop trigger if exists professional_payment_accounts_updated_at on public.professional_payment_accounts;
create trigger professional_payment_accounts_updated_at before update on public.professional_payment_accounts for each row execute function public.set_updated_at();

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.service_requests(id) on delete cascade,
  customer_id uuid not null references public.customer_profiles(id),
  professional_id uuid references public.professional_profiles(id),
  status public.job_status not null default 'pending_assignment',
  scheduled_date date,
  scheduled_time_window text,
  accepted_at timestamptz,
  technician_on_way_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  final_amount numeric(12,2),
  warranty_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_jobs_customer on public.jobs(customer_id);
create index if not exists idx_jobs_professional on public.jobs(professional_id);
create index if not exists idx_jobs_status on public.jobs(status);
drop trigger if exists jobs_updated_at on public.jobs;
create trigger jobs_updated_at before update on public.jobs for each row execute function public.set_updated_at();

create table if not exists public.job_status_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  status public.job_status not null,
  actor_profile_id uuid references public.profiles(id),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_job_status_events_job on public.job_status_events(job_id, created_at);

create table if not exists public.job_media (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  media_type public.media_type not null,
  phase text not null default 'during' check (phase in ('before','during','after','document')),
  storage_bucket text not null,
  storage_path text not null,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.customer_equipment (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  address_id uuid references public.customer_addresses(id) on delete set null,
  category_id uuid references public.service_categories(id),
  nickname text not null,
  brand text,
  model text,
  equipment_type text,
  frigorias text,
  serial_number text,
  photo_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customer_equipment_customer on public.customer_equipment(customer_id);
drop trigger if exists customer_equipment_updated_at on public.customer_equipment;
create trigger customer_equipment_updated_at before update on public.customer_equipment for each row execute function public.set_updated_at();

create table if not exists public.job_final_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  equipment_id uuid references public.customer_equipment(id),
  real_diagnosis text not null,
  work_done text not null,
  parts_used text,
  final_state text not null check (final_state in ('resolved','partially_resolved','pending_part','requires_second_visit','not_resolved')),
  maintenance_option public.maintenance_option not null default 'none',
  next_maintenance_date date,
  warranty_days int not null default 0,
  internal_notes text,
  public_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_service_records (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.customer_equipment(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  professional_id uuid references public.professional_profiles(id),
  reported_problem text,
  real_diagnosis text,
  work_done text,
  parts_used text,
  next_maintenance_option public.maintenance_option not null default 'none',
  next_maintenance_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete set null,
  request_id uuid references public.service_requests(id) on delete set null,
  customer_id uuid not null references public.customer_profiles(id),
  professional_id uuid references public.professional_profiles(id),
  provider text not null default 'mercadopago',
  provider_payment_id text,
  provider_preference_id text,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'ARS',
  status public.payment_status not null default 'pending',
  payment_type text not null default 'reservation',
  marketplace_fee numeric(12,2) not null default 0,
  professional_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_payments_provider_payment on public.payments(provider, provider_payment_id) where provider_payment_id is not null;
drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete set null,
  provider text not null default 'mercadopago',
  provider_event_id text not null,
  event_type text not null,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

create table if not exists public.payout_records (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id),
  payment_id uuid references public.payments(id) on delete set null,
  amount numeric(12,2) not null,
  currency text not null default 'ARS',
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','cancelled')),
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists payout_records_updated_at on public.payout_records;
create trigger payout_records_updated_at before update on public.payout_records for each row execute function public.set_updated_at();

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  customer_id uuid not null references public.customer_profiles(id),
  professional_id uuid references public.professional_profiles(id),
  service_rating int not null check (service_rating between 1 and 5),
  professional_rating int not null check (professional_rating between 1 and 5),
  problem_resolved boolean,
  would_hire_again boolean,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete set null,
  customer_id uuid references public.customer_profiles(id),
  professional_id uuid references public.professional_profiles(id),
  status text not null default 'open' check (status in ('open','in_review','resolved','rejected')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  description text not null,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists complaints_updated_at on public.complaints;
create trigger complaints_updated_at before update on public.complaints for each row execute function public.set_updated_at();

create table if not exists public.warranty_claims (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  customer_id uuid not null references public.customer_profiles(id),
  status text not null default 'open' check (status in ('open','approved','rejected','completed')),
  description text not null,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists warranty_claims_updated_at on public.warranty_claims;
create trigger warranty_claims_updated_at before update on public.warranty_claims for each row execute function public.set_updated_at();

create table if not exists public.quality_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete set null,
  professional_id uuid references public.professional_profiles(id),
  event_type text not null,
  score_delta int not null default 0,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id) on delete cascade,
  issue_type_id uuid references public.service_issue_types(id) on delete cascade,
  zone_slug text not null default 'caba',
  base_price numeric(12,2) not null default 35000,
  issue_adjustment numeric(12,2) not null default 0,
  priority_multiplier numeric(5,3) not null default 1.25,
  platform_fee_rate numeric(5,3) not null default 0.18,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category_id, issue_type_id, zone_slug)
);
drop trigger if exists pricing_rules_updated_at on public.pricing_rules;
create trigger pricing_rules_updated_at before update on public.pricing_rules for each row execute function public.set_updated_at();

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_audit_logs_entity on public.admin_audit_logs(entity_type, entity_id, created_at);

-- Buckets privados de Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('request-media', 'request-media', false, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']),
  ('professional-documents', 'professional-documents', false, 10485760, array['image/jpeg','image/png','application/pdf']),
  ('job-media', 'job-media', false, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- RLS base
alter table public.profiles enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.professional_invitations enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.service_categories enable row level security;
alter table public.service_issue_types enable row level security;
alter table public.service_questions enable row level security;
alter table public.service_question_options enable row level security;
alter table public.diagnosis_rules enable row level security;
alter table public.service_requests enable row level security;
alter table public.request_answers enable row level security;
alter table public.request_media enable row level security;
alter table public.diagnosis_reports enable row level security;
alter table public.price_options enable row level security;
alter table public.professional_documents enable row level security;
alter table public.professional_tools enable row level security;
alter table public.professional_service_categories enable row level security;
alter table public.professional_service_zones enable row level security;
alter table public.professional_availability enable row level security;
alter table public.professional_payment_accounts enable row level security;
alter table public.jobs enable row level security;
alter table public.job_status_events enable row level security;
alter table public.job_media enable row level security;
alter table public.customer_equipment enable row level security;
alter table public.job_final_reports enable row level security;
alter table public.equipment_service_records enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.payout_records enable row level security;
alter table public.reviews enable row level security;
alter table public.complaints enable row level security;
alter table public.warranty_claims enable row level security;
alter table public.quality_events enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.platform_settings enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Políticas generales. Refinar en staging con tests RLS antes de producción.
drop policy if exists "service config readable" on public.service_categories;
create policy "service config readable" on public.service_categories for select using (active = true or public.current_user_role() = 'admin');
drop policy if exists "issue config readable" on public.service_issue_types;
create policy "issue config readable" on public.service_issue_types for select using (active = true or public.current_user_role() = 'admin');
drop policy if exists "questions readable" on public.service_questions;
create policy "questions readable" on public.service_questions for select using (active = true or public.current_user_role() = 'admin');
drop policy if exists "question options readable" on public.service_question_options;
create policy "question options readable" on public.service_question_options for select using (true);
drop policy if exists "diagnosis rules admin read" on public.diagnosis_rules;
create policy "diagnosis rules admin read" on public.diagnosis_rules for select using (active = true or public.current_user_role() = 'admin');
drop policy if exists "admins manage service config" on public.service_categories;
create policy "admins manage service config" on public.service_categories for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists "admins manage issue config" on public.service_issue_types;
create policy "admins manage issue config" on public.service_issue_types for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists "admins manage questions" on public.service_questions;
create policy "admins manage questions" on public.service_questions for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists "admins manage question options" on public.service_question_options;
create policy "admins manage question options" on public.service_question_options for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists "admins manage diagnosis rules" on public.diagnosis_rules;
create policy "admins manage diagnosis rules" on public.diagnosis_rules for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select using (auth_user_id = auth.uid() or public.current_user_role() = 'admin');
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
drop policy if exists "admins all profiles" on public.profiles;
create policy "admins all profiles" on public.profiles for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

drop policy if exists "customers own profile" on public.customer_profiles;
create policy "customers own profile" on public.customer_profiles for select using (profile_id = public.current_profile_id() or public.current_user_role() = 'admin');
drop policy if exists "professionals own profile" on public.professional_profiles;
create policy "professionals own profile" on public.professional_profiles for select using (profile_id = public.current_profile_id() or public.current_user_role() = 'admin');
drop policy if exists "admins manage professional profiles" on public.professional_profiles;
create policy "admins manage professional profiles" on public.professional_profiles for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists "admins manage invitations" on public.professional_invitations;
create policy "admins manage invitations" on public.professional_invitations for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

drop policy if exists "customers manage own addresses" on public.customer_addresses;
create policy "customers manage own addresses" on public.customer_addresses for all using (customer_id in (select id from public.customer_profiles where profile_id = public.current_profile_id()) or public.current_user_role() = 'admin') with check (customer_id in (select id from public.customer_profiles where profile_id = public.current_profile_id()) or public.current_user_role() = 'admin');

drop policy if exists "customers own requests" on public.service_requests;
create policy "customers own requests" on public.service_requests for all using (customer_id in (select id from public.customer_profiles where profile_id = public.current_profile_id()) or public.current_user_role() = 'admin') with check (customer_id in (select id from public.customer_profiles where profile_id = public.current_profile_id()) or public.current_user_role() = 'admin');
drop policy if exists "professionals assigned request read" on public.service_requests;
create policy "professionals assigned request read" on public.service_requests for select using (id in (select request_id from public.jobs where professional_id in (select id from public.professional_profiles where profile_id = public.current_profile_id())));
drop policy if exists "request answers owner" on public.request_answers;
create policy "request answers owner" on public.request_answers for all using (request_id in (select id from public.service_requests where customer_id in (select id from public.customer_profiles where profile_id = public.current_profile_id())) or public.current_user_role() = 'admin') with check (request_id in (select id from public.service_requests where customer_id in (select id from public.customer_profiles where profile_id = public.current_profile_id())) or public.current_user_role() = 'admin');
drop policy if exists "request media owner" on public.request_media;
create policy "request media owner" on public.request_media for all using (request_id in (select id from public.service_requests where customer_id in (select id from public.customer_profiles where profile_id = public.current_profile_id())) or public.current_user_role() = 'admin') with check (request_id in (select id from public.service_requests where customer_id in (select id from public.customer_profiles where profile_id = public.current_profile_id())) or public.current_user_role() = 'admin');
drop policy if exists "diagnosis report owner" on public.diagnosis_reports;
create policy "diagnosis report owner" on public.diagnosis_reports for select using (request_id in (select id from public.service_requests where customer_id in (select id from public.customer_profiles where profile_id = public.current_profile_id())) or request_id in (select request_id from public.jobs where professional_id in (select id from public.professional_profiles where profile_id = public.current_profile_id())) or public.current_user_role() = 'admin');
drop policy if exists "price options owner" on public.price_options;
create policy "price options owner" on public.price_options for select using (request_id in (select id from public.service_requests where customer_id in (select id from public.customer_profiles where profile_id = public.current_profile_id())) or public.current_user_role() = 'admin');

drop policy if exists "jobs participants read" on public.jobs;
create policy "jobs participants read" on public.jobs for select using (customer_id in (select id from public.customer_profiles where profile_id = public.current_profile_id()) or professional_id in (select id from public.professional_profiles where profile_id = public.current_profile_id()) or public.current_user_role() = 'admin');
drop policy if exists "admins manage jobs" on public.jobs;
create policy "admins manage jobs" on public.jobs for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists "job events participants read" on public.job_status_events;
create policy "job events participants read" on public.job_status_events for select using (job_id in (select id from public.jobs where customer_id in (select id from public.customer_profiles where profile_id = public.current_profile_id()) or professional_id in (select id from public.professional_profiles where profile_id = public.current_profile_id())) or public.current_user_role() = 'admin');

drop policy if exists "equipment participants read" on public.customer_equipment;
create policy "equipment participants read" on public.customer_equipment for select using (customer_id in (select id from public.customer_profiles where profile_id = public.current_profile_id()) or public.current_user_role() = 'admin');
drop policy if exists "admins manage equipment" on public.customer_equipment;
create policy "admins manage equipment" on public.customer_equipment for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists "reviews customer insert" on public.reviews;
create policy "reviews customer insert" on public.reviews for insert with check (customer_id in (select id from public.customer_profiles where profile_id = public.current_profile_id()));
drop policy if exists "reviews participants read" on public.reviews;
create policy "reviews participants read" on public.reviews for select using (customer_id in (select id from public.customer_profiles where profile_id = public.current_profile_id()) or professional_id in (select id from public.professional_profiles where profile_id = public.current_profile_id()) or public.current_user_role() = 'admin');

drop policy if exists "payments participants read" on public.payments;
create policy "payments participants read" on public.payments for select using (customer_id in (select id from public.customer_profiles where profile_id = public.current_profile_id()) or professional_id in (select id from public.professional_profiles where profile_id = public.current_profile_id()) or public.current_user_role() = 'admin');
drop policy if exists "payment events admin" on public.payment_events;
create policy "payment events admin" on public.payment_events for select using (public.current_user_role() = 'admin');
drop policy if exists "admin settings" on public.platform_settings;
create policy "admin settings" on public.platform_settings for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists "admin audit read" on public.admin_audit_logs;
create policy "admin audit read" on public.admin_audit_logs for select using (public.current_user_role() = 'admin');

-- Storage policies conservadoras: usuarios autenticados pueden subir a buckets privados; lectura se hará con signed URLs/server-side en MVP.
drop policy if exists "authenticated request media upload" on storage.objects;
create policy "authenticated request media upload" on storage.objects for insert with check (bucket_id = 'request-media' and auth.role() = 'authenticated');
drop policy if exists "authenticated job media upload" on storage.objects;
create policy "authenticated job media upload" on storage.objects for insert with check (bucket_id = 'job-media' and auth.role() = 'authenticated');
drop policy if exists "authenticated professional docs upload" on storage.objects;
create policy "authenticated professional docs upload" on storage.objects for insert with check (bucket_id = 'professional-documents' and auth.role() = 'authenticated');
