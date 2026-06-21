-- Skermtime — fas 11a: agent companion groundwork. Track the installed agent version
-- so the dashboard can show it and (later) flag out-of-date installs.
alter table public.devices add column agent_version text;
