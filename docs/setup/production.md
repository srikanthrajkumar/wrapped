# Going live on carnatic.live

For the Maintainer. These steps create Wrapped's personal-data project (T111), set up Google
sign-in, and put the app on carnatic.live (T054b). Why it is built this way: ADR 0001 (Supabase),
ADR 0008 (Cloudflare), ADR 0009 (two projects), ADR 0014 (Free, with our own backups).

Secrets are named here, never given. You type them into dashboards, a password manager, or the
one file in step 4, which lives outside the repository.

The Schedule is not here: it lives on the logger's project (`docs/setup/schedule-hosting.md`).
Never link `supabase/` to that project.

The release-day order is in [Release day](#release-day). The project launches on Supabase's Free
plan, with our own nightly backups (ADR 0014); when to move to Pro is the last section.

## 1. Create the Supabase project (10 min)

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New organization**, named
   `Carnatic Wrapped`, plan **Free** (ADR 0014). Keep it apart from karnatik's organization: a
   plan covers a whole organization, so this one can move to Pro alone
   ([Scaling up to Pro](#scaling-up-to-pro)).
2. **New project**:
   - Name: `wrapped`.
   - Database password: **Generate a password**, and save it in your password manager. The CLI
     asks for it in step 5.
   - Region: **South Asia (Mumbai)**.
   - Security options: keep **Data API** on, on the `public` schema. Leave the rest as offered.
3. **Create new project**, then wait about 2 minutes for it to start.
4. Note the **project ref**: the 20 letters in the dashboard address, after `/project/`. It is not
   a secret. It goes in ADR 0001 once you're live (T111).

## 2. Create the Google sign-in client (15 min)

In [console.cloud.google.com](https://console.cloud.google.com), pick or create a project (say
`carnatic-wrapped`), then open **Google Auth Platform** (search for it in the top bar).

1. **Branding**:
   - App name: `Carnatic Wrapped`.
   - User support email: yours.
   - Leave the logo empty. A logo sends the app to Google's brand review, which takes days.
   - Authorized domains: `carnatic.live`.
   - Developer contact: yours. **Save**.
2. **Audience**: User type **External**. Then **Publish app** → **Confirm**, so the status reads
   **In production**. In Testing, only listed test users can sign in.
3. **Data access**: only `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
   These need no Google review. Add no other scope.
4. **Clients** → **Create client** → Application type **Web application**, name `wrapped web`:
   - **Authorized JavaScript origins** (scheme and host only, no slash at the end):
     - `https://carnatic.live`
     - `https://wrapped.srikanthrajkumar26.workers.dev`, for sign-in on your test phones
     - `http://localhost` and `http://localhost:5173`, for local runs
   - **Authorized redirect URIs**: leave empty. The app signs in with Google's own button and
     `signInWithIdToken` (ADR 0001), so no one is sent to Supabase's address.
   - **Create**. Copy the **Client ID** (public: it goes into step 3 and step 4) and the
     **Client secret** (a secret: step 3 only). Don't paste the secret into chat or a file.

## 3. Turn on Google in Supabase Auth (5 min)

In the Supabase dashboard, for the `wrapped` project:

1. **Authentication → Sign In / Providers → Google**: switch it on.
   - **Client IDs**: the web Client ID from step 2. Supabase checks each Google sign-in was made
     for this ID.
   - **Client Secret (for OAuth)**: the secret from step 2. The button doesn't use it, but the
     form may ask for it.
   - **Skip nonce checks**: off. The app sends a hashed nonce (T010).
   - **Save**.
2. Same page, **Email**: switch it off. Rasikas sign in only with Google; with Email on, anyone
   could make a password account through the API.
3. Keep **Allow new users to sign up** on.
4. **Authentication → URL Configuration**:
   - **Site URL**: `https://carnatic.live`
   - **Redirect URLs**: none needed. The button signs in without leaving the app.
5. **Authentication → Sessions** (if shown): leave **time-box** and **inactivity timeout** off, and
   **single session per user** off. The app needs sign-in to last a whole season (ADR 0001, T077).
6. **Project Settings → Data API**: **Exposed schemas** stays `public` (and `graphql_public`). Never
   add `private`.

Nothing in `supabase/config.toml` reaches the hosted project: it is for the local stack. Don't
run `supabase config push`, which would copy its local addresses over these settings.

## 4. Where the project's address and key go (2 min)

The app needs three public values: the project's address, its **publishable** key, and Google's
web Client ID. All end up in the deployed bundle, so none is a secret, but they still stay out of
git. They live in one file outside every checkout, so a deploy from a clean worktree finds them
too:

```bash
mkdir -p ~/.config/wrapped && touch ~/.config/wrapped/server.env && chmod 600 ~/.config/wrapped/server.env
```

Open it in your editor and type these three lines:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<the publishable key>
VITE_GOOGLE_CLIENT_ID=<the web Client ID>.apps.googleusercontent.com
```

- The publishable key is under **Project Settings → API Keys → Publishable key**
  (`sb_publishable_…`). Use it, not the legacy `anon` key: Supabase retires the legacy keys at
  the end of 2026. (The variable keeps its old name.)
- The file holds exactly these three, plus any other `VITE_` name `app/.env.example` gains later;
  the deploy stops until you add it.
- **The secret key (`sb_secret_…`), the service-role key and Google's client secret (`GOCSPX-…`)
  never go in this file, or anywhere in the app.** The deploy refuses each.

Check the file without showing its values:

```bash
tools/deploy/server-env.sh
```

It should say "Server settings look right". `deploy.sh` reads the same file and never prints it.
To use another path, set `WRAPPED_SERVER_ENV`.

Don't put these values in `app/.env`: the checks build with whatever is there, and the deploy
stops if `app/.env` names a hosted project.

## 5. Push the migrations and the seed (10 min)

From the repository root of an up-to-date `main`. You run these: they need your login and the
database password.

1. Sign the CLI in once. It keeps the token in your home directory.

   ```bash
   npx supabase login
   ```

2. Link `supabase/` to the new project. It asks for the database password: type it.

   ```bash
   npx supabase link --project-ref <ref>
   ```

3. See what would go: migrations `0001` to `0007` and `seed.sql`, nothing else.

   ```bash
   npx supabase db push --include-seed --dry-run
   ```

4. Push them.

   ```bash
   npx supabase db push --include-seed
   ```

**If it can't connect** (the database's direct address is IPv6-only, and this machine has no
public IPv6), push through the Session pooler instead. Take its connection string from the
dashboard's **Connect → Session pooler**, and type the password at the silent prompt:

```bash
read -rs PGPASSWORD && export PGPASSWORD
```

```bash
npx supabase db push --include-seed --db-url "postgresql://postgres.<ref>@<the pooler host>:5432/postgres"
```

If a migration fails, stop there and tell the router. Don't edit it to get past it.

Then, in the dashboard's **SQL Editor**, check it:

```sql
select min_app_version from private.server_config;            -- 0.4.0
select count(*) from private.shared_sabha;                     -- 14
select rolconfig from pg_roles where rolname = 'authenticator'; -- has pgrst.db_pre_request=private.check_request
```

And set where rasikas ask for deletion (shown in Settings, FR-046), typing your own contact:

```sql
update private.server_config set deletion_contact = '<where rasikas write to you>';
```

## What the server needs besides the migrations

Checked against `main` on 2026-11-24:

- **Edge Functions: none.** Push, pull and the account operations are Postgres functions in the
  migrations (ADR 0001). `supabase/functions/` doesn't exist. The one Edge Function, the
  Schedule's, is on the logger's project and already set up.
- **Grants: all in the migrations.** Every function is revoked from `anon` and granted to
  `authenticated` (0001, 0004, 0005). The version check (`db-pre-request`) is set by 0004.
  0006 and 0007 only raise the minimum app version to 0.4.0; there is no report view yet.
- **Auth settings: by hand**, step 3. `config.toml` doesn't reach the hosted project.
- **Shared lists: `seed.sql`**, step 5.
- **The Maintainer allowlist: by hand, after your first sign-in** (below).
- **Not checked on a hosted project yet:** Maintainer deletion (0005) deletes rows in `auth.*`.
  Supabase limits what migrations may do there. Test it on a throwaway account before the first
  real deletion request.

## 6. carnatic.live on the Worker

`app/wrangler.jsonc` lists `carnatic.live` as a Custom Domain beside the workers.dev address. The
first deploy attaches it: Cloudflare makes the DNS record and the certificate. There is nothing
to set in DNS first.

Checked read-only on 2026-11-24: the zone `carnatic.live` is active on the account, with no
Worker routes or custom domains yet. The token in `~/.config/cloudflare/token.sh` can read the
zone and edit its Worker routes, but can't read its DNS. Cloudflare's API asks only for Workers
Scripts write to attach a Worker domain, which deploys already use, so `deploy.sh` should attach
it. **If the deploy fails on the domain**, attach it in the dashboard and run the deploy again:

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → `wrapped` →
   **Settings** → **Domains & Routes** → **Add** → **Custom domain**.
2. Type `carnatic.live` → **Add domain**. The certificate takes a few minutes.

A custom domain can't go on a host that already has a CNAME record. If Cloudflare says so,
delete that record under **carnatic.live → DNS → Records** first.

Each address keeps its own phone store, so send rasikas only to `https://carnatic.live`. The
workers.dev address stays for your test phones.

Optional: to send `www.carnatic.live` to the bare domain, use **carnatic.live → Rules →
Templates → Redirect from WWW to root**. Don't add `www` as a second custom domain: it would be
a second store.

## Release day

Do these in order. Times are rough.

| # | Step | Time |
|---|---|---|
| 1 | Supabase project in Mumbai, on Free, in its own organization (step 1) | 10 min |
| 2 | Google client and consent screen, published (step 2) | 15 min |
| 3 | Google, Email off, URLs and Data API in Supabase (step 3) | 5 min |
| 4 | `~/.config/wrapped/server.env`, then `tools/deploy/server-env.sh` (step 4) | 2 min |
| 5 | `supabase login`, `link`, `db push --include-seed`, SQL checks, deletion contact (step 5) | 10 min |
| 6 | Merge the sign-in, consent and restore work to `main` | — |
| 7 | Dry run from a clean worktree of `main`: `tools/deploy/deploy.sh <snapshot> --without-golden-set --dry-run` | 20 min |
| 8 | Deploy: the same without `--dry-run`. It goes live on carnatic.live | 20 min |
| 9 | Check it end to end (below) | 15 min |
| 10 | Add yourself as Maintainer (below) | 1 min |
| 11 | **Before inviting anyone:** backups. In `carnatic-backups`, the secrets are set, the first backup has run, and it was restored once. How: that repository's README | 30 min |
| 12 | Record the project ref in ADR 0001; tick T111 and T054b | 5 min |

The deploy runs every check first. Keep the machine quiet while it does: the search timing test
fails under load.

### Check it end to end

From this machine, after the deploy:

```bash
curl -sI https://carnatic.live | head -1
```

`HTTP/2 200`, with no certificate error.

```bash
( set -a; . ~/.config/wrapped/server.env; curl -s "$VITE_SUPABASE_URL/auth/v1/settings" -H "apikey: $VITE_SUPABASE_ANON_KEY" | jq '.external | {google, email}' )
```

`google: true`, `email: false`.

```bash
( set -a; . ~/.config/wrapped/server.env; curl -s -o /dev/null -w '%{http_code}\n' -X POST "$VITE_SUPABASE_URL/rest/v1/rpc/me" -H "apikey: $VITE_SUPABASE_ANON_KEY" -H 'Content-Type: application/json' -d '{}' )
```

`401`: no one reaches a season without signing in.

Then on a phone (the iPhone 16 for sign-in, T113), with a Google account that isn't a test user:

1. Open `https://carnatic.live`, add it to the home screen, and open it from there.
2. Tap Google's button and sign in. Google's sheet names carnatic.live, with no "unverified
   app" warning, and you never leave the app. Accept the consent screen in the app.
3. Log a test concert with one item.
4. Check the not-yet-synced count goes to 0.
5. In the dashboard's SQL Editor, check it arrived:

   ```sql
   select id, deleted_at from private.events;
   ```

   One row, `deleted_at` empty.
6. Delete the test concert on the phone, wait for the count to reach 0 again, and run the same
   query: `deleted_at` is now set (a delete is a tombstone).
7. Turn on airplane mode, close the app, open it again, and log: it must still work.

If sign-in fails:

- **Google's button doesn't appear, or says the origin isn't allowed** (`origin_mismatch`): the
  origin in step 2 is not exactly `https://carnatic.live`, or `VITE_GOOGLE_CLIENT_ID` in step 4
  is another client's.
- **Google says the app is in testing**: step 2's **Publish app** wasn't done.
- **Supabase answers "Unacceptable audience"**: the Client ID in step 3 isn't the one in step 4.
- **"nonce" errors**: Skip nonce checks must stay off, and the app must be the latest deploy.
- **"Unsupported provider"**: Google isn't switched on in step 3.
- **The app never asks to sign in**: the build had no server. Run `tools/deploy/server-env.sh`.

### Add yourself as Maintainer

After your own first sign-in on carnatic.live, in the SQL Editor:

```sql
insert into private.maintainer (auth_user_id)
select id from auth.users where email = '<your Google email>';
```

## Scaling up to Pro

The project runs on Free (ADR 0014). This section says what Free means while it does, and when
and how to move to Pro.

### What Free means

From Supabase's [pausing](https://supabase.com/docs/guides/platform/free-project-pausing) and
[pricing](https://supabase.com/pricing) pages:

- **It pauses** after about 7 days of low activity. "A few user requests to the database each
  day over the previous week" keeps it awake, and so does opening it in the dashboard. Supabase
  emails a warning about a week before. In season, rasikas syncing keep it awake.
- **A paused project can be resumed** for up to a year, say Supabase's docs today. An older
  changelog said 90 days, so plan on 90. After that, the server copy is gone: only phones and the
  backups hold the seasons.
- **No automatic backups.** Ours replace them ([Backups](#backups)).
- **Limits:** 2 active projects (paused ones don't count; karnatik and Wrapped use both), a 500
  MB database, 50,000 monthly active users, 5 GB egress a month, and a smaller shared-CPU server.

### While it's paused

Checked against the app's code on 2026-11-25:

- **Phones already signed in keep logging.** A save never waits for the network (constitution I).
  Each change waits in the phone's outbox, and the count of changes not yet backed up grows.
- **Sync keeps trying.** A call with no answer, or a 5xx, counts as no signal: the app retries
  with backoff and keeps the session, so no one is signed out (`store/sync-api.ts`,
  `store/auth.ts`). What a paused project answers isn't documented. If it were a 4xx, a push could
  stop under "needs attention", or a session could end with "sign in again". Even then the
  season and its outbox stay on the phone. Check it once, below.
- **Sign-in fails**, so a new phone, or one wiped or emptied, can't start: the app needs one
  sign-in before logging. Restoring a season onto a phone waits too.
- **Once resumed**, each phone syncs its outbox the next time it opens or gets signal.

The first time it pauses, check what it answers, from wherever `server.env` lives:

```bash
( set -a; . ~/.config/wrapped/server.env; curl -s -o /dev/null -w '%{http_code}\n' "$VITE_SUPABASE_URL/rest/v1/" -H "apikey: $VITE_SUPABASE_ANON_KEY" )
```

`000` (no answer) or a 5xx is what the app treats as no signal. Any 4xx: tell the router before
the next pause.

### Resume a paused project

Dashboard → the `Carnatic Wrapped` organization → the paused project → **Resume project** →
confirm. Data and settings come back as they were. Then open the app on a phone and check its
count of changes not yet backed up goes to 0.

### Backups

A nightly encrypted dump of Wrapped (seasons and sign-in accounts), and a weekly one of karnatik,
run from the private repository `carnatic-backups` (ADR 0014). Its README says how they run and
how to restore. A backup holds every rasika's email and season: personal data under the DPDP Act.
So, wherever a copy is:

- it is encrypted to the Maintainer's public key before it is stored, and only the Maintainer
  can read it;
- it is kept 30 days, then deleted. A rasika's erasure reaches the backups only once the older
  ones are gone, so the privacy notice should say so; T112's legal check should cover backups;
- it is never in a public repository (wrapped is public: anyone can read its Actions logs and
  download its artifacts), on the VM, or in chat.

### When to move to Pro

Any one of these (ADR 0014):

- the database passes about 350 of its 500 MB;
- egress passes about 3 of its 5 GB in a month;
- sign-ups continue after the season;
- an off-season pause actually hurts rasikas.

In season, look at **Organization → Usage** once a week.

### How

1. Dashboard → the `Carnatic Wrapped` organization → **Billing → Change subscription plan →
   Pro**.
2. That's all. The project, its address and its keys stay the same, so the app needs no
   redeploy. A project on a paid plan is never paused, and Supabase's own daily backups start
   (kept 7 days). Keep `carnatic-backups` running too: it is the only copy you hold.

To go back to Free later: check **Organization → Usage** is under the Free limits, remove any
add-on under **Project Settings → Add-ons**, then **Billing → Change subscription plan → Free**.
Supabase's docs don't describe the downgrade itself (whether the database restarts, when it takes
effect), so read the dashboard's notice before confirming, and do it at a quiet hour.

Sources: Supabase's [Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
and [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls); Google's
[Get your Google API client ID](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid);
Cloudflare's [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
and [Attach Worker Domain](https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/update/).
Read 2026-11-24.
