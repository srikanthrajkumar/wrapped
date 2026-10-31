# Quickstart: validating the Season Logger

How to prove version 1 works end to end. Commands are the planned scripts; they are created by
the tasks. Record shapes are in [data-model.md](data-model.md) and the
[contracts](contracts/).

## Prerequisites

- Node 22 and npm.
- Docker and the Supabase CLI, for the local Supabase (`supabase start`). The server is built
  last, so scenarios 2 to 4 and 12 to 15 run once it exists. Before then, the outbox only
  queues.
- A catalog snapshot exported by the logger project, copied to `app/public/catalog/`.
- The test phones, an iPhone 16 (primary) and a Redmi Note 5 (where the speed budgets are judged), with the app installed to the home screen.

## Automated checks (every change)

```bash
npm run check
```

Runs typecheck, lint, Vitest, the Playwright offline suite and the size budget. It fails if
the first-install download passes 2 MB or the second passes 3 MB (constitution V).

## Scenarios

Each scenario names the spec items it proves. The first six are the data-loss paths with
required automated tests (constitution IV).

| # | Scenario | Steps | Expected | Proves |
|---|---|---|---|---|
| 1 | Offline capture | After first-launch sign-in, go offline: log a Concert with 5 Appearances with Colours, 8 Items, one Laya vinyasam, notes. Force-close. Reopen | Every detail intact; no spinner on any save | SC-001, FR-003 |
| 2 | Sync without duplicates | Log 3 Events offline. Go online with the app open. Replay the same push | All ops on the server within 30 s, each once; unsynced count 0 | SC-002, FR-015 |
| 3 | Delete and reorder | Offline: reorder two Items, delete one. Sync. Restore on a second empty profile | Server and restored order match the phone | SC-002, US2-3 |
| 4 | Restore | Sync a season. Clear storage. Offline: log one Item. Go online, sign in | The new Item is kept and the full season returns, Unresolved values included | SC-003, FR-017, FR-018 |
| 5 | Catalog update | Log Items against snapshot v1 (one Override, one key that v2 retires, one raga v2 links). Load v2 and accept | Override kept; retired key becomes Unresolved with its text; top-ragas Card regroups | FR-038, catalog-snapshot contract |
| 6 | Export | Offline, with unsynced ops: Export | JSON holds every live and tombstoned record and the unsynced count | FR-019 |
| 7 | Plan to log | Enter 10 Plan entries. Offline on one date, open a planned Concert | Date, time, Sabha and billed Artists filled in | SC-004 |
| 8 | Schedule protection | Edit a planned Event, then load a Schedule version that changes it | Event unchanged; "schedule changed" hint shown | FR-027 |
| 9 | Search | Run the golden set of about 100 spellings; time 4× CPU-throttled searches | ≥ 95% in the top 3; p95 under 50 ms | SC-007, SC-010 |
| 10 | Reference import | Run the 2024-25 import | Report of matched, "?", special-form and Unresolved counts out of 193; nothing appears in a rasika's log | SC-005, FR-039, FR-040 |
| 11 | Cards | From the reference data, draw the colours and composer-timeline Cards offline and share one | Counts match the sheet (white 23, red 15, blue 15); share sheet offers the image | SC-011, SC-012 |
| 12 | Privacy | Two rasikas sign up and log. One tries to read the other's records through the API | Rejected; each sees only their own season | SC-015 |
| 13 | Promotion | Two consenting rasikas create "Anirudh Athreya"; a third does not consent. Maintainer promotes | Both consenting rasikas' Appearances link to the shared Artist; the third's entry never appears in review; a new rasika is offered him | SC-016, FR-042 to FR-044 |
| 14 | Second device | Sign in on device B, then sync from device A | A is told it is not the writer and keeps its unsynced changes for export | FR-022 |
| 15 | Long offline | Set the session clock 30 days ahead with no network, then reconnect | Still signed in; sync resumes | FR-020 |
| 16 | First launch | Install online on a fresh phone. Then switch to airplane mode and log | Sign-in and both consent questions come before logging; after that, no sign-in prompt blocks logging offline | FR-050 |
| 17 | Tab then install | On an iPhone, sign in and log one Item in a Safari tab, let it sync, then Add to Home Screen and open the installed app | The tab shows the install banner; the installed app asks for sign-in once, then restores the logged Item | eng review D15 |

## On the device, before each release

- Cold start to the logging screen in airplane mode: under 1.5 s (SC-006).
- Save under 100 ms with no indicator (SC-008).
- "Ready for offline" appears only after both downloads are cached.
- Scenario 1 repeated on the installed app.
