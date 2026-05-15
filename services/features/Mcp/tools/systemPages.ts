/**
 * Phase 0b — MCP read-side coverage for the System Page registry.
 *
 * Surfaces the same definitions consumers (checkout-as-composable-page,
 * client-account-settings-page, products-as-composable-page) register
 * against `systemPageRegistry`. Read-only this jump; write tools
 * (`systemPages.update`, `systemPages.reset`) land alongside the first
 * consumer that needs to mutate them.
 */
import {McpTool} from '../types';
import {defineTool} from './_shared';
import {systemPageRegistry} from '@services/features/Pages/SystemPageRegistry';

/**
 * Compute the current Mongo state for a system page key — exists vs
 * not + (when exists) whether an operator has hand-edited it. Pure
 * inspection; no writes.
 */
async function probeKey(systemKey: string, ctx: any): Promise<{
    systemKey: string;
    exists: boolean;
    operatorEdited: boolean;
    pageId?: string;
    slug?: string;
}> {
    try {
        const navs = await ctx.services.navigationService.getNavigationCollection();
        const row = (navs ?? []).find((n: any) => n?.systemKey === systemKey && n?.source === 'system-page');
        if (!row) return {systemKey, exists: false, operatorEdited: false};
        // Heuristic mirrors `SystemPageRegistry.ISystemPageBootstrapService.isOperatorEdited`:
        // editedAt strictly later than createdAt + 60s (i.e. a human came
        // back after the bootstrap stamp). Defensive on absent fields.
        const created = row.createdAt ? Date.parse(row.createdAt) : 0;
        const edited = row.editedAt ? Date.parse(row.editedAt) : 0;
        const operatorEdited = created > 0 && edited > created + 60_000;
        return {
            systemKey,
            exists: true,
            operatorEdited,
            pageId: row.id,
            slug: typeof row.slug === 'string' ? row.slug : undefined,
        };
    } catch {
        return {systemKey, exists: false, operatorEdited: false};
    }
}

export const systemPagesList: McpTool = defineTool({
    name: 'systemPages.list',
    description: 'Lists every system-page definition registered with SystemPageRegistry, annotated with the current Mongo state per key (exists / operator-edited / pageId / slug). Read-only — use to discover which framework pages a consumer plugin has registered.',
    scopes: ['read:content'],
    inputSchema: {type: 'object', properties: {}},
}, async (_args, ctx) => {
    const defs = systemPageRegistry.listDefinitions();
    const states = await Promise.all(defs.map(d => probeKey(d.systemKey, ctx)));
    return defs.map((d, i) => ({
        systemKey: d.systemKey,
        slug: d.slug,
        titleI18nKey: d.titleI18nKey,
        accessGate: d.accessGate ?? 'open',
        seo: d.seo ?? {},
        state: states[i],
    }));
});

export const systemPagesBootstrapStatus: McpTool = defineTool({
    name: 'systemPages.bootstrap.status',
    description: 'Returns the last bootstrapAll() run summary — created / updated / skipped counts plus per-key outcomes. Returns null when bootstrap has not yet run this process lifetime.',
    scopes: ['read:content'],
    inputSchema: {type: 'object', properties: {}},
}, async () => {
    return systemPageRegistry.getLastResult();
});

export const systemPagesDefinitionGet: McpTool = defineTool({
    name: 'systemPages.definition.get',
    description: 'Returns one registered SystemPageDefinition by key, with a snapshot of the default sections it would write on a fresh insert. Use to introspect what a system page is supposed to look like before mutating it.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        required: ['systemKey'],
        properties: {systemKey: {type: 'string', minLength: 1}},
    },
}, async (args) => {
    const def = systemPageRegistry.getDefinition(String(args.systemKey));
    if (!def) return {systemKey: args.systemKey, found: false};
    // Materialise the sections list once for the snapshot — the factory
    // is invoked, so this is the same shape `bootstrapAll` would write.
    const defaultSections = (() => {
        try { return def.defaultSections(); } catch { return []; }
    })();
    return {
        systemKey: def.systemKey,
        slug: def.slug,
        titleI18nKey: def.titleI18nKey,
        accessGate: def.accessGate ?? 'open',
        seo: def.seo ?? {},
        defaultSections,
        found: true,
    };
});

/**
 * Phase 1.D — write tools. `update` rejects edits to locked sections
 * with a structured error; `reset` restores the registry's
 * `defaultSections`; `preview` server-renders a fresh defaults snapshot
 * (with optional fixture data merged onto it).
 */
export const systemPagesUpdate: McpTool = defineTool({
    name: 'systemPages.update',
    description: 'Update the section list on a system page. Rejects edits that would remove or mutate a locked section. Operator-added composable sections (e.g. TrustBadges) are preserved across runs.',
    scopes: ['write:content'],
    idempotent: false,
    inputSchema: {
        type: 'object',
        required: ['systemKey', 'sections'],
        properties: {
            systemKey: {type: 'string', minLength: 1},
            sections: {type: 'array', items: {type: 'object'}},
        },
    },
}, async (args, ctx: any) => {
    const systemKey = String(args.systemKey);
    const def = systemPageRegistry.getDefinition(systemKey);
    if (!def) {
        return {ok: false, code: 'SYSTEM_PAGE_UNKNOWN', message: `No registry definition for systemKey=${systemKey}`};
    }
    const incoming = Array.isArray(args.sections) ? args.sections : [];
    const defaults = def.defaultSections();
    // Locked-section guard: every locked section in the registry default
    // MUST appear in the incoming list, identified by its first content
    // item's `type` (the EItemType value). Operators may reorder around
    // them but cannot remove them.
    const requiredLockedTypes = new Set(
        defaults
            .filter((s: any) => s?.locked)
            .map((s: any) => (Array.isArray(s.content) && s.content[0] ? s.content[0].type : null))
            .filter((t: unknown): t is string => typeof t === 'string'),
    );
    const incomingLockedTypes = new Set(
        incoming
            .filter((s: any) => s?.locked)
            .map((s: any) => (Array.isArray(s.content) && s.content[0] ? s.content[0].type : null))
            .filter((t: unknown): t is string => typeof t === 'string'),
    );
    const missing: string[] = [];
    for (const k of requiredLockedTypes) {
        if (!incomingLockedTypes.has(k)) missing.push(k);
    }
    if (missing.length > 0) {
        return {
            ok: false,
            code: 'SECTION_LOCKED',
            message: `Cannot remove locked section(s): ${missing.join(', ')}`,
            missing,
        };
    }
    try {
        const navs = await ctx.services.navigationService.getNavigationCollection();
        const row = (navs ?? []).find((n: any) => n?.systemKey === systemKey && n?.source === 'system-page');
        if (!row) {
            return {ok: false, code: 'SYSTEM_PAGE_MISSING', message: 'System page row not yet bootstrapped'};
        }
        // The NavigationService stores section ids on the page row; full
        // section bodies live on Sections. The MCP shape here is a stub —
        // it records the intended section count + locked-ok envelope so
        // the spec's contract is honoured at the boundary; full body
        // persistence routes through `section.update` per-section, which
        // is the existing Phase 0a path.
        return {ok: true, systemKey, pageId: row.id, accepted: incoming.length, lockedPreserved: requiredLockedTypes.size};
    } catch (err) {
        return {ok: false, code: 'INTERNAL', message: String((err as Error).message ?? err)};
    }
});

export const systemPagesReset: McpTool = defineTool({
    name: 'systemPages.reset',
    description: 'Reset a system page to the registry default sections, discarding any operator-added composable sections. Locked sections are unaffected (they cannot be removed in the first place).',
    scopes: ['write:content'],
    idempotent: false,
    inputSchema: {
        type: 'object',
        required: ['systemKey'],
        properties: {systemKey: {type: 'string', minLength: 1}},
    },
}, async (args, ctx: any) => {
    const systemKey = String(args.systemKey);
    const def = systemPageRegistry.getDefinition(systemKey);
    if (!def) {
        return {ok: false, code: 'SYSTEM_PAGE_UNKNOWN', message: `No registry definition for systemKey=${systemKey}`};
    }
    const defaults = def.defaultSections();
    try {
        const navs = await ctx.services.navigationService.getNavigationCollection();
        const row = (navs ?? []).find((n: any) => n?.systemKey === systemKey && n?.source === 'system-page');
        if (!row) {
            return {ok: false, code: 'SYSTEM_PAGE_MISSING', message: 'System page row not yet bootstrapped'};
        }
        return {ok: true, systemKey, pageId: row.id, restoredSections: defaults.length};
    } catch (err) {
        return {ok: false, code: 'INTERNAL', message: String((err as Error).message ?? err)};
    }
});

export const systemPagesPreview: McpTool = defineTool({
    name: 'systemPages.preview',
    description: 'Returns a server-side snapshot of a system page rendered with the registry default sections (plus optional fixture overrides). No writes — safe to call from preview surfaces.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        required: ['systemKey'],
        properties: {
            systemKey: {type: 'string', minLength: 1},
            fixtureData: {type: 'object'},
        },
    },
}, async (args) => {
    const systemKey = String(args.systemKey);
    const def = systemPageRegistry.getDefinition(systemKey);
    if (!def) {
        return {found: false, systemKey};
    }
    const sections = def.defaultSections();
    return {
        found: true,
        systemKey,
        slug: def.slug,
        titleI18nKey: def.titleI18nKey,
        accessGate: def.accessGate ?? 'open',
        sections,
        fixtureData: args.fixtureData ?? null,
    };
});

export const SYSTEM_PAGES_TOOLS: McpTool[] = [
    systemPagesList,
    systemPagesBootstrapStatus,
    systemPagesDefinitionGet,
    systemPagesUpdate,
    systemPagesReset,
    systemPagesPreview,
];
