---
status: accepted
---

# Cloudflare for the app's files, deployed from the Maintainer's machine

The PWA's files and its catalog snapshot are served by Cloudflare Workers Static Assets, and
each deploy runs from the Maintainer's machine. Cloudflare serves static files free with no
request limit, from points of presence in Chennai and Mumbai, and lets each file carry its own
cache rules. The catalog snapshot is private to the repository (it is never committed and CI
does not have it), so the machine that holds it builds, checks and deploys. Sign-in and the
database stay on Supabase (ADR 0001). Decided by the Maintainer 2026-11-03 (T054).

## Considered options

- **GitHub Pages**: no new account, but no cache rules, and it builds inside GitHub, which has
  no snapshot. Publishing a built branch would put the snapshot in the public repository's
  history, which the repository forbids.
- **Vercel**: one-command deploys and a Mumbai edge, but the free Hobby plan is for
  non-commercial use only.
- **Deploying from GitHub Actions on each merge**: needs the snapshot in CI (as a secret, or
  fetched from the logger) and a Cloudflare token stored in GitHub. Possible later; not needed
  for one Maintainer.

## Consequences

- **A test address first, the real one before sign-up.** The app starts on a free
  `workers.dev` address, used only on the Maintainer's test phones for the airplane-mode check
  and the timings (T033). A phone keeps each rasika's season under the site's address, so
  moving the address after rasikas install would strand their data. The real domain is chosen
  once the name is settled (T088a) and set up before sign-up opens on 1 December, and before
  any rasika installs. Google sign-in's allowed origins follow the same address.
- **One deploy script, and it stops on a failed check.** It builds with the real snapshot, runs
  the full-catalog checks (the size budget with the snapshot in, and search accuracy against
  the golden set once T027 exists), and deploys only if they pass. The Maintainer signs in to
  Cloudflare once, in their own terminal; no Cloudflare token is stored in the repository or in
  CI.
- **Cache rules per file.** The service worker and `index.html` are always revalidated, so a
  new deploy is found on the next launch; content-hashed files, the snapshot included, are kept
  for a year.
- **The snapshot is public once deployed.** Every phone downloads it to search offline (ADR
  0004), so anyone can fetch it from the site. Keeping it out of the repository is about the
  repository's history, not about hiding the published file.
