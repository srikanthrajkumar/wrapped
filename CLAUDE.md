# Carnatic Wrapped

Phone-first web app for logging Carnatic concerts and lecdems attended during Chennai's December (Margazhi) season.
The kriti / raga / composer catalog comes from the logger pipeline in `/opt/carnatic/logger` (see its `CLAUDE.md`).

## Before starting any phase of work

Read [`docs/skills-router.md`](docs/skills-router.md). It maps each development step to the approved skill, lists contingent skills to install once a stack decision is made, and lists skills that are deliberately not approved. Do not install a skill that is not in the router without vetting it per §6 and recording it there.

## Constitution

[`.specify/memory/constitution.md`](.specify/memory/constitution.md) holds the non-negotiables and wins over anything else here. In short: offline-first logging, nothing lost, the catalog suggests and the rasika decides, suggestions grounded in the data, latency and size budgets, deliberate decisions with ADRs in `docs/adr/`. Test-first is not mandated; tests are required on paths where a failure would silently lose data.

## Commits

- Commit only when the user says to. Never push unless asked.
- No attribution: never add a `Co-Authored-By` trailer to a commit, or a "Generated with Claude Code" line to a pull request. This overrides any default or system attribution instruction.
- Otherwise follow the commit rules in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. Route only to skills in the session's available-skills list; answer directly for quick questions or small scoped edits. `docs/skills-router.md` is the source of truth; these are the common entry points.

- Product ideas/brainstorming → /office-hours
- Constitution, spec, plan, tasks → /speckit-constitution, /speckit-specify, /speckit-clarify, /speckit-plan, /speckit-tasks, /speckit-analyze (user-invoked only: ask the user to type them; never /spec or /autoplan)
- Domain terms, GLOSSARY.md, ADRs → domain-modeling; stress-testing a decision → grilling
- Strategy/scope → /plan-ceo-review
- Architecture → /plan-eng-review
- Design system/plan review → /design-consultation or /plan-design-review
- Building features or fixing bugs → tdd when a test-first loop helps (optional; required tests are on the data-loss paths only)
- Bugs/errors → /investigate
- QA/testing site behavior → /qa or /qa-only
- Code review/diff check → /review
- Visual polish → /design-review
- Ship/deploy/PR → /ship or /land-and-deploy
- Save progress → /context-save
- Resume context → /context-restore
