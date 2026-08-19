begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(9);

select is(
  (
    select count(*)
    from public.service_issue_types as issue
    join public.service_categories as category on category.id = issue.category_id
    where category.slug = 'aire_acondicionado' and issue.active
  ),
  7::bigint,
  'the air-conditioning pilot has its seven active issue types'
);

select results_eq(
  $$
    select name
    from public.service_zones
    where active
    order by name
  $$,
  $$
    values
      ('Berazategui'::text),
      ('CABA'),
      ('Corredor Sur AMBA'),
      ('Hudson')
  $$,
  'the active pilot territory is CABA and the southern AMBA corridor'
);

select is(
  (
    select value ->> 'timezone'
    from public.platform_settings
    where key = 'scheduling.default_slots'
  ),
  'America/Buenos_Aires',
  'default scheduling uses the Buenos Aires timezone'
);

select is(
  (
    select jsonb_array_length(value -> 'windows')
    from public.platform_settings
    where key = 'scheduling.default_slots'
  ),
  5,
  'the pilot exposes five default service windows'
);

select ok(
  coalesce(
    (
      select
        value -> 'flexible' ->> 'verified_professional_required' = 'true'
        and value -> 'priority' ->> 'verified_professional_required' = 'true'
        and (value -> 'flexible' ->> 'base_sla_minutes')::integer = 240
        and (value -> 'priority' ->> 'base_sla_minutes')::integer = 90
      from public.platform_settings
      where key = 'scheduling.modalities'
    ),
    false
  ),
  'Flexible and Priority have explicit verified-professional SLAs'
);

select ok(
  coalesce(
    (
      select
        value ->> 'environment' = 'staging'
        and value ->> 'currency' = 'ARS'
        and (value ->> 'nonbinding')::boolean
      from public.platform_settings
      where key = 'pricing.staging_sample'
    ),
    false
  ),
  'sample pricing is explicitly nonbinding staging data'
);

select is(
  (
    select count(*)
    from public.pricing_rules as pricing
    join public.service_categories as category on category.id = pricing.category_id
    join public.service_issue_types as issue
      on issue.id = pricing.issue_type_id
      and issue.category_id = category.id
    where category.slug = 'aire_acondicionado'
      and pricing.active
      and pricing.zone_slug in ('caba', 'gba_sur', 'berazategui', 'hudson')
  ),
  28::bigint,
  'all seven issues have sample pricing in the four pilot zones'
);

select ok(
  coalesce(
    (
      select
        value @> '["manifold","vacuum_pump","multimeter","leak_detector","ladder","ppe"]'::jsonb
      from public.platform_settings
      where key = 'professional.required_tools'
    ),
    false
  ),
  'the onboarding tool catalog covers the minimum air-conditioning kit'
);

select ok(
  coalesce(
    (
      select
        (value ->> 'fee_rate')::numeric = 0.18
        and value ->> 'currency' = 'ARS'
      from public.platform_settings
      where key = 'marketplace'
    ),
    false
  ),
  'marketplace fee and currency use the canonical settings contract'
);

select * from finish();
rollback;
