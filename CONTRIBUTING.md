# How this repository works

> **Draft.** Written 2026-10-31 before the repository goes public. Each item under "Still to
> decide" is settled one at a time before the first push.

Carnatic Wrapped is open source: the code, the spec, and the decisions behind it are public.
The catalog data is not. This page says what goes where, and the rules every change follows.

## What is public and what is not

| Public, in this repository | Private, never committed here |
|---|---|
| The app, server and tool code | The catalog snapshot (kritis, ragas, composers), which comes from the private logger project |
| Specs, plans, reviews, decision records, glossary | Any rasika's log, exports, emails or sign-in details |
| Small handmade test data (about 20 songs) | Keys and secrets other than the Supabase public key |
| Shared lists of Sabhas and Artists, composer dates, topics | |
| Last season's sheet, the Maintainer's own log, shared on purpose, and the test data built from it | |

- **The catalog stays out of git.** The build reads the snapshot from a path outside the
  repository and copies it into `app/public/catalog/`, which is ignored.
  - "Private" means the data is not published here as a dataset, and the code's licence does
    not cover it.
  - It does not mean hidden. The installed app downloads the whole snapshot, because search
    has to work offline (constitution I), so anyone who installs the app can read it.
- **Credit.** The catalog is built from karnatik.com. The app and the README say so.
- **Rasikas' logs** live only on their phones and in the Supabase database. Row-level security
  keeps each rasika to their own rows. Nothing from that database comes into this repository.

## Licence

The code and documents are under the [MIT licence](LICENSE). The catalog data is not covered by
it: it is built from karnatik.com and is not published here.

## Commits

- **One logical change per commit.** Code and the test that guards it go in the same commit.
  The required tests (on the paths that could lose data) are never split off or skipped.
- **The message** is `type: what changed`, with a body that says why.
  - Types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`.
  - Name the task when there is one, as in `feat: offline save path (T016)`.
- **Every commit passes `npm run check`** (types, lint, tests, size budget) once the app
  exists.
- **No AI attribution.** Commit messages and pull requests carry no `Co-Authored-By` or
  "Generated with" lines. For Claude Code, turn these off in your own `.claude/settings.json`
  (`"attribution": { "commit": "", "pr": "" }`); `.claude/` is not in git.
- **Commit email.** Commits use the GitHub noreply address, never a personal email.

## Branches

- `main` always works and always passes the checks.
- From T001 on, each task group is built on its own branch, as in `phase-2-store`.
  - It goes in through a pull request, which gets a `/review` pass before merging.
  - Documentation-only changes may go straight to `main`.
- GitHub Actions runs `npm run check` on every pull request and every push to `main`
  (`.github/workflows/check.yml`).
  - It uses the handmade test snapshots. Its size budget measures the app without the catalog.
  - It also fails if any commit in the pull request adds a catalog snapshot or a `.env` file,
    even one a later commit deletes, because history keeps it.
  - The full-catalog checks (search accuracy against the golden set, the size budget with the
    snapshot in) need the private snapshot, so they run locally and before each deploy.

## Deploying

The app is served by Cloudflare Workers Static Assets, at a test address for now (ADR 0008).
Deploys run from the Maintainer's machine, because it holds the snapshot.

- **Sign in once**, in your own terminal: `npx wrangler login` from `app/`. On a remote
  machine, create an API token instead and keep it in your own shell (`CLOUDFLARE_API_TOKEN`),
  never in the repository.
- **Deploy** from the repository root, naming the snapshot:
  `tools/deploy/deploy.sh /opt/carnatic/logger/pipeline/karnatik/catalog-snapshots/catalog.<hash>.json`
  - It prints the snapshot's version, copies it into `app/public/catalog/`, builds, runs the
    golden set and `npm run check` with it, and deploys only if all of them pass.
  - `--dry-run` does everything but the upload.
  - The search timing test (`app/e2e/search-perf.spec.ts`, SC-007: p95 under 50 ms at 4×
    CPU slowdown) runs last and alone, in its own Playwright project (`search-perf`), once
    every other end-to-end test has finished. Its throttle multiplies any load, so run deploys
    on a quiet machine too: other builds or test runs on it can still fail the budget.
  - Until the golden set is reviewed (T027) it fails, so the deploy needs
    `--without-golden-set`, which it repeats at the end.
- **Cache rules** are in `app/public/_headers`; the Worker's config is `app/wrangler.jsonc`.
- **A release that changes a record's shape** (a new field, Event kind or Role) does two more
  things, in the same change (contracts/sync-api.md, "Errors"):
  - bumps the phone store's schema version (`app/src/store/db.ts`), so a tab still running the
    older build closes its store and asks for a reload instead of writing;
  - raises the app's version (`app/package.json`) and the server's `min_app_version` together, so
    an older build on another device gets 426 instead of pulling rows it would mishandle.

## Secrets

- `.env` files are never committed. `.env.example` lists the names, with no values.
- The Supabase public (anon) key may be committed; it is safe in the browser by design.
- These are never committed, anywhere:
  - the Supabase service-role key;
  - database passwords;
  - the Google client secret;
  - the Maintainer allowlist.
- If a secret is ever committed, rotate it first and clean the history second.

## Contributions

Not open yet. Issues and ideas are welcome. Pull requests wait until after the 2026-27 season,
because the design is still moving fast.

## Decided

1. **Where the snapshot comes from at build time**: a local path to the logger's export,
   given to the deploy script (ADR 0008, 2026-11-03).
