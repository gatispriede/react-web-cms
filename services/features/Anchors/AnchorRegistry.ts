import {slugifyAnchor} from '@utils/stringFunctions';

/**
 * AnchorRegistry — server-side equivalent of `ui/admin/lib/anchorRegistry.ts`.
 *
 * The client registry powers the admin's `<LinkTargetPicker>`. This
 * server-side variant powers two new MCP tools (`anchor.list`,
 * `anchor.search`) so AI agents authoring content via MCP can pick
 * real link targets instead of guessing — same canonical hrefs the
 * picker emits, same group structure.
 *
 * Both registries derive from the same Mongo collections (Navigation
 * + Sections); they're separate codepaths because the client builds
 * from already-loaded admin data while the server fetches fresh on
 * every MCP call. The two implementations must stay output-identical
 * — if you change the slug rule or anchor format, change both.
 *
 * Per Wave 1 architecture decision A (2026-05-07): this slice lives
 * under `services/features/Anchors/` not `services/anchors/`, mirroring
 * the `services/features/<Name>/` convention every other server-side
 * feature follows. Co-located test file at `AnchorRegistry.test.ts`.
 */

export interface IAnchorEntry {
    /** Canonical href the picker / agent emits into saved content. */
    href: string;
    /** Human-readable label. Page → sub-page chain joins with ` → `. */
    label: string;
    /** Group header — Pages / Sections / Module titles / Timeline entries. */
    group: 'Pages' | 'Sections' | 'Module titles' | 'Timeline entries';
}

export interface AnchorRegistryPage {
    page: string;
    id?: string;
    parent?: string;
    slug?: string;
}

export interface AnchorRegistrySection {
    id?: string;
    /** Section's column-track count — surfaced as a label hint
     *  ("100%", "50/50", etc.) so multi-section pages disambiguate. */
    type?: number;
    content?: Array<{type?: string; content?: string}>;
}

const widthLabel = (trackCount: number | undefined): string => {
    switch (trackCount) {
        case 1: return '100%';
        case 2: return '50/50';
        case 3: return '33/33/33';
        case 4: return '25×4';
        default: return trackCount ? `${trackCount}-track` : '';
    }
};

const moduleSummary = (s: AnchorRegistrySection): string => {
    const items = (s.content ?? []) as Array<{type?: string}>;
    if (!items.length) return '';
    const types = items.map(it => it?.type).filter(Boolean) as string[];
    if (!types.length) return '';
    const unique = Array.from(new Set(types));
    if (unique.length === 1) return unique[0];
    return `${unique.length} modules`;
};

/** Walk the parent chain root → self for sub-page slug composition. */
function chainFor(page: AnchorRegistryPage, all: AnchorRegistryPage[]): AnchorRegistryPage[] {
    const byKey = new Map<string, AnchorRegistryPage>();
    for (const p of all) byKey.set(p.id ?? p.page, p);
    const out: AnchorRegistryPage[] = [];
    const seen = new Set<string>();
    let cur: AnchorRegistryPage | undefined = page;
    while (cur) {
        const key = cur.id ?? cur.page;
        if (seen.has(key)) break;
        seen.add(key);
        out.unshift(cur);
        if (!cur.parent) break;
        cur = byKey.get(cur.parent);
    }
    return out;
}

const slugFor = (p: AnchorRegistryPage): string =>
    p.slug?.trim() || slugifyAnchor(p.page) || p.page;

/**
 * Pure-function builder. Caller assembles the inputs (typically from
 * `getNavigationCollection()` + `getSections()` adapter) and gets back
 * the deduplicated registry entries in render order.
 *
 * Optionally pass `siteMode` to control href shape:
 *   - 'tabs' / 'auto' / undefined → page hrefs are `/slug`, section
 *     hrefs are `/page/slug#section-id`. Default.
 *   - 'scroll' → every entry is hash-only (`#slug`) so the picker
 *     emits anchors that resolve inside the single scrolling page.
 */
export function buildAnchorRegistry(args: {
    pages: AnchorRegistryPage[];
    sectionsByPage: Record<string, AnchorRegistrySection[]>;
    siteMode?: 'tabs' | 'scroll' | 'auto';
}): IAnchorEntry[] {
    const out: IAnchorEntry[] = [];
    const seen = new Set<string>();
    const push = (entry: IAnchorEntry): void => {
        if (seen.has(entry.href)) return;
        seen.add(entry.href);
        out.push(entry);
    };

    const isScroll = args.siteMode === 'scroll';

    for (const p of args.pages) {
        const chain = chainFor(p, args.pages);
        const slugs = chain.map(slugFor);
        const pageSlug = slugs.join('/');
        const pageHref = isScroll ? `#${slugifyAnchor(p.page)}` : `/${pageSlug}`;
        const label = chain.length > 1
            ? chain.map(c => c.page).join(' → ')
            : p.page;
        push({href: pageHref, label, group: 'Pages'});

        const sections = args.sectionsByPage[p.page] ?? [];
        sections.forEach((s, idx) => {
            if (s.id) {
                const w = widthLabel(s.type);
                const summary = moduleSummary(s);
                const parts = [p.page, w, summary || `section ${idx + 1}`].filter(Boolean);
                // Section hrefs are always hash-anchored — they live inside
                // a page's body. Tabs mode prefixes the page slug so the
                // picker target is unambiguous; scroll mode is hash-only.
                const sectionHref = isScroll
                    ? `#${s.id}`
                    : `/${pageSlug}#${s.id}`;
                push({href: sectionHref, label: parts.join(' → '), group: 'Sections'});
            }
            const items = (s.content ?? []);
            for (const it of items) {
                if (typeof it?.content !== 'string') continue;
                let parsed: unknown;
                try { parsed = JSON.parse(it.content); } catch { continue; }
                const titles: string[] = [];
                const obj = parsed as Record<string, unknown>;
                if (typeof obj?.title === 'string') titles.push(obj.title);
                if (typeof obj?.sectionTitle === 'string') titles.push(obj.sectionTitle);
                const rows = Array.isArray(obj?.rows) ? (obj.rows as Array<{title?: unknown}>) : [];
                for (const r of rows) if (typeof r?.title === 'string') titles.push(r.title);
                const gridItems = Array.isArray(obj?.items) ? (obj.items as Array<{title?: unknown}>) : [];
                for (const gi of gridItems) if (typeof gi?.title === 'string') titles.push(gi.title);

                for (const t of titles) {
                    const anchor = slugifyAnchor(t);
                    if (!anchor) continue;
                    push({href: `#${anchor}`, label: `${p.page} · ${t}`, group: 'Module titles'});
                }

                // Timeline entries — `${company}-${role || start}`.
                const tlEntries = Array.isArray(obj?.entries) ? (obj.entries as Array<{company?: unknown; role?: unknown; start?: unknown}>) : [];
                for (const e of tlEntries) {
                    const company = typeof e?.company === 'string' ? e.company : '';
                    const role = typeof e?.role === 'string' ? e.role : '';
                    const start = typeof e?.start === 'string' ? e.start : '';
                    if (!company) continue;
                    const anchor = slugifyAnchor(`${company}-${role || start}`);
                    if (!anchor) continue;
                    const label = role ? `${p.page} · ${company} — ${role}` : `${p.page} · ${company}`;
                    push({href: `#${anchor}`, label, group: 'Timeline entries'});
                }

                // C13b — Manifesto chips. The renderer emits
                // `id="manifesto-chip-${slugifyAnchor(key)}"` on each chip
                // span; mirror that here so the picker / agent can target
                // an individual chip without guessing the slug rule.
                if (it.type === 'MANIFESTO' || Array.isArray(obj?.chips)) {
                    const chips = Array.isArray(obj?.chips) ? (obj.chips as Array<{key?: unknown; thumb?: unknown}>) : [];
                    for (const c of chips) {
                        const key = typeof c?.key === 'string' ? c.key : '';
                        const thumb = typeof c?.thumb === 'string' ? c.thumb : '';
                        const slug = slugifyAnchor(key);
                        if (!slug) continue;
                        const label = thumb
                            ? `${p.page} · ${key} (${thumb})`
                            : `${p.page} · ${key}`;
                        push({href: `#manifesto-chip-${slug}`, label, group: 'Module titles'});
                    }
                }
            }
        });
    }
    return out;
}

/** Minimum search ranker — substring match scored by leading-position
 *  bonuses. Returns the same entry shape with stable order so the MCP
 *  agent can deterministically pick the top hit. */
export function searchAnchors(entries: IAnchorEntry[], query: string): IAnchorEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    const ranked: Array<{e: IAnchorEntry; score: number}> = [];
    for (const e of entries) {
        const label = e.label.toLowerCase();
        const href = e.href.toLowerCase();
        const lhit = label.indexOf(q);
        const hhit = href.indexOf(q);
        if (lhit < 0 && hhit < 0) continue;
        // Lower index = better. Label is more meaningful than href.
        const lscore = lhit < 0 ? 1000 : lhit;
        const hscore = hhit < 0 ? 1000 : hhit;
        const score = Math.min(lscore, hscore + 100);
        ranked.push({e, score});
    }
    ranked.sort((a, b) => a.score - b.score);
    return ranked.map(r => r.e);
}

/**
 * Adapter — fetches what the registry needs from the existing service
 * surface and runs `buildAnchorRegistry`. Used by MCP tools.
 */
export interface AnchorRegistryConnection {
    getNavigationCollection(): Promise<Array<{page: string; id?: string; parent?: string; slug?: unknown; sections?: string[]} & Record<string, unknown>>>;
    getSections(args: {ids: string[]}): Promise<Array<{id?: string; type?: number; content?: Array<{type?: string; content?: string}>; page?: string} & Record<string, unknown>>>;
}

export async function loadAnchorRegistry(
    conn: AnchorRegistryConnection,
    siteMode?: 'tabs' | 'scroll' | 'auto',
): Promise<IAnchorEntry[]> {
    const pages = await conn.getNavigationCollection();
    const sectionIds = pages.flatMap(p => Array.isArray(p.sections) ? p.sections : []);
    const sections = sectionIds.length ? await conn.getSections({ids: sectionIds}) : [];
    const sectionsByPage: Record<string, AnchorRegistrySection[]> = {};
    for (const s of sections) {
        const pageName = s.page ?? '';
        if (!pageName) continue;
        if (!sectionsByPage[pageName]) sectionsByPage[pageName] = [];
        sectionsByPage[pageName].push({
            id: s.id,
            type: s.type,
            content: s.content,
        });
    }
    const normalisedPages: AnchorRegistryPage[] = pages.map(p => ({
        page: p.page,
        id: p.id,
        parent: p.parent,
        slug: typeof p.slug === 'string' ? p.slug : undefined,
    }));
    return buildAnchorRegistry({pages: normalisedPages, sectionsByPage, siteMode});
}
