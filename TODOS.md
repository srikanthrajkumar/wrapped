# TODOS

## Infrastructure

### Decide the Supabase plan after the season

**What:** After the end-of-season report, decide whether to keep Supabase Pro, export everything and move to the free tier, or pause the project.

**Why:** Pro costs from $25 a month (about $300 a year) for an app used mostly in December and January.

**Context:** ADR 0001 moves the season's database to Pro before sign-up and sets no end date. The free tier pauses after a week idle and has no automatic backups, so take a full export (database dump plus the season-report extract) before any downgrade or pause. Raised by the eng review's outside voice (2026-10-30, OV20).

**Effort:** S
**Priority:** P3
**Depends on:** the end-of-season (State of Margazhi) report

## Tidy

### Merge duplicate Events

**What:** Let Tidy merge two Events: keep one, move the other's Appearances and Items to it, and tombstone the other.

**Why:** A phone whose storage was cleared can log a planned Concert offline as a new Event; restore then brings back the original Planned Event, leaving a phantom upcoming Event and possibly double-counted Appearances.

**Context:** FR-036 merges only Artists and Sabhas (`app/src/store/merge.ts`, Phase 10). Until this exists, the rasika deletes the extra Event by hand. Raised by the eng review's outside voice (2026-10-30, OV13). Build it if real seasons show the case happening.

**Effort:** M
**Priority:** P3
**Depends on:** Tidy (Phase 10)

## The Season spine

### Take back an "I'm here" left with nothing logged

**What:** When the rasika taps the listing sheet's second button on a concert they had not Shortlisted, then leaves the Event with nothing entered, take the Event back, as the + takes back an untouched Concert.

**Why:** The approved design asks for it (season-spine.md, Part 1, R2-19). Today the Event stays Shortlisted, with a star the rasika can take off.

**Context:** ADR 0010 left it out on purpose. `discardUntouched` (`app/src/store/events.ts`) is proven only for a bare Concert, with no Sabha, Stage or Schedule entry; an Event made from a listing carries billed Appearances and may have made own Artists and Sabhas, so "as born" needs its own definition and tests before anything is deleted unasked.

**Effort:** M
**Priority:** P2
**Depends on:** the Maintainer asking for it

### Count a Heard concert by its log, not only its status

**What:** When the Wrapped's stats join the Diary, count an Event that holds a live Item as heard, as every screen already shows it (`isHeard`, `app/src/screens/timeline.ts`), or reconcile its stored status first.

**Why:** A build before ADR 0010, or a pull, can leave an Item on a `planned` or `missed` Event. The screens show it as Heard; a count that reads `attended` alone (FR-026) would leave it out.

**Context:** The app never changes a status by itself (ADR 0010), so the stored status follows only at the rasika's next Item, Undo or lapse answer.

**Effort:** S
**Priority:** P2
**Depends on:** the Wrapped's stats (Part 8 of the Season spine)

### What's on, back from an Event on the days gone, on WebKit

**What:** Find out whether What's on holds its place on a real iPhone when the rasika comes back from an Event deep in the days gone, under days whose rows wrap; fix the hold if it doesn't.

**Why:** `app/e2e/timeline.spec.ts` ("back from an Event finds What's on where it was left, on the days gone, held still") passes on Chromium with scroll anchoring off, and fails on Playwright's WebKit: the row comes back about 230px from where it was left. The live build (cef452a) fails the same way, so the Season spine did not bring it; the test had only ever run on Chromium.

**Context:** `app/src/screens/pin.ts` holds the place while the days above draw at their real heights. Playwright's WebKit on Linux is not Safari on an iPhone, so see it on the phone first. The same test from today's days passes on WebKit.

**Effort:** M
**Priority:** P2
**Depends on:** a look on an iPhone

### The type marks, and the copy

**What:** Settle the row's type marks (words today: "Flute", "Jugalbandi"; or icons), and approve the Season spine's words, all placeholders in `MESSAGES.spine`.

**Why:** Both were deferred by the Maintainer (season-spine.md, Part 4 "Open", "Open Questions").

**Effort:** S
**Priority:** P2
**Depends on:** the Maintainer

### Hub polish: what the council asked for and was left

**What:** Three things two council rounds raised on the hub's mockup (2026-11-13) that were not built: (1) leave the hero's concert out of the Today rows, where it shows a second time; (2) set the Sabha a step brighter than the accompanists on a row; (3) give every other empty state (an Event with no Items, the Shortlist and Diary tabs, a search with no match) the bare mark the hub's now has, in place of the filled tile.

**Why:** (1) was raised by three reviewers in both rounds and goes against the Maintainer's earlier call, so it is theirs to reopen. (2) came from one reviewer and the row's lines were settled on 2026-11-11. (3) keeps one look for every empty state: the hub's lost its tile because it read as a button.

**Context:** `app/src/screens/spine.ts` `startingSoon` already leaves out the concert the hero shows as being logged (`hero`); `app/src/screens/components/ConcertRow.tsx`; `EmptyMedia variant="icon"` in each screen.

**Effort:** S
**Priority:** P2
**Depends on:** the Maintainer

## Completed
