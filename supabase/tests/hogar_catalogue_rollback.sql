-- pgTAP catalogue coverage for the disposable CI database only.
-- Snapshot source: lib/customer-homes/contracts.ts ROOM_CATALOG; the unit source
-- guard rejects drift. This validator does not query addresses or persist rows.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
set local role postgres;
set local statement_timeout='30s';

create temporary table hogar_catalogue on commit drop as
select catalogue.* from jsonb_to_recordset($room_catalog$[
  {"kind":"living","variants":["compact","family","dining"],"home_kinds":["house","apartment","ph"]},
  {"kind":"bedroom","variants":["principal","double","guest"],"home_kinds":["house","apartment","ph"]},
  {"kind":"kitchen","variants":["linear","l","island"],"home_kinds":["house","apartment","ph","office","commercial"]},
  {"kind":"bathroom","variants":["shower","bathtub","compact"],"home_kinds":["house","apartment","ph","office","commercial"]},
  {"kind":"office","variants":["individual","shared","studio"],"home_kinds":["house","apartment","ph","office","commercial"]},
  {"kind":"dining","variants":["compact","family"],"home_kinds":["house","apartment","ph","office","commercial"]},
  {"kind":"laundry","variants":["compact","separate"],"home_kinds":["house","apartment","ph","office","commercial"]},
  {"kind":"hall","variants":["entrance","corridor"],"home_kinds":["house","apartment","ph","office","commercial"]},
  {"kind":"storage","variants":["closet","utility"],"home_kinds":["house","apartment","ph","office","commercial"]},
  {"kind":"garage","variants":["single","double"],"home_kinds":["house","ph","office","commercial"]},
  {"kind":"patio","variants":["courtyard","garden"],"home_kinds":["house","apartment","ph","office","commercial"]},
  {"kind":"balcony","variants":["narrow","wide"],"home_kinds":["house","apartment","ph","office","commercial"]},
  {"kind":"terrace","variants":["open","covered"],"home_kinds":["house","apartment","ph","office","commercial"]},
  {"kind":"meeting","variants":["compact","boardroom"],"home_kinds":["office","commercial"]},
  {"kind":"reception","variants":["compact","lounge"],"home_kinds":["office","commercial"]},
  {"kind":"commercial","variants":["retail","open"],"home_kinds":["commercial"]}
]$room_catalog$::jsonb) as catalogue(kind text, variants jsonb, home_kinds jsonb);

create temporary table hogar_catalogue_cases on commit drop as
with home(kind) as (values ('house'), ('apartment'), ('ph'), ('office'), ('commercial')),
cases as (
  -- Every actual variant in every compatible home kind, exterior flags enabled.
  select 'compatible' as category, catalogue.kind as room_kind, variant.value as variant,
    compatible.value as home_kind, true as balcony, true as terrace, true as accepted
  from pg_temp.hogar_catalogue catalogue
  cross join lateral jsonb_array_elements_text(catalogue.variants) variant(value)
  cross join lateral jsonb_array_elements_text(catalogue.home_kinds) compatible(value)
  union all
  -- A non-catalogue variant must be rejected for every compatible room/home pair.
  select 'invalid_variant', catalogue.kind, 'invalid_variant', compatible.value, true, true, false
  from pg_temp.hogar_catalogue catalogue
  cross join lateral jsonb_array_elements_text(catalogue.home_kinds) compatible(value)
  union all
  -- Actual variants must not become legal in any incompatible home kind.
  select 'incompatible', catalogue.kind, variant.value, home.kind, true, true, false
  from pg_temp.hogar_catalogue catalogue
  cross join lateral jsonb_array_elements_text(catalogue.variants) variant(value)
  cross join home
  where not (catalogue.home_kinds ? home.kind)
  union all
  -- Every exterior variant also requires its matching home feature to be enabled.
  select 'disabled_exterior', catalogue.kind, variant.value, compatible.value,
    catalogue.kind <> 'balcony', catalogue.kind <> 'terrace', false
  from pg_temp.hogar_catalogue catalogue
  cross join lateral jsonb_array_elements_text(catalogue.variants) variant(value)
  cross join lateral jsonb_array_elements_text(catalogue.home_kinds) compatible(value)
  where catalogue.kind in ('balcony', 'terrace')
), payloads as (
  select cases.*, jsonb_build_object(
    'name', 'Catalogue QA', 'addressId', gen_random_uuid(), 'kind', home_kind,
    'building', case when home_kind='apartment' then 'low' else null end,
    'features', jsonb_build_object('balcony', balcony, 'terrace', terrace, 'windows', 'mixed'),
    'floors', jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'name', 'Principal', 'order', 0,
      'rooms', jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid(), 'name', room_kind, 'kind', room_kind, 'variant', variant,
        'x', 0, 'z', 0, 'width', 4, 'depth', 4, 'rotation', 0, 'windows', 'large')))),
    'placements', '[]'::jsonb
  ) as payload
  from cases
)
select category, accepted,
  format('%s: %s/%s in %s', category, room_kind, variant, home_kind) as description,
  format('select private.validate_home_layout(%L::jsonb)', payload::text) as command
from payloads;

-- Compute the plan from the fixture, never from a manually maintained count.
select plan((select count(*)::integer from pg_temp.hogar_catalogue_cases));
select case when accepted then lives_ok(command, description)
  else throws_ok(command, '22023', null, description) end
from pg_temp.hogar_catalogue_cases
order by category, description;
select * from finish();
rollback;
