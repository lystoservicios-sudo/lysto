begin;

select plan(7);

select is(private.get_registration_policy()->>'terms_version','2026-09-21','production terms are active');
select is(private.get_registration_policy()->>'privacy_version','2026-09-21','production privacy policy is active');
select is(private.get_registration_policy()->>'terms_url','https://lystohogar.com/terminos','production terms URL is canonical');
select is(private.get_registration_policy()->>'privacy_url','https://lystohogar.com/privacidad','production privacy URL is canonical');
select is(private.get_registration_policy()->>'terms_sha256','96f54f1c8f4e8d5d1a97cc3da7cc4824b8ed2502cbd76031811b210fd0047e2f','production terms content is approved');
select is(private.get_registration_policy()->>'privacy_sha256','356f64084c777590003daaeaa688374e365c89d47e93909c8e7d4ff9035d7819','production privacy content is approved');
select is(private.get_registration_policy()->>'test_only','false','customer registration uses production documents');

select * from finish();
rollback;
