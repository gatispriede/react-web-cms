/**
 * SeoOverviewApi — admin client for the W8h SEO overview pane.
 *
 * Hits the dedicated `/api/admin/seo-overview` endpoint which aggregates
 * preflight + redirect-count + sitemap counts + OG-coverage in one
 * round-trip. Keeps the VM lean (one fetch per refresh).
 */
export interface SeoPreflightWarning {
    page: string;
    severity: 'warn' | 'error';
    field: string;
    message: string;
}

export interface SeoOverviewSummary {
    preflight: {
        pageCount: number;
        warningCount: number;
        warnings: SeoPreflightWarning[];
    };
    redirectCount: number;
    sitemapCounts: {
        pages: number;
        posts: number;
        products: number;
    };
    ogCoverage: {
        covered: number;
        total: number;
        pct: number;
    };
    generatedAt: string;
}

export class SeoOverviewApi {
    async fetch(): Promise<SeoOverviewSummary> {
        const r = await fetch('/api/admin/seo-overview', {credentials: 'same-origin'});
        if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            throw new Error(body.error ?? `seo-overview failed: ${r.status}`);
        }
        return r.json();
    }
}

export default SeoOverviewApi;
