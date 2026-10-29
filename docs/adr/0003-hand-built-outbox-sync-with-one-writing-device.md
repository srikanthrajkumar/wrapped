---
status: accepted
---

# Hand-built outbox sync with one writing device

Every save writes the record and an outbox entry in one Dexie transaction, then returns
without touching the network. When the app is open with signal, the outbox is pushed in order,
and server changes are pulled by cursor (`specs/001-season-logger/contracts/sync-api.md`).
Each rasika has one writing device at a time, so whole-record last-write-wins can never lose a
concurrent edit, and no merge logic is needed. We build this ourselves, at about 100 lines on
the phone, because no maintained sync engine fits a December-only app with an iOS PWA.
Decided 2026-10-29 with the design doc's approach; the one-writer rule is in the constitution
(Boundaries).

## Considered options

- **PowerSync**: self-hosting is under the FSL licence, and the cloud free tier deactivates idle
  projects, which suits an app idle ten months a year badly.
- **Zero** rejects writes while disconnected. **Electric Cloud** is winding down after its
  acquisition. **Triplit** is dormant and **Replicache** is archived (`docs/skills-router.md`
  §4).
- **CRDTs or field-level merge**: only needed for concurrent writers. One writing device
  removes the need.
- **Background Sync**: not supported on iOS, so sync runs only while the app is open.

## Consequences

- **Idempotency**: the outbox entry's id is the idempotency key. The server records each one,
  so a retried push never duplicates.
- **Ids and deletes**: records get UUIDv7 ids on the phone. Deletes are tombstones that sync
  like any write. Item order is an explicit integer `position`, renumbered in one transaction.
- **Restore** pushes the outbox before pulling, so a restore never discards a local write.
- **Two cursors in pull**: the rasika's own rows by a server sequence, written under a
  per-rasika lock, and the shared lists by list version, written under one lock. Neither can
  skip a row that another transaction commits late. The device clock is never a cursor.
- **Server-written facts are separate rows.** When the Maintainer promotes an entry, the server
  writes a Link and never edits the rasika's own row (ADR 0005). That keeps last-write-wins
  safe.
- **Former writers**: a device that is no longer the writer gets "not the writer", stops
  pushing, and keeps its unsynced changes for export. This season has no import, so those
  changes reach the server only by hand.
- **Unsent changes**: the outbox length is the unsynced count the rasika sees. Changes made
  since the last sync are lost if the phone's storage is cleared before signal returns. The
  spec accepts that limit.
