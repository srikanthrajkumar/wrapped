---
status: accepted
---

# Supabase for sign-in and the server store

Rasikas sign in with Google through Supabase Auth, and the server copy of every season lives in
Supabase Postgres. The Maintainer wants sign-in run by a platform, not by code we host. Supabase
Auth meets the spec's four sign-in needs: Google sign-in, still signed in after 30+ days unused,
no sign-out on a network error (auth-js 2.118), and revoking a lost phone by signing out the
other devices. It adds no cost or second vendor, and its sign-in data sits in the same database
as the seasons. Decided 2026-10-29; evidence in `specs/001-season-logger/research.md`.

## Considered options

- **Own API with Better Auth**, recommended first for its control over session length and
  per-device revocation. Rejected because it keeps users and sessions in our own database, so
  we would run sign-in ourselves.
- **Clerk**: the best revocation (one device at a time), but its free plan fixes sessions at 7
  days. 30-day sessions need its $25/month plan, and it adds a second vendor.
- **Firebase Auth**: revokes per user only, and its data location is not documented.
- **Neon or a VPS for the database**: Neon's free tier suspends after 5 minutes and is in
  Singapore; a VPS puts backups and patching on the Maintainer in mid-season.

## Consequences

- **The server is deployed last.** The phone app, its outbox and export come first and run
  alone, as in the design doc's fallback. The server is then built and tested locally, after
  Plan and Lecdem and before Cards and Tidy, so sign-up is ready by 1 December (eng review
  D12). Deploying it is the final step.
- **Free until deploy.** Development uses a local Supabase (the Supabase CLI on Docker), which
  costs nothing and never pauses. A hosted free project is fine for a throwaway check, but free
  projects pause after a week idle and have no automatic backups. So the season's database moves
  to Pro (from $25/month, Mumbai, daily backups kept 7 days, never paused) before rasikas sign
  up.
- **The app never depends on the Supabase session to log.** It keeps its own record of who is
  signed in and asks Supabase for a token only when syncing. Supabase's docs warn that a
  refresh reply lost on bad signal can end the session after its 10-second reuse window. The
  only effect is a non-blocking "sign in again" prompt: the outbox and season stay on the
  phone.
- **Revocation is "sign out all other devices"** (Supabase's `others` scope), not per device.
  That fits one writing device per rasika. The single writing device is still enforced by our
  own writer claim, not by Supabase's "single session per user" setting, so a former writer
  gets "not the writer" and keeps its unsynced changes for export.
- **Still open, decided when the server is built:** whether push and pull run as Postgres
  functions called through Supabase's API or as Supabase Edge Functions. Either way they follow
  `contracts/sync-api.md`.
- **Tested 2026-10-31 (T010):** Google sign-in works from the app installed to the home screen
  on the iPhone 16 (iOS 18.7), both with Google's button and `signInWithIdToken` and with
  Supabase's redirect sign-in. Sign-in uses Google's button; the email one-time code fallback
  (eng review D3) is not needed. Details in `specs/001-season-logger/research.md`.
