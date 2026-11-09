# Setting up the Schedule on the catalog's project

For the Maintainer. The Schedule is public data, so it lives in the logger's existing Supabase
project, the one that holds the catalog tables (ref `zddeaewyohognvbbazdl`, Tokyo, free plan),
never in Wrapped's personal-data project (ADR 0009). These steps put its bucket and its function
there. They don't wait for T111, the personal-data project.

Why it is built this way is in ADR 0001, "The Schedule as an Edge Function", and ADR 0009; what
it serves is in `specs/001-season-logger/contracts/schedule-feed.md`, "Delivery".

Secrets are named here, never given. None of them goes in either repository.

Steps 1 and 2 are done in the catalog project's dashboard, with no CLI and no database password:
from the logger's VM the CLI's database connection is IPv6-only and won't connect. The CLI path
is kept at the end of this page as the alternative; use one path or the other, not both.

> **Never run `supabase db push`, `db reset` or `migration up` from `supabase/` (or the
> repository root) against the catalog project.** That would put Wrapped's private schema, its
> rasika tables and sync functions, into the logger's database. Only the Schedule's bucket
> migration, below, ever goes there.

## 1. Create the bucket

Open the catalog project's **SQL Editor**, start a new query, and run the exact contents of
`supabase-public/supabase/migrations/0001_schedule_bucket.sql`, shown here to copy (a test keeps
this copy the same as the file):

```sql
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
```

It adds the private `schedule` bucket and one restrictive policy on `storage.objects`. It
changes no default privileges and adds nothing in `public`, as the logger's exposure check
requires. Run it once: a second run stops at the policy, which already exists, and changes
nothing.

Check it in the dashboard:

- **Storage**: a bucket named `schedule`, with **Public** off.
- **Storage → Policies**, under `storage.objects`: the policy "schedule is read only by the
  server". Add no other policy for this bucket.

If the query fails, stop there and tell the router. Don't make the bucket public or add a policy
by hand to get past it.

## 2. Deploy the function

1. **Edge Functions → Deploy a new function → Via Editor.**
2. Name it `schedule`. The name is its address, `/functions/v1/schedule/…`.
3. Replace the editor's sample with the whole of
   `supabase-public/supabase/functions/schedule/index.ts`, as one file. It imports nothing, so
   the editor has nothing to resolve.
4. **Deploy function.**
5. In the function's settings, switch **Enforce JWT verification** off and save. The Schedule is
   public listings, so the function takes no token, as `supabase-public/supabase/config.toml`
   says for local runs. With it on, every phone gets `401`.

The function needs no secret of its own. The runtime gives it `SUPABASE_URL` and the project's
keys: it reads with the secret key named `default` (`SUPABASE_SECRET_KEYS`), or the legacy
service-role key while the project still has legacy keys (ADR 0001, "Which key the function
reads with"). Don't add any of them under **Edge Function Secrets**, and don't delete the
`default` secret key. When `index.ts` changes in the repository, paste it again the same way and
deploy.

## 3. Which secret goes where

The logger's uploader (`pipeline/schedule/upload-feed.ts` in the logger repository, logger PR
#70) reads three values from its environment on the VM. You set them there, in its gitignored
`pipeline/schedule/.env` or the VM's environment:

| Name, on the logger's VM | Value |
|---|---|
| `SCHEDULE_UPLOAD_SUPABASE_URL` | `https://zddeaewyohognvbbazdl.supabase.co`. It must be https; the uploader refuses anything else |
| `SCHEDULE_UPLOAD_BUCKET` | `schedule`, the bucket step 1 created. The uploader never creates a bucket |
| `SCHEDULE_UPLOAD_KEY` | A secret key of the catalog project, `sb_secret_…` (**Project Settings → API Keys → Secret keys**). Best one of its own, named for the uploader (say `schedule_upload`), so it can be revoked without touching `default`, which the function reads |

| Secret | Where it goes | Not here |
|---|---|---|
| The uploader's secret key | `SCHEDULE_UPLOAD_KEY` on the logger's VM, and nowhere else. The Edge runtime gives the function its keys itself | Not in either repository, not `supabase secrets set`, not `app/.env` |
| The catalog project's database password | Not needed on the dashboard path. On the CLI path, typed when `supabase link` or the pooler push asks | Not in a file |
| The personal-data project's keys (T111) | Never on the logger's VM | — |

A secret key reaches the whole catalog project, its tables included, which the VM can already
write through its `DATABASE_URL`. It never reaches a rasika's season: that is in the other
project (ADR 0009). The uploader sends it only to `SCHEDULE_UPLOAD_SUPABASE_URL`, on `apikey`
and as the same value on `Authorization: Bearer`, and keeps it out of everything it prints. If
it ever leaks, delete it under **API Keys**, create another, and update the VM; the function's
`default` key is untouched.

The phone needs no secret for the Schedule. The deployed build gets the project's address from
`public_data_url` in `tools/deploy/deploy.sh` (already `https://zddeaewyohognvbbazdl.supabase.co`),
which stops if it's missing. Don't put `VITE_PUBLIC_DATA_URL` in `app/.env`. If an older
`app/.env` still sets `VITE_SCHEDULE_URL`, delete the line; nothing reads it now.

Nothing for the Schedule goes into Cloudflare (ADR 0008).

## 4. Check it

Before the logger's first upload, a Season has no pointer:

```bash
curl -i https://zddeaewyohognvbbazdl.supabase.co/functions/v1/schedule/2026-27
```

This should answer `404` with `{"code":"no_season"}`, which also shows the function can read the
bucket. A `500` means it can't: its log (below) says why.

Then run the uploader on the VM (`bun run upload-feed.ts`, or `--dry-run` first to see both paths
and the pointer). It uploads the file with `x-upsert: false`, reads the pointer back, then writes
`2026-27/current.json` with `x-upsert: true` and `cache-control: no-cache`. After that, the same
command answers `200` with the file and an `ETag` header (`"<sha256>"`, or `W/"<sha256>"` when
the body came compressed). Ask again with that tag, exactly as it came:

```bash
curl -i -H 'If-None-Match: <the ETag>' https://zddeaewyohognvbbazdl.supabase.co/functions/v1/schedule/2026-27
```

This should answer `304` with no body.

Then check the bucket is not open to anyone directly:

```bash
curl -i https://zddeaewyohognvbbazdl.supabase.co/storage/v1/object/public/schedule/2026-27/current.json
```

This should answer `400` or `404`, never the pointer.

Then, since Supabase is retiring the legacy `anon` and `service_role` keys by the end of 2026,
check the function runs without them: under **Settings → API Keys**, turn the legacy keys off,
and ask for the Season again. A `200` (or `304`) means it reads with the new secret key. A `500`
means it doesn't: turn the legacy keys back on (that can be undone) and tell the router. Before
turning them off for good, check nothing else of the logger's still uses them.

Last, from the logger's `pipeline/karnatik/`, check its tables are still closed to Supabase's
API:

```bash
bun run tools/check-db-exposure.ts
```

If it fails, tell the router.

## The CLI path, instead of steps 1 and 2

From a machine whose CLI can reach the catalog project's database. Every command names
`--workdir supabase-public`, so nothing from `supabase/` can go there.

1. Sign the CLI in once (it keeps the access token in your home directory), then link only
   `supabase-public/`. It asks for the database password: type it, don't put it in a file. The
   link is kept in `supabase-public/supabase/.temp/` (gitignored), so `supabase/` stays unlinked.

   ```bash
   npx supabase login
   ```

   ```bash
   npx supabase link --workdir supabase-public --project-ref zddeaewyohognvbbazdl
   ```

2. See what would be pushed: it must list one migration, `0001_schedule_bucket.sql`, and nothing
   else. Then push it. The CLI also creates its own history schema, `supabase_migrations`, which
   the logger accepts.

   ```bash
   npx supabase db push --workdir supabase-public --dry-run
   ```

   ```bash
   npx supabase db push --workdir supabase-public
   ```

   If the direct connection fails, push through the Session pooler, with the connection string
   from the dashboard's **Connect → Session pooler** and the password typed at the prompt:

   ```bash
   read -rs PGPASSWORD && export PGPASSWORD
   npx supabase db push --workdir supabase-public --db-url "postgresql://postgres.zddeaewyohognvbbazdl@<the pooler host>:5432/postgres"
   ```

3. Deploy the function:

   ```bash
   npx supabase functions deploy schedule --workdir supabase-public --project-ref zddeaewyohognvbbazdl --no-verify-jwt
   ```

If the bucket was made in the SQL Editor, the CLI has no record of it, so a later `db push` would
run the migration again and stop at the policy. Before pushing a later migration that way, mark
this one applied:

```bash
npx supabase migration repair --workdir supabase-public --status applied 0001
```

Sources for the keys: Supabase's [Managing secrets](https://supabase.com/docs/guides/functions/secrets),
[API keys](https://supabase.com/docs/guides/getting-started/api-keys) and
[Migrating to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys),
read 2026-11-09.

## If it answers 502

The function refused what the logger left, and every phone keeps its stored copy until the
logger fixes it:

- `pointer_unreadable`: `current.json` isn't format 1, is for another Season, or names a file
  other than `{season}/schedule.{season}.{sha256}.json` with its own lower-case `sha256`.
- `file_missing`: the pointer was written before the file, or names one that was never
  uploaded.
- `sha256_mismatch`: the file's bytes don't hash to the pointer's `sha256`. Files are written
  once, so this means an upload went wrong.
- `season_mismatch`: the file's own `season` isn't the Season in its path: another Season's file
  was uploaded under this one's name.

The function's log is under **Edge Functions → schedule → Logs**.
