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

/**
 * Replace the registry with a fresh build from the admin shell's loaded
 * pages. `sectionsByPage` is the same shape `AdminApp.initialize` already
 * passes around — `{[pageName]: ISection[]}` — to avoid re-fetching.
 */
export function setAnchors(
    pages: Pick<IPage, 'page'>[],
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
        const slug = slugifyAnchor(p.page) || p.page;
        push({href: `/${slug}`, label: p.page, group: 'Pages'});

        const sections = sectionsByPage[p.page] ?? [];
        for (const s of sections) {
            if (s.id) {
                push({href: `#${s.id}`, label: `${p.page} · ${s.id}`, group: 'Sections'});
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
            }
        }
    }
    cache = out;
    notify();
}
