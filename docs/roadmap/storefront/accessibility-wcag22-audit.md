---
name: accessibility-wcag22-audit
description: Pre-public-deploy WCAG 2.2 AA audit + remediation across every public-facing surface. EU EAA legally required from 2025; US ADA Title II deadline April 2026.
research: see research-findings-2026-05-12.md §4 Accessibility minimums
status: pre-deploy-blocker
---

# WCAG 2.2 AA audit + remediation

## Goal

Bring every public-facing surface to **WCAG 2.2 AA compliance** before any public-internet deploy. This is **legally required** in the EU under the European Accessibility Act (EAA) / EN 301 549 from 2025, and in the US under ADA Title II from April 2026.

Scope:

- All public client routes (`/`, `/pages/*`, `/blog/*`, `/products/*`, `/cars/*`, `/checkout`, `/account/*`)
- All first-class themes (each must pass independently in both light and dark)
- Email templates (limited WCAG 2.2 applicability; aim for 2.1 AA contrast + alt text)
- Admin surfaces — **not** in scope for v1 (admin is staff-only; compliance is courtesy not legal requirement)

## Why now

- This is a **pre-public-deploy blocker.** No public marketing site, no real-customer signup, no ss.com cars launch without it.
- Per [project_local_poc_scope](../../C:/Users/User/.claude/projects/D--Work-redis-node-js-cloud/memory/project_local_poc_scope.md), GDPR/consent work was deferred — accessibility is the sibling item that also gates public launch.
- Easier to bake in during the storefront program than to retrofit later. Every first-class theme + new customer surface should ship audit-passing.
- WCAG 3 is still draft (Recommendation projected 2028-2030) — don't gate on it, but the patterns we adopt now (semantic HTML, ARIA properly used, motion-reduction tokens) carry forward.

## Design

### Audit checklist — per public surface

For every page / theme / mode combination, verify:

1. **Color contrast 4.5:1 on text** (3:1 for large text ≥18 pt or ≥14 pt bold) — run APCA preview tool
2. **Visible 2 px focus ring** on every interactive element, both modes
3. **Keyboard navigation** — every interactive element reachable via Tab, activatable via Enter/Space
4. **Skip link** — "Skip to main content" present on every page
5. **Heading hierarchy** — `<h1>` once per page, nested logically (no `<h4>` directly after `<h2>`)
6. **Alt text on every image** — descriptive when content-bearing, empty `alt=""` when decorative
7. **Form labels** — every input has an associated `<label>` (not placeholder-only)
8. **Error messages** — programmatically associated with inputs via `aria-describedby`
9. **Touch targets 44×44 px minimum** on mobile viewports
10. **Motion gated on `prefers-reduced-motion`** via the `--motion-scalar` token (per [motion-token-system](../admin/motion-token-system.md))
11. **No information by color alone** — add icon / label / pattern
12. **Lang attribute** on `<html>` correctly set per active language
13. **Page titles** descriptive + unique
14. **Landmarks** — `<main>`, `<nav>`, `<header>`, `<footer>` semantically marked
15. **Live regions** for dynamic content (toast, filter result count change)

### Tooling

Automated checks (in priority order):

- **axe-core** (Deque) — integrate into e2e suite. Run per route, fail build on serious/critical violations.
- **Pa11y** — CLI runner for batch URL crawl + CI gate
- **Lighthouse accessibility audit** — final pass before deploy; aim for score ≥95
- **APCA contrast tool** (manual or browser extension) — for nuanced text-on-color cases axe misses

Manual checks:

- **NVDA / VoiceOver / TalkBack** screen reader spot-checks on the 5 highest-traffic routes per theme
- **Keyboard-only navigation** end-to-end test (no mouse) through signup → cars browse → reservation → account
- **Zoom to 200%** — content still readable + functional
- **Forced-colors mode** (Windows High Contrast) — no broken styling

### Per-theme verification

Each first-class theme runs its own audit pass. **Theme doesn't ship until its audit passes** — gate added to the theme's acceptance criteria.

Theme-specific gotchas to check:

- **`agency`** + **`saas-landing`** (dark default) — verify light mode contrast doesn't slip
- **`editorial`** — large display type may be below 4.5:1; verify
- **`commerce`** + **`restaurant`** — product / dish image overlays often fail contrast on the overlay text
- **`event`** — countdown timer animation must respect reduced-motion

### Existing-code remediation

The current public surfaces (CV bundle, Skyclimber bundle) probably have ~30-50 violations. Categorise the audit output:

- **Critical / Serious axe violations** — fix before deploy (blocker)
- **Moderate violations** — fix opportunistically (not blocker)
- **Minor violations** — file as follow-up roadmap items

Don't open-ended audit; time-box per surface (1 hour per route, 1 day per theme).

### Continuous gating

Once initial audit passes, add to CI:

- **axe-core in e2e** — every PR fails on new serious/critical violations
- **Lighthouse a11y score ≥90** — non-blocking warning if drops; blocking if drops below 80
- **Theme audit** in `tools/scripts/audit-themes.mjs` — runs axe against every route × every theme × both modes weekly via scheduled GitHub Action

### Documentation

- Per-theme: `ui/client/themes/<slug>/ACCESSIBILITY.md` — what the audit checked, known limitations, last verified date
- Project-level: `docs/accessibility.md` (new) — overall conformance statement, contact for accessibility issues, link to audit reports

## Files to touch

- `tests/e2e/accessibility/<route>.spec.ts` (new — one spec per critical route × theme combo)
- `tools/scripts/audit-themes.mjs` (new) — batch theme runner
- `package.json` — add `@axe-core/playwright`, `pa11y`, `pa11y-ci`
- `.github/workflows/accessibility-audit.yml` (new) — weekly scheduled run + PR check
- Every public component with violations — remediate (touched per the audit)
- `ui/client/components/SkipLink.tsx` (new) — "Skip to main content"
- `ui/client/lib/focusRing.scss` (new) — shared focus ring tokens + visible-focus utility
- `docs/accessibility.md` (new) — conformance statement
- Per-theme: `ui/client/themes/<slug>/ACCESSIBILITY.md` (one per theme)

## Starter code

axe-core in Playwright:

```ts
// tests/e2e/accessibility/_axeRunner.ts
import {AxeBuilder} from '@axe-core/playwright';
import type {Page} from '@playwright/test';

export async function axeAudit(page: Page, theme: string, mode: 'light' | 'dark') {
    await page.evaluate(({theme, mode}) => {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-mode', mode);
    }, {theme, mode});

    const results = await new AxeBuilder({page})
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();

    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious, `${theme}/${mode}: serious axe violations`).toEqual([]);
}
```

Skip link:

```tsx
// ui/client/components/SkipLink.tsx
export function SkipLink() {
    return (
        <a href="#main" className="skip-link" data-testid="skip-link">
            Skip to main content
        </a>
    );
}
```

```scss
.skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    padding: 0.5rem 1rem;
    background: var(--color-accent);
    color: var(--color-on-accent);
    text-decoration: none;
    border-radius: 0 0 4px 0;
    z-index: 999;

    &:focus {
        top: 0;
    }
}
```

## Acceptance

1. axe-core runs against every public route × every shipped theme × both modes; zero critical or serious violations
2. Lighthouse accessibility score ≥95 on the 5 highest-traffic routes
3. Manual NVDA + VoiceOver screen-reader spot-check passes on signup, checkout, cars browse, reservation, account
4. Keyboard-only end-to-end smoke succeeds (signup → reserve a car → upgrade to customer → view in account, no mouse)
5. Skip link present on every public page
6. Every first-class theme ships an `ACCESSIBILITY.md` with last-verified date
7. Weekly scheduled audit runs in CI; failures notify operator
8. `docs/accessibility.md` published with conformance statement + contact email

## Effort

**L · ~1-2 weeks AI** (depending on existing violation count).

- Audit tooling + integration: ~1 day
- Initial audit pass against current code: ~half day
- Remediation of serious/critical violations: ~3-5 days (depends on count)
- Per-theme audit gate: ~1 day after first-class themes land
- CI gates + scheduled audit: ~half day
- Documentation: ~half day

## Dependencies

- [Q4-cap visual baselines](../README.md) — paired (axe runs in same e2e harness)
- [motion-token-system](../admin/motion-token-system.md) — `--motion-scalar` token gates motion
- [first-class-themes](first-class-themes.md) — themes individually gated
- Public-internet deploy — this is the gating item

## Open questions

- **[OPERATOR DECISION]** Lighthouse target — 95 (aspirational, allows minor drops) or 100 (strict)? Recommend 95.
- **[OPERATOR DECISION]** Pa11y vs axe-core for the primary CI gate — keep both or pick one? Recommend: axe-core for CI (better Playwright integration), Pa11y for batch crawls in scheduled runs.

## Out of scope

- WCAG 3 conformance (still draft; revisit when recommended)
- WCAG 2.2 AAA (overshoot for v1; specific surfaces can target AAA if operator decides)
- Admin accessibility (staff tool; nice-to-have but not legally gating). File as separate item if operator wants it.
- Multi-language accessibility checks (Russian / Latvian screen reader testing) — beyond v1; defer to native-speaker testing pre-launch
