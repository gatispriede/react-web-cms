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

export const ANCHOR_TOOLS: McpTool[] = [anchorList, anchorSearch];
