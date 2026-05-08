/**
 * PageSeoStatusService — per-page SEO completeness audit. Powers
 * `page.list { includeSeoStatus }` and the SEO sweep dashboard.
 *
 * Why a service: a "what's missing" rollup is needed for both an MCP
 * agent ("which pages have no og:image?") and the admin SEO tab. The
 * shape of `ISeo` is already stable, so the scanner is a pure projection.
 */

export interface PageSeoInput {
    page: string;
    seo?: {
        description?: string;
        image?: string;
        keywords?: string[];
        author?: string;
    } | null;
}

export interface PageSeoStatus {
    page: string;
    hasDescription: boolean;
    hasOgImage: boolean;
    hasKeywords: boolean;
    hasAuthor: boolean;
    /** Human-readable list of missing fields (lowercase, hyphenated). */
    missingFields: string[];
}

function nonEmptyStr(v: unknown): boolean {
    return typeof v === 'string' && v.trim().length > 0;
}

export function scanPageSeo(pages: readonly PageSeoInput[]): PageSeoStatus[] {
    return pages.map(p => {
        const seo = p.seo ?? null;
        const hasDescription = nonEmptyStr(seo?.description);
        const hasOgImage = nonEmptyStr(seo?.image);
        const hasKeywords = Array.isArray(seo?.keywords) && (seo!.keywords!.length > 0);
        const hasAuthor = nonEmptyStr(seo?.author);
        const missingFields: string[] = [];
        if (!hasDescription) missingFields.push('description');
        if (!hasOgImage) missingFields.push('og-image');
        if (!hasKeywords) missingFields.push('keywords');
        if (!hasAuthor) missingFields.push('author');
        return {
            page: p.page,
            hasDescription,
            hasOgImage,
            hasKeywords,
            hasAuthor,
            missingFields,
        };
    });
}

export interface PageSeoConnection {
    getNavigationCollection(): Promise<Array<{page: string; seo?: PageSeoInput['seo']}>>;
}

export async function loadPageSeoSources(conn: PageSeoConnection): Promise<PageSeoInput[]> {
    const pages = await conn.getNavigationCollection();
    return pages.map(p => ({page: p.page, seo: p.seo ?? null}));
}
