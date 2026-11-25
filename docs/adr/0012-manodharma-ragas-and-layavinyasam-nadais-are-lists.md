---
status: accepted
---

# A Manodharma part's Ragas and the Layavinyasam's nadais are lists

The Item editor ([docs/design/item-editor.md](../design/item-editor.md), §4 and §5, signed off
on 2026-11-19) lets a Manodharma part go through several Ragas, and the Layavinyasam through
several nadais. Today each holds one value. This changes the shape of a stored Item, so it
needs a migration on the phone, a rule for rows already on the server, and a sync version bump
(contracts/sync-api.md, "Errors"). The instrument picker
([docs/design/instrument-picker.md](../design/instrument-picker.md)) adds thirteen Roles in the
same release, which rides on the same bump.

## The new shape

```ts
interface Improvised {           // a Manodharma part (the stored key stays `improvised`)
  kind: ImprovisedKind;
  /** Empty while it follows the Item's Raga. A null slot holds the Item's Raga, live. */
  ragas: (DetailValue | null)[];
}

interface LayaVinyasam {
  /** The nadais it moved through besides the Tala's; empty when only the Tala's was heard. */
  nadais: DetailValue[];
  note: string | null;
}
```

- **The marker stays null.** Today `raga: null` means "the Item's Raga". In a list, a null slot
  means the same, live: it reads the Item's first Raga each time it is shown. The field is
  renamed `raga` → `ragas`, and `nadai` → `nadais`, so the two shapes can never be mistaken for
  each other.
- **One rule, kept by the store actions:** a part's list is never exactly `[null]`. Cut back to
  only the Item's Raga, it is stored as `[]` (following).
- **Validation** (`store/rules.ts`): every slot is null or a valid Detail value; every nadai is a
  valid nadai value. The internal keys (`improvised`, `layaVinyasam`, `kalpana_swaram`) stay.

## The migration

One upgrade function, `upgradeItemShape`, turns an old Item into a new one and leaves a new one
alone. Nothing it changes loses a value.

| Old | New |
| --- | --- |
| part `raga: null` | `ragas: []` (following) |
| part `raga: <value>`, any state, "?" and N/A included | `ragas: [<value>]` |
| Layavinyasam `nadai` N/A (the Tala's, as stored since 2026-11-05) | `nadais: []` |
| Layavinyasam `nadai: <value>`, "?" included | `nadais: [<value>]` |

An old "?" nadai becomes a "?" in the list, which the new sheet reads as "a nadai I couldn't
name". An old N/A part Raga is kept as a list of one, though the new sheet no longer offers N/A.

**Where it runs.** The phone store goes to version 5, and its upgrade rewrites, in one
transaction:

- every row in `items`, tombstones included (an Undo restores them);
- every `items` row in the outbox that has **never been sent**;
- every `items` row in `attention` and in `serverSeqs.held`.

An outbox entry sent at least once is never changed (eng review D8): the server may already hold
it under its opId. It goes out as it is, in the old shape.

Everything that reads an Item from outside the store upgrades it on the way in, through the same
function:

- a pulled row, before it is stored or held (`store/sync.ts`);
- a journal entry copied back from storage, for `improvised` and `layaVinyasam`
  (`screens/save-feedback.ts`), so an old "Not saved" value is shown, compared and exported in
  the new shape.

**The server keeps what it was sent.** Its rows are not rewritten, and the migration queues
nothing: rows in the old shape stay on the server until the Item is next edited, and every phone
upgrades them as it pulls. Queuing every migrated Item instead would send a push from a phone
that may not be the writing device (ADR 0003), for a change no reader needs.

## The version bump

- The app goes to 0.4.0, and the server's `min_app_version` to 0.4.0
  (`supabase/migrations/0007_lists.sql`). A build before it, on another device, gets 426 before it
  can pull a row it would misread: a Layavinyasam with no `nadai`, or a Role it would refuse.
- **The order:** the 0.4.0 app ships first, then `0007_lists.sql`. Applied before the app is
  live, every phone would get 426 until it updates: nothing is lost (the outbox keeps every
  entry), but nothing syncs.
- The store's version goes to 5, so a tab still on an older build closes its store
  (contracts/sync-api.md, "Errors").

## The thirteen Roles

madhuraveena, clarinet, guitar, keyboard, piano, sitar, sarod, santoor, jalatarangam, harmonium,
viola, tabla, konnakol join `ROLES`. No field or type changes and no stored row is rewritten;
`other` stays a valid stored value. The picker spec (§8) calls this a closed-list extension that
needs no ADR of its own. It is recorded here only because it ships under the same bump: an older
build would refuse to save an Appearance with one of them ("unknown role").

## What Undo restores

> **Superseded 2026-11-25:** Undo only for whole things: Concert, Item, Artist, Shortlist (the
> Maintainer, 2026-11-25). A removed piece is saved at once with no Undo, and no `piece` receipt
> is written; one left on a phone by an earlier build is dropped quietly. This section records
> what was built before.

Each removal writes a receipt in `meta`, in the same transaction as the change, as a delete
does (store/receipts.ts), with the removed piece and its place. Undo puts **that piece** back into
the Item **as it is now**, not the whole field as it was, so nothing done in the 5 seconds
between is lost.

| Removed | Undo |
| --- | --- |
| A Raga (the Raga line) | Back at its place, or at the end if the list is now shorter |
| A Manodharma part | Back on, with its list as it was, null slots included, so they follow the Item's Raga as it is now. If the part was turned on again meanwhile and still follows, the removed list replaces it; if it has Ragas of its own, Undo leaves it and says it is on again |
| One of a part's own Ragas ("Remove" in its sheet) | Back at its place; if the part's list is as the removal left it, the whole list as it was, so an Item's-Raga slot comes back with it |
| A part's own Ragas ("Use the Item's Raga only") | Back whole while the part still follows; if it has Ragas of its own again, Undo leaves it and says it is on again |
| A nadai | Back at its place, or at the end |
| The Layavinyasam | Back with its nadais and note. If it was turned on again meanwhile and holds nothing, the removed one replaces it; otherwise Undo leaves it and says it is on again |

A receipt is phone-only and never synced. Undo runs only while the Item is live. These receipts
never show under the Event's "Recently deleted"; they live as long as the Undo bar.

## Considered options

- **A slot object** (`{ itemRaga: true }` in place of null): clearer to read, but a second way
  to say what null already says, and every reader would test for it.
- **Keep the field names** (`raga` holding an array): no rename, but an old and a new row could
  only be told apart by type, and a mixed row would pass.
- **Rewrite the server's rows** with a SQL migration: every phone's `serverSeqs` would then be
  behind, so the next push of each Item would conflict (ADR 0010 weighed the same).
- **Undo restores the whole field:** simpler, but a part turned on in the 5 seconds after
  removing another would be lost.
