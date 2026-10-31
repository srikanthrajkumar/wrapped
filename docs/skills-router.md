# Skills Router — Carnatic Wrapped

Which agent skill drives which step of development, what is approved, and what is deliberately excluded.
Every phase of work should start by checking this table. The constitution (`.specify/memory/constitution.md`) outranks it. If a step has no skill listed, use the project-local rules (see §5) and plain judgment — do not reach for an unvetted skill.

Vetted 2026-10-26 (stars / pushed dates via `gh api`, SKILL.md content read in full; nothing executed).
Re-vet before adding anything: install counts on skills.sh are **bundle-inflated** and not a quality signal (see §6).

---

## 1. The pipeline and who owns each step

| # | Step | Primary skill | Supporting | Artifact (in repo) |
|---|------|---------------|-----------|-------------------|
| 0 | Sharpen the idea | gstack `/office-hours` | mattpocock `grilling` | `docs/designs/` (office-hours dual-writes it; cross-session copy in `~/.gstack/projects/`) |
| 1 | Constitution | spec-kit `/speckit-constitution` | — | `.specify/memory/constitution.md` |
| 2 | Domain language | mattpocock `domain-modeling` | `grilling` | `GLOSSARY.md` (kriti vs item, artist vs role, sabha vs venue, concert vs lecdem…) |
| 3 | Requirements / spec | spec-kit `/speckit-specify` → `/speckit-clarify` | `mobile-native` (phone constraints), `accessibility` | `specs/NNN-*/spec.md` |
| 4 | Plan (stack, data, auth, offline) | spec-kit `/speckit-plan` | contingent stack skills (§3), `supabase-postgres-best-practices` | `plan.md`, `data-model.md`, `research.md`, `contracts/` |
| 4a | Hard-to-reverse decisions | mattpocock `domain-modeling` (ADR rules) | — | `docs/adr/NNNN-*.md` |
| 4b | Plan review | gstack `/plan-eng-review`, `/plan-design-review`, `/plan-ceo-review` | `/plan-devex-review` (optional) | review notes → fold back into plan |
| 5 | Frontend design | gstack `/design-consultation` → `/design-shotgun` → `/design-html` | `frontend-design` plugin, `mobile-native`, `shadcn` | `DESIGN.md`, mockups |
| 6 | Tasks | spec-kit `/speckit-tasks` → `/speckit-analyze` (consistency gate) | — | `tasks.md` |
| 7 | Build | spec-kit `/speckit-implement` | `codebase-design`, `tdd` (optional), stack skills, `vercel-react-best-practices`, `shadcn` | code + tests |
| 8 | Tests (required on data-loss paths, judgment elsewhere; constitution IV) | stack test skills | `tdd` (optional), `vitest`, `playwright-best-practices` (offline + service-worker refs) | test suites |
| 9 | Code review | gstack `/review` | `web-design-guidelines` (code-level UI rules), `accessibility` | — |
| 10 | Visual / functional QA | gstack `/design-review`, `/qa` | gstack `/benchmark` (perf budgets) | — |
| 11 | Security | gstack `/cso` | `better-auth-security-best-practices` / `supabase` RLS traps (if chosen) | — |
| 12 | Debug | gstack `/investigate` | — | — |
| 13 | Health / test hygiene | gstack `/health`, `/test-audit` | — | — |
| 14 | Ship | gstack `/ship` → `/land-and-deploy` | `/setup-deploy` once | CHANGELOG, PR |

**gstack verdict.** Keep it as the review / QA / design / ship backbone — its adversarial review lenses are the strongest available. Two gstack skills are superseded here:
- `/spec` — it files a *GitHub issue* (backlog item), not a repo spec. Use spec-kit for specs.
- `/autoplan` — it auto-decides plan questions; this project wants each incremental decision made deliberately.

gstack skills are large (7–13K words each); invoke them explicitly by name rather than relying on auto-trigger.

---

## 2. Approved — installed 2026-10-26 (stack-agnostic)

All project-scoped (no `-g`), copied (not symlinked) into `.claude/skills/` and tracked in git, so they are versioned with this repo and don't leak into other projects.

**Installed state**
- spec-kit CLI `specify` 1.2.3 via `uv` 0.13.5 (`~/.local/bin`, release binary checksum-verified). Scaffold in `.specify/`; 10 `speckit-*` skills in `.claude/skills/`, all `disable-model-invocation: true` (call them by name).
- 10 skills via `npx skills add … -a claude-code -y --copy`, pinned by content hash in `skills-lock.json`. The tenth, `vitest`, was added 2026-10-31 (T009) once the plan locked Vite + React. Restore on a new box with `npx skills experimental_install`; update deliberately with `npx skills update -p` and re-read the diff.
- `tdd` sends refactoring to "the `code-review` skill" — in this project that means gstack `/review` (mattpocock `code-review` is not approved).

Commands used (for reference / re-install):

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@v1.2.3
```
```bash
specify init . --integration claude --integration-options="--no-model-invocation"
```
```bash
npx skills add mattpocock/skills -s grilling -s domain-modeling -s tdd -s codebase-design
```
```bash
npx skills add emilkowalski/skills@mobile-native
```
```bash
npx skills add supabase/agent-skills@supabase-postgres-best-practices
```
```bash
npx skills add vercel-labs/agent-skills@vercel-react-best-practices
```
```bash
npx skills add vercel-labs/agent-skills@web-design-guidelines
```
```bash
npx skills add addyosmani/web-quality-skills@accessibility
```
```bash
npx skills add antfu/skills@vitest -a claude-code -y --copy
```

| Skill | Why it earns a place | Evidence |
|---|---|---|
| **github/spec-kit** | Only candidate that writes durable constitution / spec / plan / tasks into the repo, with a cross-artifact `analyze` gate. `--no-model-invocation` makes its skills user-invoked only, so they never fight gstack for a request. | Official GitHub, 143K★, v1.2.3 (2026-10-22) |
| **mattpocock `grilling`, `domain-modeling`** | Short (~350–500 words), sharp. Forces precise domain language and a strict test for when an ADR is warranted — exactly "right incremental decisions". | 304K★, pushed 2026-10-22 |
| **mattpocock `tdd`** (+ `codebase-design`, which it calls) | Best TDD guidance read: agreed seams, vertical slices, anti-tautology rules, ~570 words. Optional: the constitution (IV) does not mandate test-first; use it where a test-first loop helps. | same |
| **emilkowalski `mobile-native`** | Concrete web-on-phone fixes: 16px inputs (no zoom), `dvh`, safe areas, tap delay, sticky hover, PWA status bar; insists on real-device testing. | 49.8K★, pushed 2026-10-11 |
| **supabase-postgres-best-practices** | ~30 wrong-vs-right SQL rule files (indexes, pooling, upsert, pagination). Explicitly applies to any Postgres — the catalog is PG17 regardless of host. | Official Supabase |
| **vercel-react-best-practices** | 70 impact-ranked rules (waterfalls, bundle size, re-renders), lazily loaded. ~10 rules are Next-server-only; ignore them if not on Next. | Official Vercel, 33K★ |
| **web-design-guidelines** | Code-level UI audit with `file:line` output: `inputmode`, `autocomplete`, `touch-action`, safe-area, no mobile `autoFocus`. Fetches its rule list remotely — pin it if it drifts. Invoke explicitly; gstack `/design-review` owns *visual* review. | Official Vercel |
| **antfu `vitest`** | Contingent on Vite + React (§3), now locked. Reference only: Vitest 5 config, `projects`, mocking, environments, generated from Vitest's own docs. No scripts or hooks; references scanned for fetch/exec instructions. | Anthony Fu, 6K★, pushed 2026-10-30, MIT; based on Vitest 5.1 beta (we run 5.0.5) |
| **addyosmani `accessibility`** | WCAG 2.2 incl. target size 2.5.8 and focus-not-obscured — matters for one-handed use in a dark hall. | 3K★ |

---

## 3. Contingent — install when the plan locks the decision

| Decision in `/speckit-plan` | If chosen → install | Notes |
|---|---|---|
| Next.js | use Next ≥ 16.3 (writes its own `AGENTS.md` from bundled docs); `npx skills add vercel/next.js --skill next-dev-loop` | Old `vercel-labs/next-skills` are retired; registry copies are stale. **Caution:** Next's own docs say a full page reload offline fails without a service worker; pending Server Actions are not persisted. |
| Vite + React SPA | `npx skills add antfu/skills@vitest` | Research ranks this first for offline-first (see ADR to be written). |
| React Router v7 | `npx skills add remix-run/agent-skills@react-router-framework-mode` | |
| TanStack Start / Router / DB | skills ship inside the npm packages (TanStack Intent) | TanStack DB is pre-1.0 (0.6.x). |
| Better Auth | `npx skills add better-auth/skills@better-auth-best-practices` and `@better-auth-security-best-practices` | Auth.js is now maintained by the Better Auth team, which steers new projects to Better Auth. |
| Supabase (hosting or auth) | `npx skills add supabase/agent-skills@supabase` | Strong RLS / SECURITY DEFINER trap list. |
| Neon | `npx skills add neondatabase/agent-skills@neon-postgres` | Pooled vs direct URLs; migrations need direct. |
| PowerSync (sync engine) | `npx skills add powersync-ja/agent-skills@powersync` | Only if multi-device / friends become central. FSL self-host licence; cloud free tier deactivates idle projects — bad for a December-only app. |
| Drizzle | no official skill | Point `CLAUDE.md` at `https://orm.drizzle.team/llms.txt`. Drizzle is at 1.0 RC; community skills mix v0/v1 syntax. |
| E2E tests exist | `npx skills add currents-dev/playwright-best-practices-skill@playwright-best-practices` | Has real service-worker and offline-mode references (`context.setOffline`). |
| "Wrapped" year-summary visuals | `vercel-labs/agent-skills@vercel-react-view-transitions`, `emilkowalski/skills@animation-performance` | The `dataviz` skill (already available) covers charts. |

---

## 4. Not approved (and why)

| Skill | Reason |
|---|---|
| **obra/superpowers** | A SessionStart hook injects "even a 1% chance… you MUST invoke"; brainstorming "MUST" run before any creative work. Hijacks requests from gstack and spec-kit and duplicates their pipeline. mattpocock `tdd` gives the discipline at a third of the length. |
| dceoy/speckit-agent-skills | AGPL, single maintainer, breaks without the `.specify/` scaffold; redundant now that spec-kit ships native Claude skills. |
| BMAD method | v7 is alpha; a third overlapping persona system. |
| addyosmani/agent-skills (spec flow, frontend-ui-engineering, performance) | Lower-fidelity copy of spec-kit's flow; generic UI/perf advice already covered. |
| github/awesome-copilot `prd` | Generic enterprise PRD template. |
| mattpocock `to-spec`, `to-tickets`, `wayfinder`, `code-review`, full bundle | Need an issue tracker; compete with spec-kit / gstack `/review`; bundle is 38 skills incl. course authoring. |
| anthropics/skills@frontend-design | Same skill as the installed `frontend-design` plugin → double trigger. |
| pbakaus/impeccable, ui-ux-pro-max, taste-skill, emil-design-eng | Each duplicates gstack design-consultation / shotgun / review and triggers on "design this screen". impeccable may download and run a binary. |
| uizze.sh `ui-taste` / `ios-design` | Rebranded impeccable that upsells a paid MCP; install count 2× the original — anomaly. |
| designed-by-ai `design-mobile-apps` | 20★ / 1M installs; wraps a paid API. Anomaly. |
| cloudflare `web-perf`, addyosmani `performance` | Overlap gstack `/benchmark` + react-best-practices. |
| shadcn/improve, wshobson tailwind / nextjs / TS skills, lombiq tailwind docs | Not UI guidance / generic / stale (pre-Cache-Components Next, last push April). |
| Community PWA skills (alinaqi `pwa-development`, curiositech, secondsky, jwynia) | Generic Workbox tutorials recommending deprecated `next-pwa`; no data layer, no Safari caveats. |
| Context7 (`find-docs`) | Runs unpinned `npx ctx7@latest`; reported prompt-injection vector via library "custom rules". Vendor `llms.txt` + framework-bundled docs cover the need. |
| Clerk skills | Paid third party and added latency; overkill for one user. |
| Rocicorp Zero, Electric, Triplit, Replicache | Zero rejects writes while disconnected; Electric Cloud winding down after Databricks acquisition; Triplit dormant; Replicache archived. |

---

## 5. Gaps — skills we write ourselves (project-local, `.claude/skills/`)

No credible public skill covers these. Author them **after** `/speckit-plan` locks the architecture, so the rules match the actual stack.

### `offline-first-pwa` (draft rules from research)
- UI reads only from the local store; network writes into the store, never into the UI.
- Every mutation = one local transaction (row + outbox entry), returns before any network call. No spinners on the write path.
- Client-generated UUIDv7 ids; soft-delete tombstones until server ack; last-write-wins per record.
- Outbox: FIFO, single-flight, exponential backoff + jitter, idempotency key = outbox id; server returns 2xx for recorded validation rejects.
- Never `await fetch` inside an IndexedDB transaction.
- Pull cursor uses server time, never device clock.
- Sync triggers: app start, `online`, `visibilitychange`, after write. Background Sync is Chromium-only — optional extra. `navigator.onLine` is a hint; a failed fetch is the truth.
- Auth: cached identity suffices offline; never redirect to login on a network error; keep the outbox on 401 and prompt non-blockingly.
- Catalog = versioned, content-hashed snapshot, precached; never fetched per keystroke.
- Service worker: precache shell + catalog, navigation fallback, prompt-to-update — no silent `skipWaiting` mid-concert.
- `navigator.storage.persist()` on first run; quota check; JSON export as an iOS-eviction backup.
- Sync status (pending count, last synced) always visible.
- PR checklist: Playwright airplane-mode test (log → kill → reopen → sync, no dupes); 4× CPU-throttled search benchmark; real iOS installed-PWA check.

### `carnatic-search` (transliteration-aware matching)
- One shared fold function applied to index *and* query: NFD + strip combining marks (IAST), `aa→a`, `ee|ii→i`, `oo|uu→u`, `th→t`, `dh→d`, `bh→b`, `kh→k`, `gh→g`, `sh|ṣ|ś→s`, `zh→l`, `w→v`, collapse doubled letters.
- Alias table for genuine name variants (Sankarabharanam / Dheerasankarabharanam) — reuse `raga-groups.json` from the logger pipeline.
- Golden set of ~100 real variant-spelling queries in CI (target ≥ 95% correct in top 3).
- Candidate engines: uFuzzy (short titles, tiny) or MiniSearch (field boosting). Not Fuse.js (~80× slower).

---

## 6. Vetting rules for adding a skill later

1. Read the SKILL.md in full before installing. Reject fluff, stale framework versions, and anything that downloads/executes binaries without need.
2. Prefer the vendor's official repo; avoid mirrors and aggregators.
3. Ignore install counts (bundle installs inflate every skill in a repo — e.g. mattpocock `migrate-to-shoehorn` shows 481K). Check stars, last push, and maintainer instead.
4. Check trigger overlap with what is already here. Two skills auto-triggering on the same request is a real cost; prefer user-invoked-only for workflow skills.
5. Install project-scoped; record it in this file with the reason.
