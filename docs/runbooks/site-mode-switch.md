# Runbook: switching site layout mode (tabs ↔ scroll)

Site layout mode is a per-site flag (`siteFlags.layoutMode`) that decides whether
the public site renders as **classic tabs** (each page its own URL, F1 sub-pages
apply) or **single-page scroll** (all pages stacked on `/`, nav uses `#anchor`
links). `'auto'` resolves to `'tabs'` — the safe default for F1 sites.

Spec: `docs/roadmap/platform/site-mode-toggle.md`. Implementation: `services/features/Seo/SiteFlagsService.ts` (`resolveLayoutMode`).

## When to switch

- **`scroll` → `tabs`**: site grew past a single narrative; you want distinct
  per-page URLs, sub-pages, and per-page SEO surfaces.
- **`tabs` → `scroll`**: legacy scroll-era bundle (e.g. skyclimber.pro authored
  with `#sakums`, `#pakalpojumi` footer entries) — preserves authoring intent
  without patching the bundle.

## Pre-switch checklist

1. **Audit external links.** Switching mode rewrites every public URL shape.
   - `tabs`: `/en/services`, `/en/services/cleaning` (N canonical URLs).
   - `scroll`: `/` only (one canonical, anchors are `#services`).
   - Any inbound backlink / ad campaign / printed QR pointing at `/services`
     will land on the wrong shape — set up redirects before flipping.
2. **Sitemap impact.** Mode flip = sitemap shape changes (N URLs collapse to 1
   in scroll, or 1 expands to N in tabs). Search engines will re-crawl; expect
   transient ranking churn for ~7–14 days. If the site is brand-new, no impact.
3. **Sub-page hierarchy.** In `scroll` mode sub-pages flatten into top-level
   sections. If the operator has a deep tree (`/services/cleaning/regular`),
   scroll mode loses the hierarchy. Document the loss in the operator handoff.
4. **Footer URL audit.** `SiteFooter` rewrites page-shaped URLs (e.g.
   `/about`) to `#about` in scroll mode automatically, but only when the
   first segment matches a known page name. URLs that don't resolve to a
   page (blog links, downloads) pass through. Confirm no broken footer
   links after the switch.

## How to switch

### Via admin UI

1. Open `/admin/settings/layout` (or whichever route mounts `AdminSettingsLayout`).
2. Pick **Tabs**, **Single-page scroll**, or **Auto**. Save is one-click —
   `LayoutViewModel.setMode` posts the change with optimistic concurrency.
3. Trigger a publish snapshot (`site.publish` or the admin publish button) so
   the storefront picks up the flag on the next ISR pass.

### Via MCP

```
site.setLayoutMode { mode: 'scroll' }   # or 'tabs' / 'auto'
site.publish
site.revalidate { scope: 'all' }
```

## Post-switch checklist

1. **Cache bust.** Run `site.revalidate { scope: 'all' }` so every ISR-cached
   page re-renders against the new mode. Without this, visitors who hit a
   warm-cache route see the previous mode's HTML until the next revalidate
   window (1 h default).
2. **Sitemap regen.** Trigger `next-sitemap` (or whatever your build pipeline
   uses); the URL set has changed. In scroll mode the sitemap should contain
   only `/` per locale.
3. **Smoke test.**
   - Hash anchors scroll into view (`/#about`, `/#services`).
   - Footer entries render with the right href shape (`#anchor` in scroll,
     `/path` in tabs).
   - Deep page paths in scroll mode (`/about`) hard-redirect to `/#about`
     via the `[...slug].tsx` effect.
   - Mobile nav (MobileNav) follows the same hash shape.
4. **SEO surface check.** In scroll mode there's a single canonical URL —
   per-page `seo.description` / `seo.keywords` no longer reach the browser
   as standalone tags. If per-page SEO matters, stay on tabs.

## Rollback

Same procedure in reverse. The flag is one field on `SiteSettings.siteFlags`
— no migration, no data loss. External links broken by the previous switch
need their redirects updated again.

## Risks

- **Live-traffic flip.** Every visitor in flight sees the new render on their
  next navigation. Avoid switching during peak traffic on commerce sites.
- **External backlinks.** Search engines, social cards, ad campaigns, and
  user bookmarks all point at the old URL shape. Plan a redirect map before
  flipping a production site.
- **Per-page analytics.** Pageview counts collapse to a single URL in scroll
  mode. Configure GA4 / Plausible to track section-scroll events if per-section
  attribution matters.
