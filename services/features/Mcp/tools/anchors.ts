/**
 * MCP anchor tools — `anchor.list` + `anchor.search`.
 *
 * Surface the same anchor registry the admin's `<LinkTargetPicker>`
 * consumes so AI agents authoring content via MCP pick real link
 * targets instead of guessing. Reads via the server-side
 * `AnchorRegistry` adapter (`services/features/Anchors/`).
 */
import {McpTool} from '../types';
import {defineTool} from './_shared';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {
    loadAnchorRegistry,
    searchAnchors,
    type AnchorRegistryConnection,
    type IAnchorEntry,
} from '@services/features/Anchors/AnchorRegistry';

const fetchEntries = async (siteMode?: 'tabs' | 'scroll' | 'auto'): Promise<IAnchorEntry[]> => {
    const conn = getMongoConnection() as unknown as AnchorRegistryConnection;
    return loadAnchorRegistry(conn, siteMode);
};

export const anchorList: McpTool = defineTool({
    name: 'anchor.list',
    description: 'Returns the full anchor registry — every page, every section, every module-with-a-title across the site. Use BEFORE setting any link / cta href in a section update so the link points at a real target. Optional `siteMode` controls href shape: \'tabs\' (default) emits `/page#section`; \'scroll\' emits hash-only `#anchor`. Mirrors what the admin LinkTargetPicker shows.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            siteMode: {
                type: 'string',
                enum: ['tabs', 'scroll', 'auto'],
                description: 'Render-mode shape for hrefs. Defaults to "tabs". Pass "scroll" to get hash-only hrefs that resolve inside a single scrolling page.',
            },
        },
    },
}, async (args) => {
    const entries = await fetchEntries(args.siteMode);
    return entries;
});

export const anchorSearch: McpTool = defineTool({
    name: 'anchor.search',
    description: 'Free-text search across the anchor registry. Matches label + href (case-insensitive); ranks earlier-position substring matches higher. Returns the same `IAnchorEntry` shape as anchor.list, sorted by relevance.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
            query: {type: 'string', minLength: 1, description: 'Search term — page name, section title, or module title fragment.'},
            siteMode: {
                type: 'string',
                enum: ['tabs', 'scroll', 'auto'],
                description: 'Same as anchor.list — controls href shape on the returned matches.',
            },
            limit: {
                type: 'integer',
                minimum: 1,
                maximum: 200,
                description: 'Cap on returned results. Defaults to 50.',
            },
        },
    },
}, async (args) => {
    const entries = await fetchEntries(args.siteMode);
    const ranked = searchAnchors(entries, String(args.query));
    const limit = typeof args.limit === 'number' ? args.limit : 50;
    return ranked.slice(0, limit);
});

/**
 * `linkTarget.list` — same data as `anchor.list` but exposed under the
 * naming the editor-side picker uses (LinkTargetPicker). Adds an
 * optional `type` filter that maps onto the registry's `group` field —
 * 'page' | 'section' | 'module' | 'timeline' — so an agent building
 * a Hero CTA can ask for module-level anchors only and get a focused
 * list instead of every page/section row. F8-bulk shape: pure read,
 * no idempotency wrapper required, `read:content` scope.
 */
export const linkTargetList: McpTool = defineTool({
    name: 'linkTarget.list',
    description: 'List addressable in-site link targets — pages, sections, module-with-a-title anchors. Optional `type` narrows to a single category. Mirrors what the admin LinkTargetPicker shows. Use BEFORE setting any link/cta href so the value points at a real target.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            type: {
                type: 'string',
                enum: ['page', 'section', 'module', 'timeline'],
                description: 'Filter by anchor category: page = top-level page hrefs; section = `#section-id`; module = title-derived `#slug`; timeline = `${company}-${role}` entries.',
            },
            siteMode: {
                type: 'string',
                enum: ['tabs', 'scroll', 'auto'],
                description: 'Href shape — see anchor.list.',
            },
        },
    },
}, async (args) => {
    const entries = await fetchEntries(args.siteMode);
    const t = typeof args.type === 'string' ? args.type : undefined;
    if (!t) return entries;
    const groupFor: Record<string, IAnchorEntry['group']> = {
        page: 'Pages',
        section: 'Sections',
        module: 'Module titles',
        timeline: 'Timeline entries',
    };
    const wanted = groupFor[t];
    return wanted ? entries.filter(e => e.group === wanted) : entries;
});

/**
 * `linkTarget.resolve` — given a stored ref (canonical href string the
 * picker emitted), return the current `{href, label, group}` entry or
 * an `{ok:false, error:NOT_FOUND}` envelope. Lets agents detect dead
 * links after a rename without re-walking the whole registry. The ref
 * is matched against the registry's `href` field exactly; this is the
 * same key the picker stores and the renderer dereferences. External
 * URLs (http/https/mailto) round-trip unchanged with `group:'External'`.
 */
export const linkTargetResolve: McpTool = defineTool({
    name: 'linkTarget.resolve',
    description: 'Resolve a stored link ref (a canonical href the picker emitted) to its current registry entry. Returns the entry on hit, or `{ok:false, error:NOT_FOUND}` when the target no longer exists (e.g. a renamed module title). External URLs round-trip as `{group:"External"}`.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        required: ['ref'],
        properties: {
            ref: {type: 'string', minLength: 1, description: 'The stored href to resolve.'},
            siteMode: {
                type: 'string',
                enum: ['tabs', 'scroll', 'auto'],
                description: 'Href shape — see anchor.list.',
            },
        },
    },
}, async (args) => {
    const ref = String(args.ref);
    if (/^(https?:|mailto:|tel:)/i.test(ref)) {
        return {href: ref, label: ref, group: 'External'};
    }
    const entries = await fetchEntries(args.siteMode);
    const hit = entries.find(e => e.href === ref);
    if (hit) return hit;
    // Fallback — strip slug suffixes the picker might have hashed and
    // re-attempt by the hash fragment alone. Lets `#career-record` and
    // `/cms#career-record` resolve to the same module title entry.
    const hashOnly = ref.startsWith('#') ? ref : (ref.includes('#') ? `#${ref.split('#').pop()}` : null);
    if (hashOnly) {
        const looseHit = entries.find(e => e.href === hashOnly);
        if (looseHit) return looseHit;
    }
    return {ok: false, error: 'NOT_FOUND', ref};
});

export const ANCHOR_TOOLS: McpTool[] = [anchorList, anchorSearch, linkTargetList, linkTargetResolve];
