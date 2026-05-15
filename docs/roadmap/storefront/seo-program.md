---
name: seo-program
description: Site-wide SEO discipline — robots.txt, dynamic sitemap (multi-locale, per-feature), OG / Twitter cards, canonical URLs, structured data via SchemaOrgInjector, redirect map for retired URLs, hreflang, indexability gating per environment.
research: see _meta/research-findings-2026-05-12.md §3 (used-car URL structure as a real SEO consumer) + §4 (per-theme cues including search-engine considerations).
---

# Site-wide SEO program

## Goal

Today's `Seo` feature is **admin-only meta editing** — operators can set `<title>` + `<meta name="description">` per page. That's the floor. The full SEO discipline needed for a public storefront with thousands of car listings + posts + product pages is missing:

- **robots.txt** generated per-site + per-environment (block staging entirely; selective indexing in prod)
- **Dynamic XML sitemap** at `/sitemap.xml` with per-locale + per-feature segmentation, gzipped, refreshed on publish events
- **OG / Twitter card images** auto-generated per page via [new-modules-catalogue.md](../_meta/new-modules-catalogue.md) `OgImageGenerator`
- **Canonical URL emission** on every page; multi-locale → hreflang alternates
- **Structured data via `SchemaOrgInjector`** — Product / LocalBusiness / Article / Event / FAQPage / BreadcrumbList per page type
- **Redirect map** for retired URLs (slug changes, sub-page moves, ss.com listings that disappeared upstream)
- **Indexability gating** — `noindex` on draft / staging / certain admin-adjacent pages; environment-aware
- **Meta editor pre-flight** — admin warnings on titles >60 chars, descriptions >155 chars, missing OG image, missing structured data type

## Why now

- ss.com cars (Wave 7) will pump thousands of dynamic URLs into the sitemap. Without dynamic sitemap generation, Google never discovers them.
- Per-listing meta titles + structured data (Vehicle schema) are the difference between ranking and not ranking on used-car searches.
- Magic-link signup + checkout flows MUST be `noindex` so they don't show up in SERPs.
- Storefront program needs SEO baked in; retrofitting after launch loses 3-6 months of organic discovery.

## Design

### robots.txt — per-environment, per-site

`/robots.txt` generated server-side:

```
# production:
User-agent: *
Allow: /
Disallow: /account/
Disallow: /checkout
Disallow: /admin/
Disallow: /api/
Disallow: /_next/

Sitemap: https://funisimo.pro/sitemap.xml

# staging / preview:
User-agent: *
Disallow: /

# explicit AI-bot opt-in / opt-out per operator preference
User-agent: GPTBot
Disallow: /
# (operator-configurable; default: block until operator decides)
```

Env detection via `process.env.SITE_ENV` (`'production' | 'staging' | 'preview' | 'development'`). Stage / preview always returns `Disallow: /`.

### Dynamic sitemap

`/sitemap.xml` is a **sitemap index** referencing per-feature sub-sitemaps:

```xml
<sitemapindex>
  <sitemap><loc>https://funisimo.pro/sitemap/pages.xml</loc><lastmod>...</lastmod></sitemap>
  <sitemap><loc>https://funisimo.pro/sitemap/posts.xml</loc><lastmod>...</lastmod></sitemap>
  <sitemap><loc>https://funisimo.pro/sitemap/products.xml</loc><lastmod>...</lastmod></sitemap>
  <sitemap><loc>https://funisimo.pro/sitemap/cars.xml</loc><lastmod>...</lastmod></sitemap>
</sitemapindex>
```

Each sub-sitemap is cached + invalidated on publish events via existing `cacheVersionKeys` infrastructure. Multi-locale: each entry carries `<xhtml:link rel="alternate" hreflang="lv|en|ru">` tags.

Implementation: `services/features/Seo/sitemapGenerator.ts` — collects URLs from feature loaders that declare a `sitemapContributor()` method:

```ts
// Each feature loader can opt in.
interface SitemapContributor {
    sitemapContributor?(ctx: FeatureContext): Promise<SitemapEntry[]>;
}

interface SitemapEntry {
    url: string;
    lastmod: string;
    changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number;             // 0.0 - 1.0
    alternates?: {hreflang: string; href: string}[];
    images?: {url: string; title?: string; caption?: string}[];
}
```

Generic feature loaders that already know their public routes (Navigation / Posts / Products) auto-emit entries. ss.com Inventory adapter contributes via its product list.

Cap per sub-sitemap: 50,000 URLs (Google limit); larger sets split into `cars-1.xml`, `cars-2.xml`, etc.

### OG / Twitter card images

Per [new-modules-catalogue.md](../_meta/new-modules-catalogue.md) §`OgImageGenerator`:

- Server-side image generation via `@vercel/og` or `satori` (no Node-canvas dep needed)
- Cached per `(pageId, theme, version)` tuple; regenerated on theme change or content version bump
- Per-type templates: Car listing template / Product template / Post template / Generic page template
- `<meta property="og:image">` + `<meta name="twitter:image">` + `<meta property="og:image:width|height">` always emitted

Routes: `/og/<pageId>.png` served from `services/features/Seo/ogImageHandler.ts`. Static cache with `Cache-Control: public, max-age=31536000, immutable` once generated; cache-busted by version suffix in the URL.

### Canonical + hreflang

Every page emits:

```html
<link rel="canonical" href="https://funisimo.pro/<path>" />
<link rel="alternate" hreflang="lv" href="https://funisimo.pro/lv/<path>" />
<link rel="alternate" hreflang="en" href="https://funisimo.pro/en/<path>" />
<link rel="alternate" hreflang="ru" href="https://funisimo.pro/ru/<path>" />
<link rel="alternate" hreflang="x-default" href="https://funisimo.pro/<path>" />
```

Implementation: `services/features/Seo/canonicalResolver.ts` walks the active language registry + builds the alternate set per request. Cached.

### Structured data — `SchemaOrgInjector`

Per [new-modules-catalogue.md](../_meta/new-modules-catalogue.md) §`SchemaOrgInjector` cross-theme module. Emits JSON-LD in `<head>`:

| Page type | Schema |
|---|---|
| Home / generic page | `Organization` + `WebSite` (with `SearchAction`) |
| Page with breadcrumbs | + `BreadcrumbList` |
| Blog post | `Article` (Article subtype where appropriate) |
| Product page | `Product` + `Offer` + `AggregateRating` (if reviews shipped) |
| Car listing page | `Vehicle` + `Offer` + seller metadata |
| Local-business / restaurant page | `LocalBusiness` (or subtype `Restaurant`) + `OpeningHoursSpecification` + `GeoCoordinates` |
| Event page | `Event` + `Place` + `Offer` for tickets |
| FAQ module | `FAQPage` |
| Search results page | `noindex` (no schema) |

Each feature loader declares which schema types its routes emit; the injector composes from `useSchemaOrg()` hook into the page `<head>`.

### Redirect map

When a slug changes (operator edits `Pages.slug`), the old slug writes to `Redirects` collection with `from`, `to`, `code` (301), `createdAt`, `expiresAt?`. The Next middleware checks `Redirects` before the route handler runs:

```ts
// middleware.ts
if (req.nextUrl.pathname matches a redirect.from) {
    return NextResponse.redirect(redirect.to, redirect.code);
}
```

Operator pane at `/admin/system/redirects` for manual entries (e.g. retired campaigns, restructure migrations). Audit-tracked.

ss.com listings that disappear upstream → optional redirect to a "this car is no longer available" template page or to `/cars` index with a flash message. Per-product `redirectOnUnavailable` flag.

### Indexability gating

Per-page `seo.indexable: boolean` (default true). Auto-set false on:

- Draft content (`page.publishedAt` is null)
- `staging` / `preview` env regardless of page state
- Customer account routes (`/account/*`, `/checkout`, `/orders/*` token routes)
- Admin routes (`/admin/*`)
- Search result pages with filters (canonicalised to base list)
- ss.com listings flagged `private` or `vat_regime: 'unknown'` until reviewed

Emits `<meta name="robots" content="noindex,nofollow" />` when not indexable.

### Meta editor pre-flight

`/admin/{pages,posts,products}/[id]/seo` (extension of existing Seo pane) shows live warnings:

- Title length: green ≤ 60, amber 60-70, red > 70
- Description length: green ≤ 155, amber 155-175, red > 175
- Missing OG image (when override allowed)
- Title duplication detection (other pages with same title across this site)
- Missing structured-data type for the page kind
- Suspicious keyword stuffing (>30% keyword density triggers warning)
- Pre-flight SERP preview (Google + Twitter card visual mockup)

### Reporting

`/admin/system/seo` (new) — site-wide SEO health:

- Sitemap status (last generated, URL count, errors)
- Indexed-by-Google counter (Google Search Console API integration; v1: manual paste)
- Per-page indexability flag overview
- Redirect map summary
- Top issues (missing meta, duplicate titles, broken canonicals)

Per-page deep-dive shows the full emitted SEO surface (title / desc / canonical / hreflang / OG / schema) as the bot sees it.

## Files to touch

- `services/features/Seo/SeoService.ts` (extend existing) — add `getEffectiveSeo()` resolver composing per-page + per-site + per-environment
- `services/features/Seo/sitemapGenerator.ts` (new)
- `services/features/Seo/sitemapContributors.ts` (new) — registers per-feature contributors
- `services/features/Seo/canonicalResolver.ts` (new)
- `services/features/Seo/ogImageHandler.ts` (new) — `@vercel/og` integration
- `services/features/Seo/redirects.ts` (new) — middleware support
- `services/features/Seo/structuredData.ts` (new) — `useSchemaOrg()` + injector
- `shared/types/IRedirect.ts` (new)
- `shared/types/ISeoOverride.ts` — extend with `indexable`, `ogImageOverride?`, `structuredDataTypes[]`
- `ui/client/pages/sitemap.xml.ts` (new — `getServerSideProps`)
- `ui/client/pages/sitemap/[feature].xml.ts` (new — per-feature sub-sitemap)
- `ui/client/pages/robots.txt.ts` (new)
- `ui/client/pages/og/[id].png.ts` (new — OG image handler)
- `ui/client/components/SeoHead.tsx` (new — meta + canonical + hreflang + JSON-LD in one)
- Every public page wraps content with `<SeoHead />`
- `ui/client/middleware.ts` (new — redirect handling)
- `ui/admin/features/Seo/SeoEditor.tsx` (extend with pre-flight warnings + SERP preview)
- `ui/admin/features/SeoOverview/SeoOverview.tsx` (new — site-wide pane)
- `ui/admin/features/SeoOverview/SeoOverviewAdminUILoader.ts` (new)
- `ui/admin/features/Redirects/Redirects.tsx` (new)
- `services/features/Mcp/tools/seo.ts` (new — `seo_sitemap_regenerate`, `seo_redirect_upsert`, `seo_setIndexable`, `seo_runAudit`)
- Tests: sitemap structure validation, canonical resolver per locale, redirect middleware, indexability gating, OG image caching

## Starter code

Sitemap contributor pattern:

```ts
// services/features/Posts/PostsServiceLoader.ts (extend)
export class PostsServiceLoader extends ServiceLoader implements SitemapContributor {
    // …existing fields

    async sitemapContributor(ctx: FeatureContext): Promise<SitemapEntry[]> {
        const posts = await ctx.db.collection('Posts').find({draft: false, publishedAt: {$ne: null}}).toArray();
        const langs = await ctx.services.i18n.listLanguages();
        return posts.map((p) => ({
            url: `${ctx.siteUrl}/blog/${p.slug}`,
            lastmod: p.updatedAt,
            changefreq: 'monthly',
            priority: 0.6,
            alternates: langs.map((lang) => ({
                hreflang: lang.code,
                href: `${ctx.siteUrl}/${lang.code}/blog/${p.slug}`,
            })),
            images: p.coverImage ? [{url: p.coverImage, title: p.title}] : undefined,
        }));
    }
}
```

`<SeoHead />` integration:

```tsx
// ui/client/components/SeoHead.tsx
import Head from 'next/head';

interface SeoHeadProps {
    title: string;
    description: string;
    canonicalPath: string;
    indexable?: boolean;
    ogImage?: string;
    schemaOrg?: object | object[];
    alternates: {hreflang: string; href: string}[];
}

export function SeoHead({title, description, canonicalPath, indexable = true, ogImage, schemaOrg, alternates}: SeoHeadProps) {
    return (
        <Head>
            <title>{title}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={canonicalPath} />
            {!indexable && <meta name="robots" content="noindex,nofollow" />}
            {alternates.map((a) => (
                <link key={a.hreflang} rel="alternate" hrefLang={a.hreflang} href={a.href} />
            ))}
            {ogImage && (
                <>
                    <meta property="og:title" content={title} />
                    <meta property="og:description" content={description} />
                    <meta property="og:image" content={ogImage} />
                    <meta name="twitter:card" content="summary_large_image" />
                </>
            )}
            {schemaOrg && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{__html: JSON.stringify(schemaOrg)}}
                />
            )}
        </Head>
    );
}
```

## Acceptance

1. `/robots.txt` returns env-appropriate content; staging/preview entirely disallowed
2. `/sitemap.xml` is a valid sitemap index; sub-sitemaps validate against Google Sitemap Protocol
3. Each feature contributing to sitemaps does so via `sitemapContributor()`; codegen picks up new contributors automatically
4. Per-page canonical + hreflang alternates emit correctly across the language set
5. OG images generated server-side, cached, served at `/og/<pageId>.png`
6. Structured data JSON-LD valid per Google Rich Results Test (manual + axe-core URL crawl)
7. Slug change writes a 301 redirect entry; old URL serves redirect
8. ss.com listings retired upstream redirect or 410 per the per-product flag
9. Indexability auto-gates draft / customer / admin / preview routes
10. Meta editor pre-flight warnings fire for length / duplicates / missing fields
11. Sitewide SEO dashboard surfaces last generation + URL counts + top issues
12. MCP coverage: `seo_*` tools for sitemap regen + redirect mgmt + audit run

## Effort

**L · ~6-8h AI.**

- Sitemap generator + contributor pattern + sub-sitemap routing: ~2h
- robots.txt + canonical + hreflang: ~1h
- OG image handler + per-type templates: ~1.5h
- Redirect middleware + admin pane: ~1h
- Indexability gating + meta editor pre-flight: ~1h
- Site-wide SEO dashboard: ~1h
- MCP tools + tests: ~30 min

## Dependencies

- [new-modules-catalogue.md](../_meta/new-modules-catalogue.md) — `SchemaOrgInjector` + `OgImageGenerator` modules are the building blocks
- Existing `Seo` feature (per-page meta editing)
- Existing `cacheVersionKeys` infrastructure for sitemap invalidation
- Existing language registry
- [first-class-themes.md](first-class-themes.md) — OG image templates branded per theme

## Open questions

- **[OPERATOR DECISION]** AI bot policy — block GPTBot / ClaudeBot / Google-Extended by default, or allow? Recommend: block by default; operator opts in per-bot if they want to be in training data.
- **[OPERATOR DECISION]** OG image generation library — `@vercel/og` (built on satori, lightweight, fewer dependencies) vs full Puppeteer / Playwright headless (richer rendering, heavier). Recommend: `@vercel/og`.
- **[OPERATOR DECISION]** Sitemap refresh strategy — eager (regen on every publish event) vs lazy (cron every 1h). Recommend: eager with rate-limit (max one regen per 60s).
- **[OPERATOR DECISION]** Google Search Console integration for indexed-counter — manual paste v1 vs API integration. Recommend: manual paste v1; API integration when there's >5 sites to monitor.

## Out of scope

- Marketing-grade keyword research / content-gap analysis tooling — third-party (Ahrefs / SEMrush)
- Backlink monitoring — third-party
- Page-speed SEO impact — covered by [performance-budget-ci](../platform/performance-budget-ci.md)
- A/B testing of meta titles for CTR optimisation — separate item
- Multi-domain / multi-language SEO consolidation strategies (subdomain vs subfolder vs ccTLD) — operator decision per-site, no platform code
- Indexable AI/search-engine markup beyond schema.org (e.g. llms.txt convention) — file as backlog when convention stabilises
