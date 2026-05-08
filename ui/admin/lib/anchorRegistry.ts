/**
 * In-memory registry of link targets the admin can pick from.
 *
 * Populated by `AdminApp.initialize()` after `loadSections` — walks every
 * page + section + content item and emits one entry per addressable
 * anchor:
 *   - `/page-slug`           — whole page
 *   - `#section-id`          — a section's `id` (deterministic from save)
 *   - `#title-slug`          — a module-level `title` / `sectionTitle`
 *
 * Read by `<LinkTargetPicker>`. Subscribers re-render when the registry
 * is replaced (no diffing — the AdminApp pipeline already debounces).
 *
 * Keep this module dependency-free of React so it can be imported from
 * any layer (admin editor, future server hook, tests).
 */

import {slugifyAnchor} from "@utils/stringFunctions";
import type {ISection} from "@interfaces/ISection";
import type {IPage} from "@interfaces/IPage";
import {EItemType} from "@enums/EItemType";

/** Map a section's track count to a friendly width label so the link
 *  picker shows "Main · 100% · Hero" instead of "Main · <guid>". */
const sectionWidthLabel = (trackCount: number | undefined): string => {
    switch (trackCount) {
        case 1: return '100%';
        case 2: return '50/50';
        case 3: return '33/33/33';
        case 4: return '25×4';
        default: return trackCount ? `${trackCount}-track` : '';
    }
};

/** Best-effort module summary for a section: prefer the dominant item type,
 *  fall back to a count when items are mixed. Returns '' when the section
 *  has no items. */
const sectionModuleSummary = (s: ISection): string => {
    const items = (s.content ?? []) as Array<{type?: string}>;
    if (!items.length) return '';
    const types = items.map(it => it?.type).filter(Boolean) as string[];
    if (!types.length) return '';
    const unique = Array.from(new Set(types));
    if (unique.length === 1) return prettifyType(unique[0]);
    return `${unique.length} modules`;
};

/** Convert `PROJECT_GRID` → `Project grid` so the picker reads naturally. */
const prettifyType = (t: string): string => {
    // Find a matching EItemType key for canonical casing; fall back to
    // splitting the underscore form.
    const match = (Object.keys(EItemType) as Array<keyof typeof EItemType>)
        .find(k => EItemType[k] === t);
    const base = match ? String(match) : t;
    // Insert spaces before capitals and lowercase the rest: "ProjectGrid" → "Project grid".
    return base.replace(/([A-Z])/g, ' $1').trim().replace(/^./, c => c.toUpperCase()).replace(/(?<=.)\s[A-Z]/g, m => m.toLowerCase());
};

export interface IAnchorOption {
    /** Stable id for AntD Select `value`. */
    href: string;
    /** Visible label (page name / section title / module title). */
    label: string;
    /** Group header in the dropdown. */
    group: string;
}

let cache: IAnchorOption[] = [];
const listeners = new Set<() => void>();

function notify() { listeners.forEach(fn => fn()); }

export function getAnchors(): IAnchorOption[] {
    return cache;
}

export function subscribeAnchors(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Page shape this module needs — accepts both flat (legacy) entries
 *  and sub-page-aware ones with `id` / `parent` / `slug`. F1 sub-pages:
 *  the registry walks the parent chain so picker labels read
 *  `Services → Cleaning` and hrefs read `/services/cleaning`. */
type RegistryPage = Pick<IPage, 'page'> & {
    id?: string;
    parent?: string;
    slug?: string;
};

/** Walk the parent chain root → self, returning the matched page entries.
 *  Cycle-safe (server prevents cycles, but never trust input). */
function chainFor(page: RegistryPage, all: RegistryPage[]): RegistryPage[] {
    const byKey = new Map<string, RegistryPage>();
    for (const p of all) byKey.set(p.id ?? p.page, p);
    const out: RegistryPage[] = [];
    const seen = new Set<string>();
    let cur: RegistryPage | undefined = page;
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

const slugFor = (p: RegistryPage): string =>
    p.slug?.trim() || slugifyAnchor(p.page) || p.page;

/**
 * Replace the registry with a fresh build from the admin shell's loaded
 * pages. `sectionsByPage` is the same shape `AdminApp.initialize` already
 * passes around — `{[pageName]: ISection[]}` — to avoid re-fetching.
 *
 * F1 sub-pages: when a page has a `parent`, the picker entry uses the
 * full slug-chain href (`/services/cleaning`) and an indented label
 * (`Services → Cleaning`). Top-level pages render as before.
 */
export function setAnchors(
    pages: RegistryPage[],
    sectionsByPage: Record<string, ISection[]>
): void {
    const out: IAnchorOption[] = [];
    const seen = new Set<string>();
    const push = (opt: IAnchorOption) => {
        // Dedup by href — first writer wins so the page-level entry takes
        // precedence over a section that happens to slugify identically.
        if (seen.has(opt.href)) return;
        seen.add(opt.href);
        out.push(opt);
    };

    for (const p of pages) {
        const chain = chainFor(p, pages);
        const slugs = chain.map(slugFor);
        const href = `/${slugs.join('/')}`;
        const label = chain.length > 1
            ? chain.map(c => c.page).join(' → ')
            : p.page;
        push({href, label, group: 'Pages'});

        const sections = sectionsByPage[p.page] ?? [];
        sections.forEach((s, idx) => {
            if (s.id) {
                const width = sectionWidthLabel(s.type);
                const summary = sectionModuleSummary(s);
                const parts = [p.page, width, summary || `section ${idx + 1}`].filter(Boolean);
                push({href: `#${s.id}`, label: parts.join(' → '), group: 'Sections'});
            }
            // Walk content items to surface module-title anchors.
            const items = (s.content ?? []) as Array<{type?: string; content?: string}>;
            for (const it of items) {
                if (typeof it?.content !== 'string') continue;
                let parsed: any;
                try { parsed = JSON.parse(it.content); } catch { continue; }
                const titles: string[] = [];
                if (typeof parsed?.title === 'string') titles.push(parsed.title);
                if (typeof parsed?.sectionTitle === 'string') titles.push(parsed.sectionTitle);
                // Per-row titles for Services / ProjectGrid.
                const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
                for (const r of rows) if (typeof r?.title === 'string') titles.push(r.title);
                const gridItems = Array.isArray(parsed?.items) ? parsed.items : [];
                for (const gi of gridItems) if (typeof gi?.title === 'string') titles.push(gi.title);

                for (const t of titles) {
                    const anchor = slugifyAnchor(t);
                    if (!anchor) continue;
                    push({href: `#${anchor}`, label: `${p.page} · ${t}`, group: 'Module titles'});
                }

                // C13b — Timeline entries don't have a single `title` field; the
                // anchorable identity is `${company}-${role}` (or `${company}-${start}`
                // as a tiebreaker when role is empty). Same composition is used by
                // the renderer in `Timeline.tsx`.
                const tlEntries = Array.isArray(parsed?.entries) ? parsed.entries : [];
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

                // C13b — Manifesto chips become per-chip anchors. Each chip's
                // `key` is the addressable identity; the renderer emits an
                // `id="manifesto-chip-${slugifyAnchor(key)}"` on each chip
                // span so deep-links resolve via native hash-scroll.
                if (it.type === 'MANIFESTO' || (parsed && Array.isArray(parsed.chips))) {
                    const chips = Array.isArray(parsed?.chips) ? parsed.chips : [];
                    for (const c of chips) {
                        const key = typeof c?.key === 'string' ? c.key : '';
                        const thumb = typeof c?.thumb === 'string' ? c.thumb : '';
                        const slug = slugifyAnchor(key);
                        if (!slug) continue;
                        const label = thumb
                            ? `${p.page} · ${key} (${thumb})`
                            : `${p.page} · ${key}`;
                        push({href: `#manifesto-chip-${slug}`, label, group: 'Manifesto chips'});
                    }
                }
            }
        });
    }
    cache = out;
    notify();
}
