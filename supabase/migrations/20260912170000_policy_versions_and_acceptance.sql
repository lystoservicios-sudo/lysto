begin;

alter table private.account_legal_documents drop constraint if exists account_legal_documents_kind_check;
alter table private.account_legal_documents
  add constraint account_legal_documents_kind_check check(kind in('terms','privacy','cancellations','service')),
  add column if not exists title text check(title is null or length(trim(title)) between 3 and 200),
  add column if not exists effective_at timestamptz,
  add column if not exists retired_at timestamptz,
  add column if not exists approved_by text check(approved_by is null or length(trim(approved_by)) between 3 and 200),
  add constraint account_legal_documents_lifecycle_check check(
    (approved_at is null and effective_at is null and approved_by is null)
    or (approved_at is not null and effective_at is not null and approved_by is not null and not test_only)
  ),
  add constraint account_legal_documents_retirement_check check(retired_at is null or (effective_at is not null and retired_at>effective_at));

create unique index account_legal_documents_one_current_kind
  on private.account_legal_documents(kind) where approved_at is not null and retired_at is null and not test_only;

create table private.policy_acceptances(
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check(kind in('terms','privacy','cancellations','service')),
  version text not null,
  subject_kind text not null check(subject_kind in('account','service_quote','job_extra')),
  subject_id uuid not null,
  document_sha256 text not null check(document_sha256 ~ '^[a-f0-9]{64}$'),
  evidence jsonb not null default '{}'::jsonb check(
    jsonb_typeof(evidence)='object'
    and octet_length(evidence::text)<=4096
    and evidence-'source'-'correlationId'-'userAgentHash'='{}'::jsonb
  ),
  accepted_at timestamptz not null default clock_timestamp(),
  foreign key(kind,version) references private.account_legal_documents(kind,version),
  unique(profile_id,kind,version,subject_kind,subject_id)
);
alter table private.policy_acceptances enable row level security;
alter table private.policy_acceptances force row level security;
revoke all on private.policy_acceptances from public,anon,authenticated,service_role;

create function private.prevent_policy_acceptance_update() returns trigger language plpgsql set search_path='' as $$
begin raise exception using errcode='42501',message='policy_acceptance_immutable'; end $$;
create trigger policy_acceptance_immutable before update on private.policy_acceptances
  for each row execute function private.prevent_policy_acceptance_update();

create function public.record_policy_acceptance(
  p_kind text,p_version text,p_subject_kind text,p_subject_id uuid,p_evidence jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_profile uuid:=private.current_profile_id();v_customer uuid:=private.current_customer_id();v_doc private.account_legal_documents%rowtype;v_row private.policy_acceptances%rowtype;
begin
  if v_profile is null or v_customer is null then raise exception using errcode='42501',message='customer_required';end if;
  if p_kind not in('terms','privacy','cancellations','service') or p_subject_kind not in('account','service_quote','job_extra')
    or jsonb_typeof(coalesce(p_evidence,'{}')) is distinct from 'object' or octet_length(coalesce(p_evidence,'{}')::text)>4096
    or coalesce(p_evidence,'{}')-'source'-'correlationId'-'userAgentHash'<>'{}'::jsonb
    then raise exception using errcode='22023',message='invalid_policy_acceptance';end if;
  select * into v_doc from private.account_legal_documents where kind=p_kind and version=p_version
    and approved_at is not null and effective_at<=clock_timestamp() and retired_at is null and not test_only;
  if not found then raise exception using errcode='40001',message='policy_version_unavailable';end if;
  if not (
    (p_subject_kind='account' and p_subject_id=v_profile)
    or (p_subject_kind='service_quote' and exists(select 1 from public.service_quotes q where q.id=p_subject_id and q.customer_id=v_customer))
    or (p_subject_kind='job_extra' and exists(select 1 from public.job_extras e join public.jobs j on j.id=e.job_id where e.id=p_subject_id and j.customer_id=v_customer))
  ) then raise exception using errcode='42501',message='policy_subject_forbidden';end if;
  insert into private.policy_acceptances(profile_id,kind,version,subject_kind,subject_id,document_sha256,evidence)
    values(v_profile,p_kind,p_version,p_subject_kind,p_subject_id,v_doc.content_sha256,coalesce(p_evidence,'{}'))
    on conflict(profile_id,kind,version,subject_kind,subject_id) do nothing;
  select * into v_row from private.policy_acceptances where profile_id=v_profile and kind=p_kind and version=p_version and subject_kind=p_subject_kind and subject_id=p_subject_id;
  return jsonb_build_object('id',v_row.id,'kind',v_row.kind,'version',v_row.version,'subjectKind',v_row.subject_kind,'subjectId',v_row.subject_id,'acceptedAt',v_row.accepted_at);
end $$;

revoke all on function private.prevent_policy_acceptance_update(),public.record_policy_acceptance(text,text,text,uuid,jsonb) from public,anon,service_role;
grant execute on function public.record_policy_acceptance(text,text,text,uuid,jsonb) to authenticated;

commit;
