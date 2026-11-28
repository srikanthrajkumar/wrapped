# Staging

For the Maintainer and the router session. Staging is a second Cloudflare Worker, at
`https://wrapped-staging.srikanthrajkumar26.workers.dev`, where a merged change is checked before
it reaches carnatic.live. Production is in [production.md](production.md).

## What staging is

- **Its own Worker**, `wrapped-staging` (`env.staging` in `app/wrangler.jsonc`), on workers.dev
  only, with no route and no custom domain. Production, the Worker `wrapped`, answers only on
  carnatic.live.
- **Built exactly like production.** `deploy.sh --staging` copies the same snapshot in, runs the
  same golden set and `npm run check`, and makes the upload with the same Schedule project and
  the same `~/.config/wrapped/server.env`. Only the Worker it uploads to differs.
- **On the production Supabase project.** Signing in on staging is signing in to your real
  account: a concert logged there syncs into your real season and shows on carnatic.live too.
  Delete test concerts when you're done, or sign in with a second Google account.
- **Its own phone store.** Each address keeps its own store, so a season on carnatic.live isn't
  on staging until it syncs down after sign-in, and the other way round.
- **Only the Maintainer signs in there.** Never send rasikas to the staging address.
- **Never indexed.** Every staging response sends `X-Robots-Tag: noindex, nofollow`.
  `deploy.sh --staging` adds it to the staging build's `_headers` after the checks
  (`tools/deploy/noindex.sh`), so `app/public/_headers` never has it, and a production deploy
  stops if its build sends noindex. Whatever `robots.txt` carnatic.live has ships to staging too;
  the header still keeps staging out of search results.

## The flow

1. **Merge** to `main` (on the Maintainer's approval).
2. **Deploy to staging**, unasked, from a clean worktree of `origin/main`:

   ```bash
   tools/deploy/deploy.sh <snapshot> --staging --without-golden-set
   ```

   It prints `Staging: wrapped-staging.srikanthrajkumar26.workers.dev (not carnatic.live)` first
   and last. `--dry-run` works with it too. A new catalog snapshot from the logger goes the same
   way: staging first.
3. **Check it there**: open the staging address, try what changed, and sign in if the change
   touches sign-in or sync.
4. **Production only on the Maintainer's word**: the same command without `--staging`. It goes
   live on carnatic.live.

## One-time sign-in setup for the staging address (5 min)

The app signs in with Google's own button and `signInWithIdToken` (ADR 0001): Google checks the
page's origin, and Supabase only checks the token Google gave. No one is sent to Supabase's
address and back, so Supabase needs no change. Only Google does:

1. [console.cloud.google.com](https://console.cloud.google.com) → the `carnatic-wrapped`
   project → **Google Auth Platform** → **Clients** → `wrapped web`.
2. Under **Authorized JavaScript origins**, **Add URI**:
   `https://wrapped-staging.srikanthrajkumar26.workers.dev` (no slash at the end).
3. If `https://wrapped.srikanthrajkumar26.workers.dev` is still listed, remove it: that address
   no longer serves the app (below).
4. **Save**. It can take a few minutes, sometimes longer, before Google accepts the new origin.

Nothing to change in Supabase:

- **Redirect URLs** (Authentication → URL Configuration): leave empty. They are only for
  sign-ins that leave the app and come back, which this app doesn't do.
- **Site URL**: leave it `https://carnatic.live`. It is only where Supabase's own emails and
  redirects point, and the app uses neither.

If Google's button says the origin isn't allowed (`origin_mismatch`) on staging, step 2's
origin isn't exactly the staging address, or Google hasn't caught up yet.

## The old workers.dev address

Production used to answer on `https://wrapped.srikanthrajkumar26.workers.dev` too. It now has
`workers_dev: false`, so the first production deploy after this change takes that address down
and carnatic.live is the only one. A phone that installed the old address keeps its store, but
gets no more updates there; anything logged on it that hasn't synced stays on that phone only.
