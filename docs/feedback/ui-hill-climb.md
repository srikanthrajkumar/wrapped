<!-- The Maintainer's method for UI polish, shared 2026-11-04 during the iPhone walkthrough
     (FB-30). Kept as given. Its first run, adapted to this app, is PR #12; the rig is in
     app/e2e/hill-climb/. -->

# UI hill-climb: <feature> on <app>

Improve how <feature> looks, without changing what it does, by iterating against a council of
independent reviewers until they agree it is excellent. You build; the council judges; the
human makes the final call.

## 0. Ground rules
- Scope: only these files/areas may change: <paths>. Anything else a reviewer asks for goes on
  the "out of scope" list, not into code.
- House rules outrank every reviewer: <design rules, e.g. "the fork's shadcn primitives only,
  one type scale per screen, no monospace, minimal copy, brand colour X, centred column,
  44px touch targets on phones">. Paste them into every reviewer brief.
- Work on your own branch off <base>. One commit per round, with its scores in the message.
- Don't touch shared servers, other checkouts, or production data. Run your own dev server.
- Never print secrets.

## 1. Fixed test state
- A throwaway account at the lowest role that can see the feature. Its credentials live in a
  0600 file outside the repo, and the rig reads them without echoing.
- Check the account works end to end before anything else: it can sign in and it can write.
  Auth and app data may live in different databases.
- Seed one fixed dataset through the real API, never with hand SQL, covering: a full state, an
  empty state, a long or wrapping case, and every variant (each colour, size or status). Record
  every created id and a cleanup command in SEED.md.
- Fake API responses only as a fallback when the API is down. Never score a round on them.

## 2. Screenshot rig
- One script signs in once, reuses the saved session, and captures the same named views every
  round at desktop (1440×900) and phone (390×844). List the views: <views, including open
  menus, editors, selected or pressed states, empty and error states>.
- Make shots deterministic: wait for fonts and async content, hide the caret, turn off animation,
  use the same scroll position and the same data.
- Round 00 is the baseline: shots and scores only, no code changes.

## 3. The council
- 3–4 reviewers from at least two vendors, e.g. 2–3 Claude subagents plus Codex
  (`codex exec -s read-only -i <images>`). Optionally add a "jester" from a third vendor, whose
  score is logged but never counted.
- Each reviewer starts with a fresh context every round, with no memory of earlier rounds and no
  sight of the other reviewers' answers.
- Everyone gets the same brief: this round's shots, from round 01 the baseline beside them,
  the house rules, and what the feature is for and who uses it. Never tell them a target score
  or what changed.
- Each reviewer returns:
  - a score out of 10 per view, plus an overall score;
  - a ranked list of fixes, each with:
    `{id, view, problem, evidence (what in the image shows it), change, severity 1-3, confidence 1-3}`.

## 4. Deciding what to build
Put every fix into one ledger, and merge duplicates (same problem, same place).

**Build** a fix if any of these holds:
  a) two or more reviewers raised it independently, preferably from different vendors;
  b) one reviewer raised it AND you can measure it. Confirm it in the DOM before building
     (getBoundingClientRect, getComputedStyle, box counts, contrast ratio). Put the number in
     the ledger;
  c) it breaks a written house rule.

**Don't build:**
  - one reviewer's taste that you can't measure. Log it and keep it for later rounds;
  - anything that contradicts a house rule, however many reviewers ask for it;
  - anything outside scope.

**Conflicts**, such as one reviewer saying bigger and another smaller:
  1. a house rule decides;
  2. otherwise a measurement decides (the type scale, the spacing grid, contrast);
  3. otherwise it's a real design choice. Don't pick for the human. Park it as a 2-option mock
     on the report page and keep climbing on everything else.

**Keep two lists** so later rounds don't reargue them:
  - Rejected: each fix with its reason;
  - Parked: design choices waiting for the human.

**Check every fix after building it.** Measure that it landed, not just that it compiles,
before taking the next round's shots.

## 5. The loop
1. Build the agreed fixes, highest severity first. Keep the round small enough that a score
   change can be traced to its cause.
2. Check: type-check, lint, and the specs that cover the changed files. Add a test only for a
   bug a future edit could plausibly bring back, and confirm it fails without the fix.
3. Retake every shot, then score the round with the council.
4. Track the lowest overall score, not the average.

**Stop** when any of these happens:
  - every counted reviewer gives 9 or more overall in two rounds in a row;
  - <N, e.g. 10> rounds are done;
  - the lowest score falls two rounds running. Revert to the best round and stop.

**Drift guards.** Treat any of these as a regression, whatever the scores say:
  - the brand colour fading;
  - the palette going grey;
  - text getting smaller to fit;
  - copy growing;
  - a reduction in function.

## 6. Reporting
- Keep ONE report page, updated every round, showing:
  - scores per reviewer and per view, with the lowest score highlighted;
  - labelled before and after shots, side by side;
  - the fixes built, with their measurements;
  - the Rejected and Parked lists.
- After every round, send a short note: the scores, the top three changes, and anything parked.
- After round 01, push and open a DRAFT PR (stacked on <base PR> if one exists). It lists the
  method, the score table and the caveats, and ends with `Refs: <org/repo#issue>`. Never merge.
- Before handing off: run the design-system review and the full test suite once. Then shut down
  your dev server and browsers. Leave the seeded data in place, documented in SEED.md.

## 7. Caveats to state in the PR
- Scores are judgement, not measurement. The same model can score the same image differently
  in different threads.
- Fresh contexts and no target score cut score inflation, but don't remove it.
- The human's eye is the last gate. A 9 from the council is a recommendation to look, not
  permission to ship.
