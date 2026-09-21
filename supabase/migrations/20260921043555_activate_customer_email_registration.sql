begin;

-- The project owner expressly approved opening customer email registration on
-- 2026-09-21. These hashes correspond to canonicalPolicyText() in
-- lib/legal/customer-account-policies.ts.
update private.account_legal_documents
set retired_at = timestamptz '2026-09-21 00:00:00-03'
where kind in ('terms', 'privacy')
  and version <> '2026-09-21'
  and approved_at is not null
  and retired_at is null
  and not test_only;

insert into private.account_legal_documents (
  kind,
  version,
  document_url,
  content_sha256,
  approved_at,
  test_only,
  title,
  effective_at,
  approved_by
)
values
  (
    'terms',
    '2026-09-21',
    'https://lystohogar.com/terminos',
    '96f54f1c8f4e8d5d1a97cc3da7cc4824b8ed2502cbd76031811b210fd0047e2f',
    timestamptz '2026-09-21 00:00:00-03',
    false,
    'Términos del servicio de Lysto',
    timestamptz '2026-09-21 00:00:00-03',
    'Dirección de Lysto — instrucción expresa del titular del proyecto'
  ),
  (
    'privacy',
    '2026-09-21',
    'https://lystohogar.com/privacidad',
    '356f64084c777590003daaeaa688374e365c89d47e93909c8e7d4ff9035d7819',
    timestamptz '2026-09-21 00:00:00-03',
    false,
    'Política de privacidad de Lysto',
    timestamptz '2026-09-21 00:00:00-03',
    'Dirección de Lysto — instrucción expresa del titular del proyecto'
  )
on conflict (kind, version) do nothing;

do $$
begin
  if not exists (
    select 1
    from private.account_legal_documents
    where kind = 'terms'
      and version = '2026-09-21'
      and document_url = 'https://lystohogar.com/terminos'
      and content_sha256 = '96f54f1c8f4e8d5d1a97cc3da7cc4824b8ed2502cbd76031811b210fd0047e2f'
      and approved_at is not null
      and effective_at <= clock_timestamp()
      and retired_at is null
      and not test_only
  ) or not exists (
    select 1
    from private.account_legal_documents
    where kind = 'privacy'
      and version = '2026-09-21'
      and document_url = 'https://lystohogar.com/privacidad'
      and content_sha256 = '356f64084c777590003daaeaa688374e365c89d47e93909c8e7d4ff9035d7819'
      and approved_at is not null
      and effective_at <= clock_timestamp()
      and retired_at is null
      and not test_only
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Customer account legal documents do not match the approved release';
  end if;
end;
$$;

update private.account_registration_policy
set enabled = true,
    terms_version = '2026-09-21',
    privacy_version = '2026-09-21'
where singleton;

commit;
