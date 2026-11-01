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

## Set up (2026-11-01, with T040 to T044)

- **Radix UI**, not Base UI. Measured with esbuild (minified, React external, brotli): a Dialog
  and a dropdown Menu, the two primitives the logging screens need, cost 30.0 KB on Radix
  (`radix-ui` 1.8.1) and 55.9 KB on Base UI (`@base-ui/react` 1.9.0); a Dialog alone 12.8 KB
  against 21.5 KB. Both give focus trapping and the screen-reader behaviour the screens need,
  so the smaller one wins.
- The class helper is `clsx` with `tailwind-merge`, as shadcn used for years, not the `cn`
  package shadcn's CLI now installs: that npm name changed hands in September 2026 and its
  current version was two days old.
- Source Sans 3 is trimmed by `tools/fonts/subset.sh` to two variable woff2 files (Latin,
  27.6 KB; the IAST and ISO 15919 letters of Latin Extended, 19.3 KB), loaded with
  `unicode-range`, in the first download. Fontsource's subsets have no arrows, so "Next Item →"
  draws its arrow as a Tabler icon.
- **Size cost** (first install, brotli, without the catalog snapshot): 97.6 KB on `main` before
  the screens, 211.9 KB after: JavaScript 89.2 to 148.6 KB (the screens, Radix, Tabler icons,
  cva, clsx and tailwind-merge), CSS 0.6 to 8.0 KB, fonts 46.9 KB. With the real snapshot the
  first install is 709.6 KB of the 2 MB budget.
