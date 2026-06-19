-- AI chore verification photos. Private bucket: clients (anon/authenticated) get
-- no access via storage RLS; only the service-role server reads/writes (it derives
-- family/child from the verified child cookie). Reads happen via short-TTL signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chore-photos', 'chore-photos', false, 10485760, array['image/jpeg'])
on conflict (id) do nothing;
