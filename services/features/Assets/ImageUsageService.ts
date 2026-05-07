/**
 * ImageUsageService — scans every place an image filename can appear and
 * returns a usage map keyed by image name.
 *
 * Why a service: the same logic is needed by
 *   - the MCP `image.list` tool (with `includeUsage:true`)
 *   - the admin "show unused" filter in the image manager
 *   - any future cleanup script
 * — and it's the only authoritative answer because content shape is
 * spread across 6+ collections (Pages, Sections, Posts, Logo, Footer,
 * SiteSeo, Themes). Keeping the regex in one place beats reinventing it
 * per consumer.
 *
 * Detection strategy: stringify each scanned doc, then run a permissive
 * regex matching `(api/|images/|/images/)<basename>` plus a separate
 * pass for known bare-filename fields (`coverImage`, `image`,
 * `defaultImage`, `src`). Each match's basename is intersected with the
 * authoritative inventory from `getImages('')` — anything not in the
 * inventory is dropped (avoids false positives from arbitrary filename-
 * looking strings).
 */

import {IImage} from '@interfaces/IImage';

export interface ImageUsageRef {
    /** Where the reference lives: `page:Home`, `section:cv-sec-home-hero`, `post:cms`, `logo`, `footer`, `siteSeo:defaultImage`, `theme:Industrial`. */
    location: string;
    /** Optional sub-field hint within the doc (e.g. `coverImage`, `seo.image`, `content.HERO.portraitImage`). */
    field?: string;
}

export interface ImageUsageEntry {
    name: string;
    /** Number of distinct (location, field) references. Same image used twice on one page → 2. */
    count: number;
    refs: ImageUsageRef[];
}

export interface UsageScannerSources {
    /** Inventory of known image filenames — anything outside this set is ignored to avoid false positives. */
    images: Pick<IImage, 'name'>[];
    /** Pages with `seo.image` and `page` (display name). */
    pages?: Array<{page?: string; seo?: {image?: string} | null} & Record<string, unknown>>;
    /** Sections — entire doc is stringified. `id` (or `_id`) used for the location. */
    sections?: Array<{id?: string; _id?: unknown} & Record<string, unknown>>;
    /** Posts — `coverImage` + `body` HTML scanned. */
    posts?: Array<{slug?: string; coverImage?: string; body?: string} & Record<string, unknown>>;
    /** Logo doc — `content` is a JSON string with `{src}`. */
    logo?: {content?: string} | null;
    /** Footer config — `bottom` may be HTML; columns may have icons. */
    footer?: Record<string, unknown> | null;
    /** SiteSeo doc with `defaultImage`. */
    siteSeo?: {defaultImage?: string} & Record<string, unknown> | null;
    /** Themes — `tokens` may include image URLs (e.g. background patterns). */
    themes?: Array<{name?: string; tokens?: unknown}> | null;
}

const IMG_PREFIX_RE = /(?:\bapi\/|\bimages\/|\/images\/)([A-Za-z0-9._\- ()]+\.(?:jpg|jpeg|png|webp|gif|svg|avif|bmp|JPG|JPEG|PNG))/g;
const BARE_FIELD_RE = /"(?:coverImage|image|defaultImage|src|background|bg|portraitImage|bgImage|logo)"\s*:\s*(?:"([^"\\]+\.(?:jpg|jpeg|png|webp|gif|svg|avif|bmp))"|\{\s*"src"\s*:\s*"([^"\\]+\.(?:jpg|jpeg|png|webp|gif|svg|avif|bmp))")/g;

function basename(p: string): string {
    const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
    return i >= 0 ? p.slice(i + 1) : p;
}

function* extractImageRefs(blob: string): Generator<string> {
    IMG_PREFIX_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IMG_PREFIX_RE.exec(blob)) !== null) yield m[1];
    BARE_FIELD_RE.lastIndex = 0;
    while ((m = BARE_FIELD_RE.exec(blob)) !== null) yield basename(m[1] ?? m[2] ?? '');
}

/**
 * Run the scan against in-memory snapshots of the relevant collections.
 * Pure function — no IO. Caller is responsible for fetching.
 *
 * Returns one entry per inventory image (so callers can render
 * `usageCount=0` rows alongside used ones in a single sweep).
 */
export function scanImageUsage(sources: UsageScannerSources): Map<string, ImageUsageEntry> {
    const known = new Set<string>();
    const out = new Map<string, ImageUsageEntry>();
    for (const img of sources.images ?? []) {
        if (!img?.name) continue;
        known.add(img.name);
        out.set(img.name, {name: img.name, count: 0, refs: []});
    }

    const record = (name: string, location: string, field?: string): void => {
        const bn = basename(name);
        if (!known.has(bn)) return;
        const entry = out.get(bn);
        if (!entry) return;
        entry.count++;
        entry.refs.push(field ? {location, field} : {location});
    };

    const scanBlob = (blob: string, location: string): void => {
        if (!blob) return;
        for (const name of extractImageRefs(blob)) record(name, location);
    };

    // Pages: SEO image is the structured field; the rest of the doc is
    // small enough to stringify-scan as a safety net.
    for (const page of sources.pages ?? []) {
        const loc = `page:${page.page ?? '<unnamed>'}`;
        const seoImage = page.seo?.image;
        if (typeof seoImage === 'string') record(seoImage, loc, 'seo.image');
        // belt-and-braces: scan the rest in case content moves around
        try { scanBlob(JSON.stringify(page), loc); } catch { /* circular — skip */ }
    }

    for (const section of sources.sections ?? []) {
        const id = section.id ?? String(section._id ?? '<unnamed>');
        try { scanBlob(JSON.stringify(section), `section:${id}`); } catch { /* skip */ }
    }

    for (const post of sources.posts ?? []) {
        const loc = `post:${post.slug ?? '<unslugged>'}`;
        if (typeof post.coverImage === 'string') record(post.coverImage, loc, 'coverImage');
        if (typeof post.body === 'string') scanBlob(post.body, loc);
    }

    if (sources.logo?.content) scanBlob(sources.logo.content, 'logo');
    if (sources.footer) {
        try { scanBlob(JSON.stringify(sources.footer), 'footer'); } catch { /* skip */ }
    }
    if (sources.siteSeo) {
        if (typeof sources.siteSeo.defaultImage === 'string') {
            record(sources.siteSeo.defaultImage, 'siteSeo', 'defaultImage');
        }
        try { scanBlob(JSON.stringify(sources.siteSeo), 'siteSeo'); } catch { /* skip */ }
    }
    for (const theme of sources.themes ?? []) {
        try { scanBlob(JSON.stringify(theme.tokens ?? theme), `theme:${theme.name ?? '<unnamed>'}`); } catch { /* skip */ }
    }

    return out;
}

/**
 * Convenience adapter — fetches every collection via the existing
 * connection surface and runs the scan. The MCP tool calls this; tests
 * call `scanImageUsage` with hand-rolled fixtures directly.
 */
export interface UsageConnection {
    getImages(args: {tags: string}): Promise<IImage[]>;
    getNavigationCollection(): Promise<unknown[]>;
    getSections(args: {ids: string[]}): Promise<unknown[]>;
    getPosts(args?: {includeDrafts?: boolean; limit?: number}): Promise<string>;
    getLogo(): Promise<{content?: string} | undefined>;
    getFooter(): Promise<string>;
    getSiteSeo(): Promise<string>;
    getThemes(): Promise<string>;
}

export async function loadUsageSources(conn: UsageConnection): Promise<UsageScannerSources> {
    const [images, pages, postsRaw, logo, footerRaw, siteSeoRaw, themesRaw] = await Promise.all([
        conn.getImages({tags: ''}),
        conn.getNavigationCollection() as Promise<Array<{sections?: string[]} & Record<string, unknown>>>,
        conn.getPosts({includeDrafts: true, limit: 1000}),
        conn.getLogo(),
        conn.getFooter(),
        conn.getSiteSeo(),
        conn.getThemes(),
    ]);
    const allSectionIds = pages.flatMap(p => Array.isArray(p.sections) ? p.sections as string[] : []);
    const sections = allSectionIds.length
        ? await conn.getSections({ids: allSectionIds}) as Array<Record<string, unknown>>
        : [];
    const safeJsonParse = <T>(s: string | null | undefined, fallback: T): T => {
        if (!s) return fallback;
        try { return JSON.parse(s) as T; } catch { return fallback; }
    };
    return {
        images,
        pages: pages as UsageScannerSources['pages'],
        sections: sections as UsageScannerSources['sections'],
        posts: safeJsonParse<UsageScannerSources['posts']>(postsRaw, []),
        logo: logo ?? null,
        footer: safeJsonParse<UsageScannerSources['footer']>(footerRaw, null),
        siteSeo: safeJsonParse<UsageScannerSources['siteSeo']>(siteSeoRaw, null),
        themes: safeJsonParse<UsageScannerSources['themes']>(themesRaw, []),
    };
}
