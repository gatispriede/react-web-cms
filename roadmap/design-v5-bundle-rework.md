# Rework paper-portfolio bundle for design-v5

**Status:** Draft scaffold shipped (2026-04-20). Content rework + v5-specific enhancements pending.

## Context

`public/design-v5/` holds the new design files (`Portfolio.html`, `Portfolio Industrial.html`, `Portfolio Studio.html`, `Portfolio Studio Dark.html`, `responsive-test.html`). v5 is an upgrade on v1 (Paper theme, same four pages: Home / Capability matrix / Career record / Dossier appendix). Module interfaces have been reworked since v1 (see [`docs/architecture/module-interfaces.md`](../docs/architecture/module-interfaces.md) for the current shape). The existing `paper-portfolio-v5.bundle.json` is currently a v1 clone with ID prefix remapped (`paper-*` → `paper-v5-*`) and Paper theme tokens carried forward — it imports cleanly but doesn't exercise any of the modules added since v1.

## Goal

A `public/design-v5/paper-portfolio-v5.bundle.json` that, when imported via Site settings → Bundle → Import, reproduces the v5 HTML design faithfully using the **current** module set — including modules that didn't exist when v1 shipped.

## Design

- **Keep the four pages**: Home, Capability matrix, Career record, Dossier appendix. v5's HTML layout still matches v1.
- **Swap Timeline entries to use new fields**: `experienceTitle`, `achievementsTitle` where the v5 design labels differ (e.g. Latvian translations already in place). Add `domain` + `contractType` on every entry (already present in v1).
- **Add Services section if v5 introduces it** — need to diff v5 Portfolio.html vs v1 to confirm. If yes: migrate the "Four practices" content from v2's Studio bundle into v5's Paper flavour.
- **Extend List (Dossier contact/signals)** to use new `cases`-style fields (`prefix`, `prefixSub`, `meta`, `tags`) where v5 shows project cards rather than plain key/value.
- **Theme tokens**: v5 uses the same Paper palette as v1 (accent rust, Instrument Serif display, JetBrains Mono, Inter Tight). The v5 HTML also ships alt themes (`graphite`, `bone`, plus `Portfolio Studio Dark.html`) — worth importing those as additional `themes[]` entries so users can preview / switch without editing tokens.
- **Bundle manifest**: bump `exportedAt`, set clear note explaining it's a v1 descendant with reworked modules. Theme id stays `paper-v5-preset-v1` (already remapped).

## Files to touch

- `public/design-v5/paper-portfolio-v5.bundle.json` — rewrite sections + add alt-theme entries.
- `scripts/` — optional: small content-diff script to compare the current bundle JSON against the v1 original, surface drift.
- `docs/architecture/module-interfaces.md` — keep current; already references this item.

## Acceptance

- Importing the v5 bundle into a fresh DB yields the same page set and identical rendered content as `Portfolio.html` in the browser (at desktop widths).
- Timeline entries use the new optional title overrides where the v5 HTML hints at them.
- At least one alt-theme (graphite or bone) ships inside `themes[]` so the Theme picker has two Paper variants.
- `npm run build` + a smoke import round-trip produces no schema errors.

## Effort

**M · 3–5 h** once the v5 HTML is fully parsed. Detailed page-by-page diff against the v1 bundle is the biggest chunk.
