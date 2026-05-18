/**
 * Sitemap contributor registry — W8h SEO program § dynamic sitemap.
 *
 * Each feature that owns public URLs registers a contributor here. The
 * sitemap API handler (`ui/client/pages/api/sitemap.xml.ts`) walks the
 * registry and stitches the entries together.
 *
 * Today's contributors:
 *   - `pages`   — Navigation rows (full slug chain, per-locale hreflang)
 *   - `posts`   — Published blog posts (`/blog/<slug>`)
 *   - `products` — Public product pages (`/products/<slug>`)
 *
 * Adding a new feature: import + call `registerSitemapContributor` at
 * module-load time (e.g. from the feature's manifest boot path). Each
 * contributor receives the resolved origin + locale set and returns a
 * flat `SitemapEntry[]`. The aggregator handles deduplication of
 * duplicate `loc` values and the 50k-per-file Google cap.
 */
import type {
    SitemapContributor,
    SitemapContributorContext,
    SitemapContributorRegistration,
    SitemapEntry,
} from '@interfaces/Seo/ISitemapContributor';

const REGISTERED: SitemapContributorRegistration[] = [];

export function registerSitemapContributor(reg: SitemapContributorRegistration): void {
    // Idempotent re-registration — Next.js hot-reload can re-evaluate
    // module top-level code in dev; we don't want duplicate entries.
    const idx = REGISTERED.findIndex((r) => r.feature === reg.feature);
    if (idx >= 0) REGISTERED[idx] = reg;
    else REGISTERED.push(reg);
}

export function listSitemapContributors(): readonly SitemapContributorRegistration[] {
    return REGISTERED;
}

/** Test seam — clear the registry between specs. */
export function _resetSitemapContributors(): void {
    REGISTERED.length = 0;
}

/**
 * Run every registered contributor and return the merged entry list,
 * de-duplicated by `loc`. Order: contributors run sequentially in
 * registration order; per-contributor entries preserve input order.
 *
 * Failure mode: a contributor that throws is logged once via `onError`
 * (if supplied) and its entries are skipped. We never let one feature
 * break the whole sitemap — sitemap.xml is high-traffic and a single
 * broken adapter shouldn't 500 the route.
 */
export async function collectSitemapEntries(
    ctx: SitemapContributorContext,
    onError?: (feature: string, err: unknown) => void,
): Promise<SitemapEntry[]> {
    const seen = new Set<string>();
    const out: SitemapEntry[] = [];
    for (const reg of REGISTERED) {
        let entries: SitemapEntry[] = [];
        try {
            entries = await reg.contributor(ctx);
        } catch (err) {
            if (onError) onError(reg.feature, err);
            continue;
        }
        for (const e of entries) {
            if (!e?.loc || seen.has(e.loc)) continue;
            seen.add(e.loc);
            out.push(e);
        }
    }
    return out;
}

export type {SitemapContributor, SitemapContributorContext, SitemapEntry};
