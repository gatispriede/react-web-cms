import {McpTool} from '../types';
import {defineTool, runBatch} from './_shared';

const sessionFor = (actor: string) => ({kind: 'admin' as const, role: 'admin' as const, email: actor});
const safeParse = (s: string): unknown => { try { return JSON.parse(s); } catch { return {raw: s}; } };

export const productList: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'product.list',
    description: 'Lists products. Honours draft/category/inStockOnly/source filters.',
    scopes: ['read:products'],
    inputSchema: {
        type: 'object',
        properties: {
            includeDrafts: {type: 'boolean'},
            limit: {type: 'integer', minimum: 1, maximum: 500},
            category: {type: 'string'},
            inStockOnly: {type: 'boolean'},
            source: {type: 'string', enum: ['manual', 'warehouse']},
        },
    },
}, async (args, ctx) => ctx.services.productService.list(args ?? {}));

export const productGet: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'product.get',
    description: 'Returns one product by slug.',
    scopes: ['read:products'],
    inputSchema: {
        type: 'object',
        required: ['slug'],
        properties: {
            slug: {type: 'string', minLength: 1},
            includeDrafts: {type: 'boolean'},
        },
    },
}, async (args, ctx) =>
    ctx.services.productService.getBySlug(args.slug, {includeDrafts: args.includeDrafts}),
);

const productInputProps = {
    title: {type: 'string' as const, minLength: 1},
    sku: {type: 'string' as const, minLength: 1},
    description: {type: 'string' as const},
    price: {type: 'integer' as const, minimum: 0, description: 'Minor units (cents). Legacy single-currency / transaction-currency fallback.'},
    currency: {type: 'string' as const, minLength: 3, maxLength: 3},
    // Multi-currency + tax (W8g — multi-currency-and-tax). Operator-editable
    // pricing config gets MCP parity here so AI authoring can publish native
    // per-market prices, set the FX-fallback pivot, and tag the VAT regime.
    prices: {
        // Free-form ISO-4217 → minor-units map. The validator only checks
        // `type: object`; key/value sanitisation is `ProductService.save`'s
        // job (`sanitizePrices`). `JSONSchemaProp` has no `additionalProperties`.
        type: 'object' as const,
        description: 'Multi-currency price map — minor units keyed by uppercase ISO-4217 (e.g. {"EUR":199000,"GBP":169000}). Sparse; EcbFxService fills the gaps at display time. Pass {} to clear back to legacy single-currency.',
    },
    baseCurrency: {
        type: 'string' as const, minLength: 3, maxLength: 3,
        description: 'FX-fallback pivot currency. Defaults to `currency` when omitted.',
    },
    tax: {
        type: 'object' as const,
        description: 'Per-product VAT handling hint.',
        properties: {
            regime: {type: 'string' as const, enum: ['standard', 'margin', 'private-seller', 'zero-rated', 'exempt']},
            category: {type: 'string' as const, description: 'Stripe Tax product tax code, e.g. txcd_99999999.'},
            included: {type: 'boolean' as const, description: 'Is the listed price tax-inclusive? EU default: true.'},
        },
    },
    stock: {type: 'integer' as const, minimum: 0},
    categories: {type: 'array' as const, items: {type: 'string' as const}},
    draft: {type: 'boolean' as const, default: true},
    slug: {type: 'string' as const},
};

export const productCreate: McpTool = defineTool({
    name: 'product.create',
    description: 'Create one or many products. Single form: pass {title, sku, price, currency, ...}. Bulk form: pass {items: InProduct[]}. Bulk returns per-item failures via `data.failed[]` so a partial-batch failure doesn\'t abort the rest. Reference: image.delete { ids[] }.',
    scopes: ['write:products'],
    idempotent: true,
    gqlMutation: 'saveProduct',
    inputSchema: {
        type: 'object',
        properties: {
            ...productInputProps,
            items: {
                type: 'array',
                items: {type: 'object', properties: productInputProps},
                description: 'Bulk variant. Each item is an InProduct. Up to 500 items. Mutually exclusive with single-item args.',
            },
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    const isBulk = Array.isArray(args.items);
    // For single mode: idempotencyKey/items keys don't go into the product payload.
    const {items: _i, idempotencyKey: _k, ...singlePayload} = args;
    const itemsList: Array<{id: string; payload: any}> = isBulk
        ? args.items.map((it: any, i: number) => ({id: String(it?.sku ?? it?.slug ?? `idx:${i}`), payload: it}))
        : (typeof args.title === 'string' && typeof args.sku === 'string'
            ? [{id: String(args.sku), payload: singlePayload}]
            : []);
    if (!itemsList.length) {
        throw new Error('product.create requires (title+sku+price+currency) or non-empty `items[]`');
    }
    const batch = await runBatch(itemsList, async (_id, payload) => {
        const res = await ctx.services.saveProduct({
            product: payload,
            _session: sessionFor(ctx.actor),
        });
        return {result: typeof res === 'string' ? safeParse(res) : res};
    });
    if (!isBulk) {
        const r = batch.results[0]!;
        return r.ok ? r.result : {ok: false, error: r.error};
    }
    return batch;
});

export const productUpdate: McpTool = defineTool({
    name: 'product.update',
    description: 'Update one or many products by id (optimistic concurrency via expectedVersion). Single form: pass {id, ...patch}. Bulk form: pass {items: IProduct[]}. Bulk returns per-item failures via `data.failed[]` so a partial-batch failure doesn\'t abort the rest. Reference: image.delete { ids[] }.',
    scopes: ['write:products'],
    idempotent: true,
    gqlMutation: 'saveProduct',
    inputSchema: {
        type: 'object',
        properties: {
            id: {type: 'string', minLength: 1},
            ...productInputProps,
            expectedVersion: {type: 'integer'},
            items: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: {type: 'string', minLength: 1},
                        ...productInputProps,
                        expectedVersion: {type: 'integer'},
                    },
                },
                description: 'Bulk variant. Each item is an IProduct (must include `id`). Up to 500 items.',
            },
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    const isBulk = Array.isArray(args.items);
    const {items: _i, idempotencyKey: _k, expectedVersion, ...singleRest} = args;
    const itemsList: Array<{id: string; payload: any}> = isBulk
        ? args.items.map((it: any, i: number) => ({id: String(it?.id ?? `idx:${i}`), payload: it}))
        : (typeof args.id === 'string'
            ? [{id: args.id, payload: {...singleRest, expectedVersion}}]
            : []);
    if (!itemsList.length) {
        throw new Error('product.update requires `id` or non-empty `items[]`');
    }
    const batch = await runBatch(itemsList, async (_id, payload) => {
        const {expectedVersion: ev, ...productFields} = payload;
        const res = await ctx.services.saveProduct({
            product: productFields,
            expectedVersion: ev ?? null,
            _session: sessionFor(ctx.actor),
        });
        return {result: typeof res === 'string' ? safeParse(res) : res};
    });
    if (!isBulk) {
        const r = batch.results[0]!;
        return r.ok ? r.result : {ok: false, error: r.error};
    }
    return batch;
});

export const productPublish: McpTool = defineTool({
    name: 'product.publish',
    description: 'Publishes (or unpublishes when `publish: false`) a product.',
    scopes: ['write:products'],
    idempotent: true,
    gqlMutation: 'setProductPublished',
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            publish: {type: 'boolean', default: true},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    const res = await ctx.services.setProductPublished({
        id: args.id,
        publish: args.publish ?? true,
        _session: sessionFor(ctx.actor),
    });
    return typeof res === 'string' ? safeParse(res) : res;
});

export const PRODUCT_TOOLS: McpTool[] = [productList, productGet, productCreate, productUpdate, productPublish];
