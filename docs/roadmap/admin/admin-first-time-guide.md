---
name: admin-first-time-guide
description: First-time operator onboarding — an active guide that highlights mandatory configuration items, walks the operator through the platform's features in a guided tour, and stays accessible from the admin chrome for re-runs. Sits on top of the already-shipped `/admin/onboarding` wizard (sample-bundle seeding) and the empty-states pass — both shipped 2026-05-14. This jump is the *active* layer — the wizard handed the operator a seeded site; the first-time guide handles "now what?"
---

# Admin first-time guide

## Goal

When an operator finishes the `/admin/onboarding` wizard (Q7, shipped
2026-05-14) and lands on the admin home for the first time, the
current experience is: a populated admin shell + 16 surfaces with
empty-state placeholders + zero indication of what the operator
should do *next*. The seeded sample bundle gives them a working site,
but it doesn't teach them how to drive it.

This jump adds an **active first-time guide** that:

1. **Highlights mandatory configuration** the operator must complete
   before going public — site title, operator legal entity, language
   default, contact email, payment provider (if commerce enabled),
   DKIM (if email enabled), backup destination (if production). A
   visible progress bar / checklist in the admin home so the operator
   always sees what's left.
2. **Walks the operator through each major capability** — a guided
   tour that introduces the platform's features in a sensible order:
   "Here's where you edit pages", "Here's where products live",
   "Here's how to enable + configure features", etc. Skippable per
   step; resumable; rememberable per-account.
3. **Stays accessible** — operator can re-run any time from the
   admin chrome (e.g. user-status badge → "Restart guide" / "Show
   onboarding checklist"). Not a one-shot welcome modal that
   disappears forever.

Note: this is **NOT** the `/admin/onboarding` wizard re-run — that's
the *passive* setup (seed sample content, pick a theme). This is the
*active* guidance layer that runs alongside the operator's actual
work.

## Why now

- **Operator-feedback signal.** Prospects who install the CMS run
  into the same wall: "the admin is rich but I don't know where to
  start." The seeded sample bundle masks the problem (they see a
  working site) but doesn't solve it (they don't know what they're
  looking at). The active guide turns that confusion into a
  step-by-step.
- **Pre-public-deploy gates need visibility.** The four pre-deploy
  gates (a11y / GDPR / email / backup) involve operator-side
  configuration the operator may not even know exists. The mandatory-
  config checklist surfaces them where the operator will find them.
- **Differentiator.** Most CMSes assume the operator has read the
  docs. Shipping a first-time guide that's friendlier than Shopify's
  "your store is ready!" + Squarespace's "edit your homepage" is
  achievable and reads as a quality signal to prospects.
- **Scales with the platform's complexity.** As we add features
  (dropship, releases, invoicing, etc.), the surface grows. Without
  a guided tour, every new feature accumulates "where do I configure
  this?" friction. Building the guide once + each feature contributes
  its own tour step avoids the per-feature documentation rewrite
  cycle.

## Scope

**In scope:**

- `OnboardingChecklistService` — first-class service that computes
  what's still missing for the operator's current site (mandatory
  items unconfigured; feature-flag-on-but-not-credentialed; recommended
  next-steps from the active feature set)
- Persistent checklist surfaced on the admin home (`/admin`) and as
  a dismissable drawer accessible from the user-status badge
- Guided-tour overlay — points at the relevant pane / button /
  field, gives a 1-2 sentence "what this does + why you want it"
  hint, lets the operator dismiss the step or "show me how" (which
  navigates to the pane)
- Per-feature tour-step contributions — each major feature ships
  with a `tourSteps: ToureStep[]` export consumed by the guide engine
- Resume / restart — operator can re-trigger the tour from settings;
  individual tour-steps remember "completed" state so a re-run skips
  already-mastered surfaces
- MCP coverage — `onboardingChecklist.list` / `onboardingChecklist.markComplete`
  so an AI agent can also drive the operator through (sits naturally
  alongside the AI-first mode from `aui-mode-hierarchy.md`)
- Plain-English copy throughout (no jargon)

**Out of scope:**

- Video tutorials / animated demos — text + pointer overlays only
- A/B testing different tour flows — single flow, optimised after the
  jump ships
- Multi-language tour copy — single-language v1 (English; lv/it/lt/ru
  follow once the English copy stabilises)
- The `/admin/onboarding` wizard itself — already shipped; this jump
  layers on top of it
- The `EmptyState` art — already shipped under
  `admin-empty-states-onboarding`; tour pointers reuse it where it
  fits naturally

## Design

### Checklist service

```ts
// services/features/Onboarding/OnboardingChecklistService.ts

export interface IChecklistItem {
    id: string;                    // 'site.title' / 'operator.vatId' / 'email.dkim'
    severity: 'required' | 'recommended';
    title: string;                 // plain-English
    why: string;                   // 1-line plain-English explanation
    completed: boolean;
    /** Where to take the operator when they click "do this". */
    targetUrl?: string;
    /** Optional contextual prefill — e.g. for the mandatory-config item
     *  "set your VAT ID", drop the operator on `/admin/settings/account`
     *  with the VAT-ID field focused. */
    targetFocus?: string;
}

export interface OnboardingChecklist {
    items: IChecklistItem[];
    completedCount: number;
    totalCount: number;
    /** What % of required items are done — drives the progress-bar visual. */
    requiredPctComplete: number;
}
```

The service is feature-aware:

- Walks active feature flags. Each enabled feature contributes its
  own checklist items (e.g. `commerce.dropshipEnabled` adds
  `dropship.credentials`, `dropship.adapter-picked`, `dropship.first-order-tested`).
- Reads the operator's `Settings → Operator profile` snapshot and
  marks every required field as completed or missing.
- Surfaces pre-public-deploy gates (a11y / GDPR / email / backup) when
  the operator's site mode is `production`.

### Guided tour engine

Reuse the `kbar` action-map pattern. Each tour-step is a static
config:

```ts
// ui/admin/shell/Onboarding/tourSteps.ts

export interface TourStep {
    id: string;
    /** Order within the tour. Steps without `requires` run by id-asc. */
    order: number;
    /** Other tour-step ids that must be completed first. */
    requires?: string[];
    /** kbar-style title shown in the tour overlay. */
    title: string;
    /** 1-2 sentence hint. */
    body: string;
    /** Where to point — same selector / data-testid shape as kbar. */
    target: {selector: string} | {testId: string};
    /** When the operator clicks "show me how", navigate here. */
    navigateTo?: string;
}
```

Per-feature tour steps live in the feature's directory and get
auto-collected at boot via the same registry pattern as MCP tools +
admin loaders.

### UI surfaces

- **Admin home (`/admin`)** — top of the page renders the checklist
  with a progress bar. Items grouped by severity (required first).
  Each item is one-click-actionable.
- **User-status badge dropdown** — "Restart guide" + "Show checklist"
  links live here so re-entry is always one click away.
- **Tour overlay** — when an operator triggers the tour or hits an
  empty-state CTA that says "Show me how", a small overlay opens at
  the target element with the tour-step body + a "got it" / "next step"
  button.

### Acceptance criteria for "non-technical operator can navigate"

The defining test: a non-technical operator (think someone who's
configured a Wordpress site but never touched a CLI) sits down at a
fresh install and within 30 minutes can:

- [ ] Identify which configuration items are mandatory before going public
- [ ] Configure their operator legal entity (name, address, VAT ID) without external help
- [ ] Find where to edit the homepage
- [ ] Find where to enable + configure a feature (commerce / email / etc.)
- [ ] Find how to invite another admin user (Settings → Access)
- [ ] Find where to view orders / inquiries / customers
- [ ] Know what to do next when they're stuck

The guide is the test surface for that ergonomic.

## Dependencies

- **admin-information-architecture** — the 5-bucket taxonomy is the
  navigation backbone the guide walks the operator through. Shipped today (hybrid).
- **admin-empty-states-onboarding** — the empty-state art + the
  `/admin/onboarding` wizard. Shipped 2026-05-14.
- **aui-mode-hierarchy** (extended 2026-05-16 with AI-first mode) —
  the simplified mode is what the guide assumes the operator is in.
  AI-first mode skips the visual guide (the AI agent walks the operator
  through over MCP instead).
- **kbar command palette** — the tour-step pointer logic re-uses kbar's
  action-map + selector targeting machinery.

## Files to touch (rough)

- `services/features/Onboarding/OnboardingChecklistService.ts` (new)
- `services/features/Onboarding/OnboardingServiceLoader.ts` (new)
- `services/features/Onboarding/onboardingFlags.ts` (new) — `onboarding.guideEnabled`
- `services/features/Mcp/tools/onboarding.ts` (new) — `onboardingChecklist.list/markComplete`
- `ui/admin/shell/Onboarding/OnboardingChecklist.tsx` (new) — admin-home checklist component
- `ui/admin/shell/Onboarding/TourOverlay.tsx` (new) — tour pointer component
- `ui/admin/shell/Onboarding/tourSteps.ts` (new) — tour-step registry
- `ui/admin/shell/UserStatusBar.tsx` — add "Restart guide" link
- Per-feature: each major feature dir gains a `<Feature>.tourSteps.ts` export
- Tests + visual baselines

## Acceptance

- [ ] Checklist visible on `/admin` for any operator whose `OnboardingChecklistService.list()` returns items
- [ ] Required items show first, with the why explained in plain English
- [ ] Clicking a required item deep-links the operator to the configuration surface, with the right field pre-focused where possible
- [ ] Tour overlay reachable from user-status badge ("Restart guide")
- [ ] Tour steps cover: Build (the page editor), Content (where each content type lives), Settings (each Settings sub-area), Analytics (how to read reports), System (only surfaced in Advanced mode)
- [ ] Operator's completed tour-steps persist across sessions on their account
- [ ] AI-first mode skips the visual tour and surfaces the same data via MCP
- [ ] Every label / button / hint reads naturally to a non-technical operator
- [ ] MCP tools `onboardingChecklist.list` + `onboardingChecklist.markComplete` ship

## Effort

L (3-8h AI). Service + checklist component + tour engine + per-feature
tour-step contributions for the major surfaces (Build / Content /
Settings / Analytics) is the bulk. Tour-step copy + plain-English
review for the hints is the slowest non-trivial part.

## Operator post-merge ops

1. Walk through the guide once on a fresh install, eyeball every
   tour-step's copy + targeting. Flag any step that reads as jargon-y
   or points at the wrong element.
2. After the labels-and-guidance pass on the per-area sweeps lands,
   re-run + re-eyeball.
