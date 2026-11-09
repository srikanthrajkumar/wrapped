-- The Schedule's bucket (T124; contracts/schedule-feed.md, "Delivery"; ADR 0001, "The Schedule
-- as an Edge Function"). It lives in the logger's existing Supabase project, the public-data one
-- that holds the catalog tables, never in the personal-data project (ADR 0009). This is the only
-- migration of `supabase-public/`: it holds nothing but the bucket and its policy, so pushing it
-- to the catalog project adds nothing else there.
--
-- The logger's uploader never creates a bucket: `schedule` is the name the Maintainer sets as its
-- SCHEDULE_UPLOAD_BUCKET. It uploads each Season's files and its pointer here with a secret key of
-- that project, which is the Maintainer's setup and never in this repository:
--
--   {season}/schedule.{season}.{sha256}.json   written once, never changed
--   {season}/current.json                      the pointer, naming the current file
--
-- The bucket is private. No one reads it through Storage's API but the `schedule` Edge
-- Function, with the service key the runtime gives it, which bypasses row-level security. So
-- `anon` and `authenticated` get no policy on its objects, and the restrictive policy below
-- keeps it that way even if a later migration adds a broad one for another bucket.

insert into storage.buckets (id, name, public)
values ('schedule', 'schedule', false)
on conflict (id) do update set public = false;

-- Restrictive policies are ANDed with every permissive one, so no grant to `anon` or
-- `authenticated` on storage.objects can ever reach this bucket's files.
create policy "schedule is read only by the server"
  on storage.objects
  as restrictive
  for all
  to anon, authenticated
  using (bucket_id <> 'schedule')
  with check (bucket_id <> 'schedule');
