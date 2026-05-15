---
name: admin-empty-states-onboarding
description: Designed empty states across every admin list view + first-run admin onboarding (seeded sample page / post / product / theme). Operator never sees blank-canvas paralysis.
research: see research-findings-2026-05-12.md §1 Empty states + onboarding
---

# Admin empty states + first-run onboarding

> **Status: SHIPPED 2026-05-14.** The first-run wizard + seeded sample bundle
> shipped earlier as Q7 (`/admin/onboarding`, server-side fresh-install gate).
> This jump landed the **operator-grade empty-state** half: the shared
> `ui/admin/lib/EmptyState.tsx` now takes an `art?: EmptyStateArtKey` prop
> resolved from a 15-key inline-SVG illustration set (`ui/admin/lib/emptyStateArt/index.tsx`,
> keyed per surface, `currentColor`-stroked so it tracks light/dark mode), plus
> an `onboardingCta(label, testId)` helper that builds a `secondary` action
> deep-linking into the wizard (`/admin/onboarding?force=1`). `AdminCrudListModule`'s
> `emptyState` config gained `art` + `secondary` pass-through. Wired across 16
> admin empty-state surfaces (Posts / Products / Users / Orders / Inquiries /
> Trash / Mcp tokens / Redirects / Permissions / Publishing / Inventory runs /
> Themes / Audit / Error log / Notifications / SEO overview / Backups);
> `onboardingCta` secondary on the three content-creation panes.
> **Deferred:** the 14 hand-drawn Stitch illustrations (out of AI budget — the
> inline-SVG set is the stand-in); the Languages + Inventory-products panes
> still don't render an `EmptyState` (their i18n keys pre-exist unused);
> the `/admin/setup` route name (shipped as `/admin/onboarding`) and the SSR
> relaxation of the `isFreshInstall()` gate for `?force=1` re-triggers.
> See [shipped.md](../shipped.md).

## Goal

Every admin list view ships a **designed empty state** (illustration + one primary CTA + one "import sample data" link) rather than a blank table. First admin login seeds a sample page + sample post + sample product + applies the default theme so the operator immediately has *something* to click into.

Pattern reference: Shopify Polaris (26+ designed empty states), Basecamp / Dropbox / Evernote (seed workspace with starter docs), Directus (first-run admin wizard).

## Why now

- The MCP "natural language → ready page" narrative needs a starting surface. An empty admin defeats the demo before the AI generates anything.
- Operator-onboarding friction is the biggest gap between "I signed up" and "I shipped a site." Sample content collapses the gap.
- Pairs with [admin-toast-system-sonner](admin-toast-system-sonner.md) — first-run completion gets a celebratory toast: "Welcome — we seeded a sample site. Press ⌘K to explore."

## Design

### Empty-state component

`ui/admin/shell/EmptyState/EmptyState.tsx` — composable:

```tsx
interface EmptyStateProps {
    illustration?: ReactNode;          // SVG component from ui/admin/assets/empty-states/
    title: string;
    description: string;
    primary: {label: string; onClick: () => void};
    secondary?: {label: string; onClick: () => void; variant?: 'link' | 'ghost'};
}
```

Renders as: centered illustration (240 × 180 px) + title (semibold 18px) + description (regular 14px, 60ch max) + primary button + optional secondary link.

### Per-pane empty states

Every admin list view that can be empty gets one:

| Pane | Title | Description | Primary | Secondary |
|---|---|---|---|---|
| Pages | "No pages yet" | "Start with a page — your home, an about, a contact." | Create page | Import sample bundle |
| Posts | "No posts yet" | "Write a post — announcements, articles, updates." | New post | Import sample bundle |
| Products | "No products yet" | "Add a product, or sync from an external warehouse." | New product | Configure warehouse |
| Themes | "No themes yet" | "Choose a theme to set the look of your site." | Browse themes | (no secondary — themes seed from JSON presets on first boot) |
| Users | "No team yet" | "Invite teammates with role presets." | Invite user | Learn about roles |
| Orders | "No orders yet" | "Orders show up here as customers buy." | (none) | Storefront URL |
| Inventory | "No warehouse connected" | "Connect a warehouse to sync product data." | Connect warehouse | Use mock adapter |
| Customers | "No customers yet" | "Customer accounts appear here after signup." | (none) | Storefront URL |
| Inquiries | "No inquiries yet" | "Messages from your site's contact form show up here." | (none) | Storefront URL |
| Trash | "Trash is empty" | "Deleted items appear here for 24 hours." | (none) | (none) |
| Audit | "No audit events yet" | "Changes you make to the site appear here." | (none) | (none) |
| Errors | "No errors recorded" | "If something goes wrong, you'll see it here." | (none) | (none) |
| MCP tools | "No tools enabled" | "MCP tools let agents act on your site." | Enable defaults | Docs |
| Languages | "Default language only" | "Add languages to translate your site." | Add language | (none) |

### First-run onboarding wizard

Mounted at `/admin/setup` (gate: fresh-install flag from `Onboarding` feature, already shipped). Three steps:

1. **Identity** — site name, logo upload, language(s), default theme. Powered by the existing OnboardingBootstrap mutation.
2. **Seed content** — checkbox-default-on for "Start with sample content (one page, one post, one product)." If checked, seeds via existing Bundle import path from `seeds/admin-onboarding.bundle.json` (new file, committed).
3. **First action** — "Press ⌘K to see what you can do" with a screenshot of the command palette. Click "Open palette" launches it inline.

Wizard layout: full-screen overlay with progress dots, one step per screen, mobile-responsive.

Completion writes `siteFlags.onboardingComplete = true` + `notifySuccess('Welcome — you\'re all set up.')`.

### Sample bundle content (`seeds/admin-onboarding.bundle.json`)

Real, well-styled sample content — not lorem ipsum. Pulls from the existing CV / Skyclimber bundles (extract a curated subset). Mandatory:

- One Hero + one Manifesto + one Gallery (3 images) + one ProjectGrid (3 entries) — covers all primary module types
- One blog post with cover image
- One product with images + variants
- Demo footer + nav
- Pinned to the `editorial` theme (post first-class-themes wave 5)

This file is the demo. Treat it as a product surface — keep it tight, well-photographed, no placeholder strings.

### Skip path

Wizard step 1 shows an "Already familiar — skip setup" link in the bottom-right. Skips straight to `/admin` with `siteFlags.onboardingComplete = true` and no seeded content. Empty states then carry the operator without forcing the wizard.

### Re-trigger path

`/admin/setup?force=1` re-runs the wizard for testing or re-onboarding. Existing content not wiped; only the seed step opts in.

## Files to touch

- `ui/admin/shell/EmptyState/EmptyState.tsx` (new) + `EmptyState.scss`
- `ui/admin/shell/EmptyState/illustrations/*.tsx` (new) — 14 SVG components, one per empty state (designed in Stitch, hand-converted)
- `ui/admin/features/<every list pane>/<Pane>.tsx` — wire EmptyState fallback
- `ui/admin/features/Onboarding/OnboardingWizard.tsx` (new — or extend existing if present) — 3-step wizard
- `ui/admin/features/Onboarding/OnboardingViewModel.ts` (new)
- `seeds/admin-onboarding.bundle.json` (new) — curated sample bundle
- `services/features/Onboarding/OnboardingService.ts` — extend with `seedOnboardingBundle()` (calls existing bundle-import path)
- `ui/admin/i18n/{en,lv,ru}.json` — empty-state copy + wizard copy
- Tests: smoke e2e for full first-run flow (fresh DB → wizard → sample content → all empty states cleared)

## Starter code

EmptyState component above is the spec.

Per-pane wiring:

```tsx
// ui/admin/features/Pages/Pages.tsx
const vm = useViewModel(() => new PagesViewModel());

if (!vm.loading && vm.pages.length === 0) {
    return (
        <EmptyState
            illustration={<EmptyPagesIllustration />}
            title={t('pages.empty.title')}
            description={t('pages.empty.description')}
            primary={{label: t('pages.empty.primary'), onClick: () => vm.createNew()}}
            secondary={{label: t('pages.empty.secondary'), onClick: () => router.push('/admin/release/bundle')}}
        />
    );
}
```

Wizard step:

```tsx
const wizardVm = useViewModel(() => new OnboardingViewModel());

// step 2 — seed
<label>
    <Checkbox checked={wizardVm.seedSample} onChange={wizardVm.toggleSeed} />
    {t('onboarding.seed.label')}
</label>
<p>{t('onboarding.seed.description')}</p>
```

## Acceptance

1. Every admin list pane renders a designed empty state when its data is empty (no blank tables anywhere)
2. Fresh DB boots into the wizard; completing it leaves the operator at `/admin` with sample content visible
3. "Skip setup" leaves the operator at `/admin` with all empty states visible + no sample content
4. Re-running `/admin/setup?force=1` works; doesn't wipe existing content
5. Wizard is mobile-responsive (375 px tested)
6. `prefers-reduced-motion` honoured on wizard transitions
7. Smoke e2e: fresh install → wizard → seed → assert sample page renders publicly + post + product visible in lists + Themes pane shows active editorial theme
8. Sample bundle import is idempotent (re-running doesn't duplicate)

## Effort

**M · ~2-3 hours AI** + design time for the 14 illustrations.

- EmptyState component + SCSS: ~30 min
- Per-pane wiring (mechanical, 14 surfaces): ~45 min
- Wizard 3-step flow + VM: ~1 hour
- Sample bundle curation: ~30 min (lift + trim from existing bundles)
- E2E: ~30 min
- Illustrations: **out of AI scope** — wall-clock cost only; design in Stitch, hand-convert to SVG. ~15 min per illustration, ~14 illustrations. Not in the AI budget for this item.

## Dependencies

- Existing `Onboarding` feature + `siteFlags` machinery (already shipped)
- Empty states for [first-class-themes](../storefront/first-class-themes.md) preset gallery — fold into this item rather than duplicating

## Open questions

- **[OPERATOR DECISION]** Wizard step 1 — collect operator name + email + role for the audit trail? Or rely on the auth that already happened? Recommend: rely on auth, don't re-collect.

## Out of scope

- Customer-side empty states on the public site (separate item — folds into [first-class-themes](../storefront/first-class-themes.md))
- Onboarding for non-admin (customer) users — folds into [client-signup-and-anonymous-checkout](../storefront/client-signup-and-anonymous-checkout.md)
