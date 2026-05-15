/**
 * Commerce MCP tools — Phase 1.B sub-jump B.
 *
 * `commerce.config.get` reads the `commerce.*` sub-record from
 * `siteFlags`; `commerce.config.set` patches a single namespaced flag
 * (e.g. `commerce.checkoutEnabled`). Both round-trip through the
 * existing `saveSiteFlags` resolver so audit-stamp + version
 * concurrency stay intact.
 *
 * Importing this module also imports `commerceFlags.ts` (transitive
 * via the MCP tools index) so `defineFlag()` runs at MCP boot.
 */
import {McpTool} from '../types';
import {defineTool} from './_shared';
import {enforceModeForTool} from '../modeEnforcement';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {COMMERCE_FLAG_PATHS} from '@services/features/Commerce/commerceFlags';
import {getFlagDefinition} from '@services/features/Seo/siteFlagDefinitions';

export const commerceConfigGet: McpTool = defineTool({
    name: 'commerce.config.get',
    description: 'Read the commerce.* sub-record from siteFlags (master checkoutEnabled toggle + future sub-flags). Returns the registered flag definitions alongside the live values so the caller knows defaults + descriptions.',
    scopes: ['read:site'],
    inputSchema: {type: 'object', properties: {}},
}, async (_args, _ctx) => {
    try {
        const raw = await getMongoConnection().getSiteFlags();
        const flags = JSON.parse(raw);
        const commerce = (flags?.commerce ?? {}) as Record<string, unknown>;
        const definitions = COMMERCE_FLAG_PATHS.map(path => {
            const def = getFlagDefinition(path);
            const key = path.slice('commerce.'.length);
            return {
                path,
                value: commerce[key] ?? def?.defaultValue,
                defaultValue: def?.defaultValue,
                description: def?.description,
                audience: def?.audience ?? 'admin-only',
            };
        });
        return {commerce, definitions};
    } catch (err) {
        return {error: String((err as Error).message || err)};
    }
});

export const commerceConfigSet: McpTool = defineTool({
    name: 'commerce.config.set',
    description: 'Flip a commerce.* flag (e.g. commerce.checkoutEnabled). Path must be registered via defineFlag(); value is type-guard validated. Audit-logged. Call site.publish after to revalidate static pages.',
    scopes: ['write:site'],
    idempotent: true,
    auditScope: 'commerceFlags',
    gqlMutation: 'saveSiteFlags',
    inputSchema: {
        type: 'object',
        required: ['path', 'value'],
        properties: {
            path: {type: 'string', description: 'Dotted flag path, e.g. commerce.checkoutEnabled.'},
            value: {type: 'string', description: 'New value; type-guarded against the registered flag definition. JSON-stringify non-scalar values.'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'commerce.config.set');
    const path = String(args.path ?? '');
    if (!path.startsWith('commerce.')) {
        return {ok: false, error: `commerce.config.set: path must start with 'commerce.', got '${path}'`};
    }
    const def = getFlagDefinition(path);
    if (!def) {
        return {ok: false, error: `commerce.config.set: unknown flag '${path}'. Registered: ${COMMERCE_FLAG_PATHS.join(', ')}.`};
    }
    if (!def.typeGuard(args.value)) {
        return {ok: false, error: `commerce.config.set: value failed type-guard for '${path}'`};
    }
    const key = path.slice('commerce.'.length);
    try {
        const raw = await getMongoConnection().saveSiteFlags({
            flags: {commerce: {[key]: args.value}},
            _session: {email: ctx.actor},
        });
        return {ok: true, result: JSON.parse(raw)};
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

/**
 * `product.module.preview` — placeholder stub for the SSR-rendered
 * preview tool the spec calls for. Returns the inbound module config
 * echoed back + a stub HTML wrapper. Full server-side React render
 * lands with sub-jump C (which threads `react-dom/server` through the
 * MCP server's runtime).
 */
export const productModulePreview: McpTool = defineTool({
    name: 'product.module.preview',
    description: 'Stub preview for a Product module config — echoes the validated config + a placeholder HTML wrapper. Full SSR render lands in sub-jump C.',
    scopes: ['read:products'],
    inputSchema: {
        type: 'object',
        required: ['moduleConfig'],
        properties: {
            moduleConfig: {type: 'object'},
            fixtureProductId: {type: 'string'},
        },
    },
}, async (args, _ctx) => {
    const mode = (args.moduleConfig?.mode as string) ?? 'grid';
    const validModes = ['featured', 'grid', 'carousel', 'comparison', 'related'];
    if (!validModes.includes(mode)) {
        return {ok: false, error: `product.module.preview: invalid mode '${mode}'. Valid: ${validModes.join(', ')}.`};
    }
    return {
        ok: true,
        mode,
        config: args.moduleConfig,
        html: `<!-- product module preview · mode=${mode} · fixture=${args.fixtureProductId ?? 'none'} -->`,
        note: 'Stub renderer — server-side React render lands in sub-jump C.',
    };
});

export const COMMERCE_TOOLS: McpTool[] = [
    commerceConfigGet,
    commerceConfigSet,
    productModulePreview,
];
