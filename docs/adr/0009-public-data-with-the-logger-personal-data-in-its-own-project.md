---
status: accepted
---

# Public data with the logger, personal data in its own project

Wrapped's server data is split by kind across two Supabase projects. Public data (the catalog
and the Schedule) lives in the logger's existing Supabase project, the one that already holds
the catalog tables (Tokyo, Postgres 17, ref `zddeaewyohognvbbazdl`). Personal data (sign-in and
the seasons sync keeps) gets its own Wrapped project in Mumbai (T111, ADR 0001). Decided by the
Maintainer 2026-11-09.

The logger's VM holds a secret key of that project to upload the Schedule. Keeping personal
data in another project means a key on the VM can never reach a rasika's season, and the public
listings need no project of their own.

## Considered options

- **Everything in the Wrapped project** (the T124 build before this decision): the Schedule's
  bucket and function beside the seasons. Rejected: the logger's upload key, a secret key,
  would then reach every rasika's rows.
- **A third project for the Schedule alone.** Rejected: one more project to pay for and keep, for
  data that sits naturally beside the catalog the logger already publishes.

## Consequences

- **Two Supabase directories.** `supabase/` is the personal-data project, as before: its
  migrations, its sync functions, no Storage, no Edge runtime. `supabase-public/` holds the
  Schedule's server pieces for the public-data project: its own `supabase/config.toml`, one
  migration with only the `schedule` bucket and its restrictive policy, and the `schedule` Edge
  Function (ADR 0001, "The Schedule as an Edge Function"). So `supabase db push` from either
  directory carries only its own schema. Running `db push` from `supabase/` against the
  catalog project would put Wrapped's private schema into the logger's database; the setup
  steps (`docs/setup/schedule-hosting.md`) say never to.
- **The catalog project's tables stay the logger's.** It manages them with its own DDL files
  over the Session pooler, not CLI migrations, and keeps every table closed to Supabase's API
  (its `tools/check-db-exposure.ts`). The logger agreed to the Schedule there on 2026-11-09, on
  two conditions: no `ALTER DEFAULT PRIVILEGES` of any kind, and no grant, table, function or
  policy in `public`. `supabase-public/` adds only the bucket and a policy on `storage.objects`,
  and `supabase-public/tests/migrations.test.ts` fails if a migration there ever does more.
- **Set up from the dashboard.** The Maintainer runs the bucket migration in the SQL Editor and
  pastes the function into the dashboard's editor, with no CLI or database password, since the
  CLI's database connection from the logger's VM is IPv6-only. The CLI path stays as the
  alternative (`docs/setup/schedule-hosting.md`).
- **Two local stacks.** The public-data one runs beside the personal-data one on ports of its
  own (`npx supabase start --workdir supabase-public`, API on 54421). `npm run test:server`
  runs both stacks' tests.
- **The phone has two addresses.** Sync uses `VITE_SUPABASE_URL`, the personal-data project.
  The Schedule uses `VITE_PUBLIC_DATA_URL`, the public-data project. That address isn't a
  secret, since the deployed bundle shows it, so it is a setting in `tools/deploy/deploy.sh`,
  which stops if it's missing and checks the uploaded build holds it. No `.env` carries it.
  Unit tests, the e2e and the hill-climb rig build with it empty and never reach the real
  project; a build without it fetches no Schedule.
- **The catalog project is on the free plan** (Maintainer, 2026-11-09); personal data goes on
  Pro. Supabase pauses a free project after a week with no activity. While it is paused the
  function doesn't answer, and every phone keeps its stored Schedule until the project is
  resumed.
- **The region is Tokyo, not Mumbai.** The Schedule is one small file, fetched in the background
  and only when it has changed (`304` otherwise), so the distance never touches logging.
