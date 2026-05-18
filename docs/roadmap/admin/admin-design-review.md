---
name: admin-design-review
description: Systematic visual / design pass across every admin pane after the IA + per-area sweeps land. For each pane — open in Chrome, screenshot, run through Claude-design review, apply the improvement deltas. Establishes a coherent admin visual language with consistent accents, shared chrome rhythm, and per-bucket personality cues that an operator parses instantly. Caps the post-IA admin work; everything that follows is operator-content not platform-chrome.
---

# Admin design review — visual consistency pass

## Goal

The admin shipped its IA pivot (5-bucket task-driven taxonomy) +
per-area sweeps + shared `<PaneHeader>` / `<EmptyState>` / `<SaveBar>`
+ rhythm tokens. That's the structural layer. **This jump is the
visual layer on top.**

For every admin pane, we:

1. **Open in Chrome**, navigate to it
2. **Take a screenshot**, save to `docs/roadmap/_meta/design-artifacts/admin-design-review/<bucket>/<pane>.png`
3. **Run through Claude-design review** — the same Stitch-pipeline shape we used for module variants (see `docs/roadmap/_meta/stitch-design-pipeline.md`). Capture before/after sketches per pane.
4. **Apply the improvement deltas** as a per-pane commit (or batched per-bucket when changes are mechanical)
5. **Establish a coherent admin visual language**:
   - One accent system (single accent + supporting greys) used consistently
   - Per-bucket personality cues — subtle, so an operator immediately knows which bucket they're in without reading the breadcrumb (e.g. accent shade tweak, icon family, header treatment)
   - Shared chrome rhythm — the IA jump's rhythm tokens become the rule, not the exception
   - Empty-state art consistent across panes
   - Form density consistent
   - Table density consistent
   - Loading + error states consistent

## Why now

- **Post-IA the structural layer is done; visual coherence is the gap.** Each pane today still reads as built-by-a-different-person. The IA gives them homes, the design review gives them visual citizenship.
- **First-impression for prospects.** When a prospect installs the CMS, the admin is where they live for 2-3 hours of evaluation. Visual coherence raises perceived quality more than any single feature.
- **Reduces cognitive load for operators.** When every pane looks like a sibling, the operator doesn't re-learn each surface; they pattern-match.
- **Caps the admin work cycle.** After this jump, the admin is *done* — anything that follows is content (operator-authored) or features (new capability), not platform-chrome.

## Scope

**In scope:**

- Chrome-MCP-driven screenshot capture of every admin pane (~46 panes per the audit)
- Per-pane Claude-design review session captured under `design-artifacts/admin-design-review/<bucket>/<pane>/`
- Per-pane improvement deltas applied (mostly SCSS / spacing / accent / icon)
- Single accent system codified in `ui/admin/styles/admin-tokens.scss` (extends today's `admin-rhythm.scss`)
- Per-bucket personality cues (one per top-level bucket — Build / Content / Settings / Analytics / Advanced)
- Empty-state art consistency check across all `<EmptyState>` consumers
- Form + table density consistency
- Loading + error + dirty-form state consistency
- Visual baseline re-capture under `tests/e2e/visual/`

**Out of scope:**

- Functional behaviour changes (pane logic stays identical)
- New features (this is a pass, not a feature jump)
- The customer-facing storefront — owns its own theme pipeline; admin is its own visual system
- Multi-language admin copy (`admin-information-architecture.md` covers labels; this is visual only)
- Per-operator theme customisation (single admin visual identity)

## Design

### Phase 1 — capture (screenshot pass)

Use `mcp__Claude_in_Chrome__*` tools to walk every admin URL listed in
`docs/roadmap/_meta/admin-pane-inventory.md` (post-pivot, ~46 entries).
For each:

- `tabs_create_mcp` or reuse existing tab
- `navigate` to the new URL (per the 5-bucket taxonomy)
- Wait for the pane to settle (no skeleton loaders visible)
- Screenshot the viewport at standard width (1440px)
- Save to `docs/roadmap/_meta/design-artifacts/admin-design-review/<bucket>/<pane-name>/before.png`

Repeat for dark mode where applicable.

### Phase 2 — review (Claude-design per pane)

For each captured pane:

- Open the `before.png` in Claude's vision
- Walk a structured checklist:
  - Header presence + alignment (uses `<PaneHeader>`?)
  - Whitespace rhythm (uses `--admin-rhythm-*` tokens?)
  - Accent usage (single accent, used sparingly + meaningfully?)
  - Empty/loading state shape (uses `<EmptyState>`?)
  - Form structure (consistent with the form template?)
  - Table density + sortable-column treatment (consistent with the table template?)
  - Action button hierarchy (primary / secondary / destructive used correctly?)
  - Inline help text + tooltips (consistent voice, plain English per `admin-information-architecture.md`)
- Output a delta sketch: a 5-15 bullet "improve" list per pane
- Where the improvement is generic (applies to >3 panes), capture as a shared-component upgrade in `ui/admin/shell/` rather than per-pane work

Save the review notes as `docs/roadmap/_meta/design-artifacts/admin-design-review/<bucket>/<pane-name>/review.md`.

### Phase 3 — apply (improvement deltas)

Process per-bucket — one commit per bucket. Each commit:

- Applies per-pane SCSS / spacing / accent fixes that came out of the review
- Updates the shared component if the review flagged a generic improvement
- Captures the new screenshot as `after.png` in the same artefact folder
- Updates the visual baseline (`tests/e2e/visual/admin/<pane>.png`)

Commit pattern: `feat(admin-design): visual review pass — <bucket> bucket`.

### Phase 4 — accent system

Codify the final visual language in `ui/admin/styles/admin-tokens.scss`
+ document in `docs/info/admin-visual-system.md` (new file). Captures:

- Primary accent (the brand accent for admin — distinct from the storefront's per-theme accent so operators don't confuse mode-switching)
- Supporting greys (surface / surface-elevated / surface-overlay / border / divider / text-strong / text-secondary / text-tertiary)
- Per-bucket personality cue — exact shade / accent variation per bucket
- Iconography family (lucide / tabler / antd — pick one and stick to it; some panes today mix two)
- Empty-state art family
- Typography scale (already mostly in place — verify + lock)
- Motion tokens (already shipped; verify usage)
- Dark-mode parity (already shipped; verify every pane's deltas track)

## Acceptance

- [ ] All ~46 admin panes have before / after screenshots in `design-artifacts/admin-design-review/`
- [ ] Each pane has a review markdown next to its screenshots
- [ ] One accent system codified in `admin-tokens.scss` + documented in `admin-visual-system.md`
- [ ] Per-bucket personality cue applied + visible without reading labels (test: blur-the-page + can-you-tell-which-bucket)
- [ ] Empty-state art reused across panes (no orphan one-off illustrations)
- [ ] Form density + table density consistent (verified by overlaying screenshots — same row-heights, same gutter widths)
- [ ] Loading + error + dirty-form states consistent across at least 5 sample panes per state
- [ ] Visual baselines re-captured + green on Playwright

## Dependencies

- `admin-information-architecture` (5-bucket pivot) — must land first; review uses the new URLs
- Admin per-area sweeps (chrome adoption across remaining ~40 panes) — must land first; review assumes every pane already uses the shared chrome
- `admin-empty-states-onboarding` — shipped; the empty-state art set is the starting point
- `admin-dark-mode-audit` — shipped; review pass verifies parity
- `kbar command palette` — shipped; review verifies action-map coverage

## Files to touch (rough)

- New under `docs/roadmap/_meta/design-artifacts/admin-design-review/<bucket>/<pane>/{before.png,after.png,review.md}` — ~138 artefacts (46 panes × 3 files)
- `ui/admin/styles/admin-tokens.scss` (new — extends `admin-rhythm.scss`)
- `docs/info/admin-visual-system.md` (new)
- Per-bucket SCSS deltas: `ui/admin/features/<feature>/*.scss` (per-pane mechanical)
- Per-bucket `ui/admin/shell/*` tweaks if the review flags generic upgrades
- `tests/e2e/visual/admin/*` baseline re-capture

## Effort

XL (1-3 days AI). Bulk of the time is the per-pane review pass — 46
panes × ~5 minutes review + delta sketch = ~4h. Apply phase is per-
bucket SCSS work, ~1-2h per bucket = ~6-12h. Accent system codification
+ visual-system doc is ~2h. Visual baseline re-capture is the longest
non-AI step.

## Operator post-merge ops

1. Walk every admin pane once and eyeball the visual consistency
2. If any per-bucket personality cue feels off, surface it — single iteration after the pass
3. Visual baselines re-baked locally with `playwright test --update-snapshots`
