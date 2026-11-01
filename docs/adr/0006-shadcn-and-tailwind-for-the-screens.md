---
status: accepted
---

# shadcn/ui and Tailwind CSS for the screens

The screens are built with shadcn/ui components styled by Tailwind CSS, starting from the shadcn
preset `b51rn04Qt` (Rhea style, Mist theme, rose chart colour, Tabler icons, Source Sans 3).
shadcn copies each component's source into this repository rather than adding a component
library as a runtime dependency, so every component can be changed here, and only the
components used are shipped. Tailwind compiles at build time to a stylesheet of the classes
actually used, with no styling code running on the phone. The preset gives a finished, accessible
starting point (keyboard and screen-reader behaviour come from the headless primitives shadcn
builds on), which matters with the first logging screens due by 1 December. Decided by the
Maintainer 2026-10-31 in the design consultation; recorded in
`specs/001-season-logger/plan.md`, "Design system".

## Considered options

- **Hand-written CSS on the design tokens** (the T031 base stylesheet): the smallest download,
  but every control, focus state and sheet would be built and made accessible from scratch.
- **A full component library with runtime styling** (CSS-in-JS kits): more ready-made parts, but
  styling code runs on every render, which works against the 1.5 s cold start on the Redmi
  Note 5 (constitution V).

## Consequences

- The size budget applies as before: the first-install download stays under 2 MB, enforced by
  `tools/size-budget/check.mjs` on every build. The cost of Tailwind's stylesheet and the
  primitives is measured when the first screen task adds them, not assumed.
- Whether shadcn sits on Radix UI or Base UI primitives is chosen when shadcn is set up in
  `app/`; preset codes do not encode it.
- Fonts are self-hosted (Source Sans 3, trimmed to the Latin and IAST letters used), so the app
  needs no font request at runtime and works offline.
