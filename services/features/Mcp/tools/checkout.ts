/**
 * Phase 1.B-c — checkout customization MCP tools.
 *
 * Three families:
 *
 *   - `checkout.config.get`           — read every `commerce.checkout.*`
 *                                       flag in deterministic order with
 *                                       definitions + defaults.
 *   - `checkout.config.set`           — set one flag (path must start
 *                                       with `commerce.checkout.`).
 *   - `checkout.shipping.{list,create,update,delete,reorder}`
 *                                     — CRUD over shipping methods.
 *   - `checkout.providers.list`       — enumerate provider adapters +
 *                                       per-id flag + env readiness.
 *
 * Cargo-cult of `commerce.ts` + `accountSettings.ts` (Phase 1.E).
 * Append-only registration — registered in `Mcp/tools/index.ts`.
 */
import type {McpTool, JSONSchemaObject, JSONSchemaProp} from '../types';
import {defineTool} from './_shared';
import {enforceModeForTool} from '../modeEnforcement';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {COMMERCE_FLAG_PATHS} from '@services/features/Commerce/commerceFlags';
import {getFlagDefinition} from '@services/features/Seo/siteFlagDefinitions';
import {getShippingMethodService} from '@services/features/Checkout/ShippingMethodService';
import {listAllAdapters} from '@services/features/Checkout/paymentAdapters';
import type {IShippingMethod, ShippingMethodType} from '@interfaces/IShippingMethod';

const idemKeyProp: JSONSchemaProp = {type: 'string'};
const idProp: JSONSchemaProp = {type: 'string', minLength: 1};

const justId: JSONSchemaObject = {
    type: 'object',
    required: ['id'],
    properties: {id: idProp},
};

export const checkoutConfigGet: McpTool = defineTool({
    name: 'checkout.config.get',
    description: 'Read every commerce.checkout.* flag — flow shape, requireAccount, per-customer-type field config, order-summary template, post-purchase redirect, payment-provider toggles. Returns live values alongside registered defaults + descriptions.',
    scopes: ['read:site'],
    inputSchema: {type: 'object', properties: {}},
}, async () => {
    try {
        const raw = await getMongoConnection().getSiteFlags();
        const flags = JSON.parse(raw);
        const live = (flags?.commerce?.checkout ?? {}) as Record<string, unknown>;
        const paths = COMMERCE_FLAG_PATHS.filter(p => p.startsWith('commerce.checkout.'));
        const definitions = paths.map(path => {
            const def = getFlagDefinition(path);
            // Walk the path segments past `commerce.checkout.` to find the live value.
            const rest = path.slice('commerce.checkout.'.length).split('.');
            let v: unknown = live;
            for (const k of rest) {
                v = v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined;
            }
            return {
                path,
                value: v ?? def?.defaultValue,
                defaultValue: def?.defaultValue,
                description: def?.description,
                audience: def?.audience ?? 'admin-only',
            };
        });
        return {checkout: live, definitions};
    } catch (err) {
        return {error: String((err as Error).message || err)};
    }
});

export const checkoutConfigSet: McpTool = defineTool({
    name: 'checkout.config.set',
    description: 'Set one commerce.checkout.* flag (e.g. commerce.checkout.flow=single-step). Type-guard-validated against the registered definition. Audit-logged. Call site.publish to revalidate routes when changing flow.',
    scopes: ['write:site'],
    idempotent: true,
    auditScope: 'commerceFlags',
    gqlMutation: 'saveSiteFlags',
    inputSchema: {
        type: 'object',
        required: ['path', 'value'],
        properties: {
            path: {type: 'string'},
            value: {type: 'string', description: 'JSON-encoded value. Pass primitive strings directly; complex shapes JSON-stringified.'},
            idempotencyKey: idemKeyProp,
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'checkout.config.set');
    const path = String(args.path ?? '');
    if (!path.startsWith('commerce.checkout.')) {
        return {ok: false, error: `checkout.config.set: path must start with 'commerce.checkout.', got '${path}'`};
    }
    const def = getFlagDefinition(path);
    if (!def) {
        return {ok: false, error: `checkout.config.set: unknown flag '${path}'`};
    }
    if (!def.typeGuard(args.value)) {
        return {ok: false, error: `checkout.config.set: value failed type-guard for '${path}'`};
    }
    // Build a nested patch from the dotted suffix so the saveSiteFlags
    // resolver merges only the leaf.
    const rest = path.slice('commerce.checkout.'.length).split('.');
    let nest: Record<string, unknown> = {[rest[rest.length - 1]]: args.value};
    for (let i = rest.length - 2; i >= 0; i--) nest = {[rest[i]]: nest};
    try {
        const raw = await getMongoConnection().saveSiteFlags({
            flags: {commerce: {checkout: nest}},
            _session: {email: ctx.actor},
        });
        return {ok: true, result: JSON.parse(raw)};
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

const shippingMethodShape: JSONSchemaObject = {
    type: 'object',
    required: ['name', 'type'],
    properties: {
        name: {type: 'string', minLength: 1},
        type: {type: 'string', enum: ['flat-rate', 'weight-based', 'free-threshold', 'pickup']},
        isActive: {type: 'boolean'},
        displayOrder: {type: 'integer', minimum: 0},
        availableCountries: {type: 'array', items: {type: 'string'}},
        flatRate: {type: 'object'},
        weightBased: {type: 'object'},
        freeThreshold: {type: 'object'},
        pickup: {type: 'object'},
    },
};

export const checkoutShippingList: McpTool = defineTool({
    name: 'checkout.shipping.list',
    description: 'List every shipping method (active + inactive), sorted by displayOrder.',
    scopes: ['read:site'],
    inputSchema: {type: 'object', properties: {}},
}, async () => {
    try {
        const rows = await getShippingMethodService().list();
        return {rows};
    } catch (err) {
        return {error: String((err as Error).message || err)};
    }
});

export const checkoutShippingCreate: McpTool = defineTool({
    name: 'checkout.shipping.create',
    description: 'Create a shipping method. type ∈ flat-rate | weight-based | free-threshold | pickup. Supply the matching sub-record. Audit-logged.',
    scopes: ['write:site'],
    idempotent: true,
    auditScope: 'shippingMethods',
    inputSchema: {
        type: 'object',
        required: ['method'],
        properties: {method: shippingMethodShape, idempotencyKey: idemKeyProp},
    },
}, async (args, ctx) => {
    const method = args.method as Partial<IShippingMethod>;
    return getShippingMethodService().create({
        name: String(method.name ?? ''),
        type: (method.type ?? 'flat-rate') as ShippingMethodType,
        isActive: method.isActive ?? true,
        displayOrder: typeof method.displayOrder === 'number' ? method.displayOrder : 0,
        availableCountries: method.availableCountries,
        flatRate: method.flatRate,
        weightBased: method.weightBased,
        freeThreshold: method.freeThreshold,
        pickup: method.pickup,
    }, ctx.actor);
});

export const checkoutShippingUpdate: McpTool = defineTool({
    name: 'checkout.shipping.update',
    description: 'Patch fields on a shipping method by id. Stamps audit + bumps version.',
    scopes: ['write:site'],
    idempotent: true,
    auditScope: 'shippingMethods',
    inputSchema: {
        type: 'object',
        required: ['id', 'patch'],
        properties: {id: idProp, patch: {type: 'object'}, idempotencyKey: idemKeyProp},
    },
}, async (args, ctx) =>
    getShippingMethodService().update(String(args.id), args.patch as Partial<IShippingMethod>, ctx.actor),
);

export const checkoutShippingDelete: McpTool = defineTool({
    name: 'checkout.shipping.delete',
    description: 'Remove a shipping method by id. No soft-delete — operator can recreate.',
    scopes: ['write:site'],
    idempotent: true,
    auditScope: 'shippingMethods',
    inputSchema: justId,
}, async (args) => getShippingMethodService().delete(String(args.id)));

export const checkoutShippingReorder: McpTool = defineTool({
    name: 'checkout.shipping.reorder',
    description: 'Bulk-reorder shipping methods. Provide the full ordered list of ids; index becomes the new displayOrder.',
    scopes: ['write:site'],
    idempotent: true,
    auditScope: 'shippingMethods',
    inputSchema: {
        type: 'object',
        required: ['orderedIds'],
        properties: {
            orderedIds: {type: 'array', items: idProp},
            idempotencyKey: idemKeyProp,
        },
    },
}, async (args, ctx) =>
    getShippingMethodService().reorder((args.orderedIds as string[]) ?? [], ctx.actor),
);

export const checkoutProvidersList: McpTool = defineTool({
    name: 'checkout.providers.list',
    description: 'Enumerate every payment-provider adapter with per-id flag + env readiness. Use to debug "why is Stripe not appearing on checkout".',
    scopes: ['read:site'],
    inputSchema: {type: 'object', properties: {}},
}, async () => {
    let providerFlags: Record<string, boolean> = {};
    try {
        const raw = await getMongoConnection().getSiteFlags();
        const flags = JSON.parse(raw);
        providerFlags = ((flags?.commerce?.checkout?.providers as Record<string, boolean>) ?? {});
    } catch {
        // empty
    }
    const rows = listAllAdapters().map(a => ({
        id: a.id,
        displayName: a.displayName,
        flagEnabled: providerFlags[a.id] !== false,
        enabled: a.isEnabled({flagEnabled: providerFlags[a.id] !== false}),
    }));
    return {rows};
});

export const CHECKOUT_TOOLS: McpTool[] = [
    checkoutConfigGet,
    checkoutConfigSet,
    checkoutShippingList,
    checkoutShippingCreate,
    checkoutShippingUpdate,
    checkoutShippingDelete,
    checkoutShippingReorder,
    checkoutProvidersList,
];
