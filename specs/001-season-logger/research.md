# Research: Season Logger and Live Wrapped

Phase 0 of `/speckit-plan`, gathered 2026-10-29. Sizes marked *measured* were bundled and
compressed by us. All others cite the source. Decisions are made one at a time by the Maintainer
(constitution VI); open ones are marked **Pending**.

## Measured: the catalog fits the first-install budget

- All 30,539 songs from the logger's `extracted/` files, with title, first line, and
  dictionary-encoded raga, tala, composer and language: 2,031 KB raw, **569 KB gzip, 448 KB
  brotli** (*measured*).
- Distinct raw values before resolution: raga 2,866, tala 653, composer 770, language 17. The
  resolved catalog has 1,326 ragas and 589 composers, so the resolved snapshot will be no
  larger. Subjects, forms, Aliases and Linked ragas still need adding.
- This leaves roughly 1.5 MB of the 2 MB first-install budget for the app shell, search and
  fonts.

## Decided

### On-phone store: Dexie over IndexedDB

- **Decision**: Dexie 4.4.x (pin a recent version; 4.4.1, 4.4.4 and 4.4.7 fixed liveQuery
  edge cases).
- **Rationale**: 32 KB gzip (*measured*). It uses IndexedDB, which every installable iOS
  Safari supports. Live queries redraw screens and the Wrapped on save. Maintained, with monthly
  releases through 2026.
- **Alternatives considered**:
  - SQLite WASM (`opfs-sahpool`): about 430 KB (*measured*), Safari 16.4+. It costs a quarter
    of the remaining budget for no gain at about 250 rows per season.
  - PGlite: about 4 MB, and its OPFS storage fails on Safari (252 file-handle cap).
  - DuckDB-WASM: below.

### DuckDB: only for the end-of-season report

- **Decision**: not used on the phone or as the server store. It MAY be used offline by the
  Maintainer for the State of Margazhi report, attaching the production Postgres `READ_ONLY`.
- **Rationale**:
  - The wasm is 5.6 to 6.3 MB brotli (*measured*), about 3× the whole first-install budget.
  - OPFS persistence was documented in Sept 2026 for "modern browsers" only, with no iOS
    evidence. The npm `latest` build never writes OPFS files.
  - On a server, only one process may open a DuckDB file read-write
    (duckdb.org/docs/2.0/connect/concurrency), which does not suit many rasikas syncing.
  - Per-rasika data is about 250 Items, so plain JavaScript aggregates it in well under a
    millisecond.
- **Alternatives considered**: MotherDuck (no Indian or Singapore region; $250/month for
  Business).

### Catalog search: uFuzzy

- **Decision**: uFuzzy 1.0.x over a shared transliteration fold of index and query.
- **Rationale**:
  - 4.2 KB gzip (*measured*).
  - Published benchmark on 162k phrases: 0.5 ms init, 7 MB heap, versus MiniSearch's 504 ms
    and 67 MB (github.com/leeoniya/uFuzzy).
  - Our 30k-string run ranked it first on p95. That run was on an overloaded machine, so only
    the ranking is reliable.
  - Single-character queries are the worst case: gate them or cap ranking.
- **Alternatives considered**:
  - MiniSearch and Orama: index build costs 1.5 to 2.2 s at start, unless a pre-serialised
    index is shipped.
  - Fuse.js: about 600 ms p95, which fails the 50 ms target.

### Spreadsheet export: write-excel-file

- **Decision**: write-excel-file 4.x (`/browser` entry), in the second download.
- **Rationale**: 19.5 KB gzip (*measured*), MIT licence, released June 2026.
- **Alternatives considered**:
  - SheetJS CE: 107 KB, and only installable from its own CDN tarball (npm is frozen at
    0.18.5).
  - exceljs: 264 KB, last released Oct 2023.

### UI framework: React 19

- **Decision**: React 19 with react-dom (Maintainer, 2026-10-29).
- **Rationale**: 67 KB gzip (*measured*), about 4% of the first-install budget. The approved
  `vercel-react-best-practices` and `shadcn` skills cover it, and Dexie ships a React hook for
  live queries.
- **Alternatives considered**: Preact 11 (5.4 KB) needs a compatibility layer that some
  shadcn/Radix components break under. Solid (5.2 KB) has no approved skill and only community
  shadcn ports.

### Router: wouter

- **Decision**: wouter 3.13 (Maintainer, 2026-10-29).
- **Rationale**: 3 KB gzip (*measured*), released Sept 2026. About 10 screens need paths, links
  and the back button. Screens read from the phone store, so route-level data loading goes
  unused.
- **Alternatives considered**: TanStack Router 1.170 (30 KB) adds typed links, but most of its
  size pays for loaders and caching the store already does. React Router 8.5 (35 KB): the
  approved skill covers only framework mode, which needs its own build setup.

### Offline shell: vite-plugin-pwa with Workbox

- **Decision**: vite-plugin-pwa 2.0 (Oct 2026, Vite 3 to 8) with Workbox 7.4.
- **Rationale**: the standard precache and update flow. The two-phase precache and the
  "ready for offline" signal are built on it.

### Hosting and sign-in: Supabase Auth and Supabase Postgres

- **Decision**: Google sign-in through Supabase Auth; the server store is Supabase Postgres
  (Maintainer, 2026-10-29). Recorded in `docs/adr/0001-supabase-for-sign-in-and-server-store.md`.
- **Timing**: the server is built locally after Plan and Lecdem and deployed last (eng review
  D12). Development runs on a local Supabase (CLI on Docker)
  at no cost; the season's database moves to Pro in Mumbai before rasikas sign up.
- **Still open**: push and pull as Postgres functions or as Edge Functions, decided when the
  server is built.

What the research found:

| Fact | Source |
|---|---|
| Supabase free projects pause after 1 week idle; restorable up to 1 year, after which only the last backup can be downloaded. The likely cause of the logger's lost catalog project, though "tenant or user not found" is officially a connection-string error, so check the dashboard. | supabase.com/docs/guides/platform/free-project-pausing |
| Supabase Pro: $25/month with $10 compute credit; never pauses; Mumbai (ap-south-1) available. | supabase.com/pricing |
| Supabase Auth: refresh tokens never expire but are single-use (10 s reuse grace). See "Hosted sign-in platforms" below. (An earlier note here cited auth-js issue 454 as a network-error sign-out; that issue was a multi-tab refresh race, fixed in Oct 2022.) | supabase.com/docs/guides/auth/sessions |
| Better Auth 1.7.x: maintained; built-in Google sign-in; configurable sliding sessions (e.g. 45 days); per-session revocation; Postgres; Hono integration. Auth.js has been maintained by the Better Auth team since Sept 2025. | better-auth.com/docs/concepts/session-management |
| Neon: free tier suspends after 5 min idle (cannot be disabled); nearest region Singapore; owned by Databricks since 2025. | neon.com/docs/introduction/plans |
| Cloudflare Workers: free tier 100k requests/day, 10 ms CPU; paid $5/month; Hyperdrive pools Postgres connections. Workers Static Assets serves the PWA free. | developers.cloudflare.com/workers/platform/limits |
| Fly.io: no Mumbai region on the current list; Singapore only nearby; $2.19/month for the smallest VM. Render free spins down and expires Postgres after 30 days. | docs.fly.io/reference/regions; render.com/docs/free |
| Indian VPS: Lightsail Mumbai from about $3.50/month; DigitalOcean Bangalore about $4 to 6 (unverified). | third-party |

Options that were put to the Maintainer:
1. **Own API and Supabase Postgres.** Cloudflare Workers running Hono with Better Auth, and
   Supabase Pro Postgres in Mumbai. About $30/month.
2. **Supabase for everything.** Supabase Auth, Postgres and Edge Functions. $25/month.
3. **One Indian VPS.** Postgres, API and Better Auth on one box. About $4 to 6/month, with ops
   on the Maintainer.
4. **Own API and Neon Postgres.** Neon free tier in Singapore.

#### Hosted sign-in platforms (checked 2026-10-29)

The Maintainer wants sign-in handled entirely by a platform. That rules out Better Auth, which
is a library that keeps users and sessions in our own database. Three platforms were checked
against the spec's four sign-in needs (FR-020, FR-021).

| Need | Supabase Auth | Firebase Auth | Clerk |
|---|---|---|---|
| Google sign-in | Yes | Yes | Yes |
| Signed in after 30+ days unused | Yes. Refresh tokens never expire; the inactivity timeout is optional (Pro) | Yes. Refresh tokens expire only when the user is deleted, disabled or has a major account change | **Not on the free plan**: sessions are fixed at 7 days. Pro ($25/month) allows a custom length |
| A network error never signs out | Yes in auth-js 2.118 (*source read*): a failed fetch keeps the session; only a rejected refresh token with an expired access token removes it. **Known risk**: if a refresh reaches the server but the reply is lost, reusing the old token after 10 s ends the session (Supabase's own docs) | Network errors are skipped when deciding to clear. A 2023 report (issue 7164) of an offline launch clearing the user on an internal error was closed by a bot without a confirmed fix | Session tokens last 60 s and need the network to renew; offline behaviour not verified |
| Revoke a lost phone | Sign out with scope `others` from another device, or `global`. No per-device revoke from a list | Per user only: revoking signs out every device | Per session: list active devices and revoke one |
| Cost at hundreds to thousands of users | Free tier 50k MAU; Pro includes 100k | Free up to 50k MAU | Free up to 50k; Pro $25/month needed for the session length |
| Where sign-in data lives | The project's own Postgres (Mumbai on Pro) | Not found in Firebase's location docs | Not checked |

Sources: supabase.com/docs/guides/auth/sessions; supabase.com/docs/guides/auth/signout;
supabase.com/pricing; `@supabase/auth-js` 2.118.0 `GoTrueClient.ts`;
firebase.google.com/docs/auth/admin/manage-sessions; firebase.google.com/pricing;
github.com/firebase/firebase-js-sdk/issues/7164; clerk.com/docs/guides/secure/session-options;
clerk.com/pricing; clerk.com/docs/reference/backend/sessions/revoke-session.

What makes the network-error risks tolerable: logging never depends on the platform's session
(constitution I). The app keeps its own record of who is signed in and asks the platform for a
token only when syncing. If a platform ends a session, the outbox and the season stay on the
phone, and the rasika sees a non-blocking "sign in again" prompt once online. The worst case is
an extra sign-in, not lost data. That prompt still needs testing on the primary device: Google
sign-in from an installed iOS PWA has not been tried.

Supabase also accepts Firebase Auth and Clerk as third-party sign-in for its database
(supabase.com/docs/guides/auth/third-party/overview), so choosing the database does not force
the sign-in platform.

**Why Supabase Auth was chosen**: it meets all four needs, adds no cost or second vendor, and
keeps sign-in data in the same Mumbai database. Its one weak point is revocation (all other
devices, not one), which suits one writing device per rasika. Clerk has the best revocation but
needs Pro for 30-day sessions and adds a second vendor. Firebase revokes per user only and its
data location is not documented.

This does not block the phone side, because sync is behind one module (constitution
Boundaries). The design doc's fallback still holds: logging on the phone with export, uploading
once the server exists.

## Pending

### Share-card rendering (needed by 20 December; second download)

- **Satori and resvg-wasm**: about 1.5 MB gzip in total, plus fonts. resvg-wasm has had no
  release since March 2024.
- **Takumi 2.18**: one 1.67 MB wasm; renders PNG directly; 65 ms warm render in Node.
- **Shaping**: both shaped Tamil (கை, கொ, ஸ்ரீ, க்ஷ) and Devanagari conjuncts (क्ष, ज्ञ, reph)
  correctly with Noto fonts (*tested*).
- **Canvas 2D**: 0 KB and uses the OS's own shaping, but the layout is written by hand.
- Either renderer fits the 3 MB second budget with write-excel-file (20 KB) and fonts (0.2 to
  0.6 MB).

## Platform facts (iOS Safari, 2026)

- `navigator.storage.persist()`:
  - Supported since Safari 17.
  - It is granted by heuristics; being installed to the home screen counts in its favour.
  - Persisted origins are exempt from eviction (webkit.org/blog/14403).
  - Bug reports of wipes still exist, so export and server restore stay mandatory.
- Background Sync: not supported on any iOS version (caniuse). Sync runs only while the app is
  open, as the spec already assumes.
- Web Share with files: supported since iOS 14, so Cards can go to the share sheet.

## Compliance note (DPDP)

- The DPDP Rules were notified on 13 November 2025.
- The notice, consent-withdrawal, erasure and rights duties (Rules 3 and 5 to 16) apply from 13
  May 2027.
- The spec's two explicit consents, de-identified reports and erasure on request already meet
  them early.
- Two points to check before launch:
  - Withdrawal must be as easy as giving consent; the settings toggle covers this.
  - The Rules require keeping logs for at least 1 year.
