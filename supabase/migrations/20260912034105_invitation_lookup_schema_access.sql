-- USAGE resolves the invoker wrapper's explicitly granted private function.
-- It neither exposes this schema through PostgREST nor grants table access.
grant usage on schema private to anon;
