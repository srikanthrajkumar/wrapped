# Carnatic Wrapped

Phone-first web app for logging Carnatic concerts and lecdems attended during Chennai's December (Margazhi) season.
The kriti / raga / composer catalog comes from the logger pipeline in `/opt/carnatic/logger` (see its `CLAUDE.md`).

## Before starting any phase of work

Read [`docs/skills-router.md`](docs/skills-router.md). It maps each development step to the approved skill, lists contingent skills to install once a stack decision is made, and lists skills that are deliberately not approved. Do not install a skill that is not in the router without vetting it per §6 and recording it there.

## Non-negotiables (until the constitution supersedes this section)

- Phone-first and offline-tolerant: sabha halls have poor connectivity.
- Latency is a feature: no network round-trip on the logging path.
- Code quality over speed of delivery; tests first.
- Decisions are made deliberately, one at a time; hard-to-reverse ones get an ADR in `docs/adr/`.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. Route only to skills in the session's available-skills list; answer directly for quick questions or small scoped edits. `docs/skills-router.md` is the source of truth; these are the common entry points.

- Product ideas/brainstorming → /office-hours
- Constitution, spec, plan, tasks → /speckit-constitution, /speckit-specify, /speckit-clarify, /speckit-plan, /speckit-tasks, /speckit-analyze (user-invoked; never /spec or /autoplan)
- Domain terms, GLOSSARY.md, ADRs → domain-modeling; stress-testing a decision → grilling
- Strategy/scope → /plan-ceo-review
- Architecture → /plan-eng-review
- Design system/plan review → /design-consultation or /plan-design-review
- Building features or fixing bugs → tdd
- Bugs/errors → /investigate
- QA/testing site behavior → /qa or /qa-only
- Code review/diff check → /review
- Visual polish → /design-review
- Ship/deploy/PR → /ship or /land-and-deploy
- Save progress → /context-save
- Resume context → /context-restore
