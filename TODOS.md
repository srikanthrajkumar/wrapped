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

## Completed
