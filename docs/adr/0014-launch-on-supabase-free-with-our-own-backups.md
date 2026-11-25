---
status: accepted
---

# Launch on Supabase Free, with our own backups

Wrapped's personal-data project (T111) launches on Supabase's Free plan, not Pro, in its own
organization, in Mumbai. Pro's daily backups are replaced by our own: a nightly encrypted dump
from a private repository, `carnatic-backups`. We move to Pro when use calls for it. This
supersedes the part of ADR 0001 that moved the season's database to Pro before sign-up. Decided by
the Maintainer 2026-11-25: launch frugally, scale on traction.

## Why

- **Cost.** The launch is small, about invite-sized. Pro is from $25 a month, about $300 a year,
  for an app used mostly in December and January.
- **The server is the second copy.** Each phone holds its rasika's whole season and works without
  the server (constitution I and II). A pause or a lost day of server data never loses a
  season that is still on its phone.
- **Use keeps it awake in season.** Supabase pauses a Free project after about 7 days of low
  activity. In December, rasikas syncing every day are that activity.
- **Free meets the sign-in needs.** Refresh tokens don't expire and the inactivity timeout is off
  unless set, on any plan (`specs/001-season-logger/research.md`), so a rasika stays signed in
  through the season.

## What replaces Pro's backups

- **Nightly:** a dump of Wrapped's database, seasons and sign-in accounts both, encrypted to the
  Maintainer's public key and kept 30 days as artifacts of the private repository
  `carnatic-backups`. Only the Maintainer's private key opens it.
- **Weekly:** a dump of the catalog's project (karnatik, ADR 0009), the same way.
- **Not in this repository.** Wrapped is public: anyone can read its Actions logs and download its
  artifacts. The backup repository's README says how it runs and how to restore.
- **Tested before anyone is invited:** its secrets are set, the first backup has run, and it was
  restored once (`docs/setup/production.md`, "Release day").

## Considered options

- **Pro from launch** (ADR 0001 until now): daily backups kept 7 days, never paused, a bigger
  server. Rejected for now on cost: nothing at launch size needs it.
- **Free with no backups of our own.** Rejected: one bad migration or deletion would lose every
  season that is only on the server, such as a phone that was reset after syncing.
- **Backups by hand from the Maintainer's laptop.** Rejected: relies on remembering every week,
  and keeps every copy in one place.

## Accepted costs

- **No room for a test copy.** Free allows 2 active projects, and karnatik and Wrapped use both.
  Trials run on the local stack.
- **A smaller server**: a shared CPU and 500 MB of memory.
- **Off-season pauses.** With little use after the season, the project pauses. Phones keep
  logging; sign-in on a new phone and restore wait until it is resumed
  (`docs/setup/production.md`, "Scaling up to Pro").
- **Free limits:** a 500 MB database, 5 GB of egress a month, 50,000 monthly active users.

## When to move to Pro

Any one of:

- the database passes about 350 of its 500 MB;
- egress passes about 3 of its 5 GB in a month;
- sign-ups continue after the season;
- an off-season pause actually hurts rasikas.

Moving is one click on the Wrapped organization (**Billing → Change subscription plan → Pro**),
with no redeploy: the project, its address and its keys stay the same. That is why Wrapped has an
organization of its own: a plan covers a whole organization, so karnatik stays on Free.
