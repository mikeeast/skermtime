-- Skermtime — grant table privileges to the Supabase API roles.
-- PostgREST connects as anon / authenticated / service_role. Those roles need
-- table-level privileges to touch the tables at all; ROW LEVEL SECURITY is what
-- actually gates which rows they see (service_role bypasses RLS). Migration-
-- created tables didn't inherit these grants, so add them explicitly and set
-- default privileges for anything created later.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on routines to anon, authenticated, service_role;
