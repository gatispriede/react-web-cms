import {McpTool} from '../types';

const ok = (data: unknown) => ({content: [{type: 'text' as const, text: JSON.stringify(data)}]});
const sessionFor = (actor: string) => ({kind: 'admin' as const, role: 'admin' as const, email: actor});
const safeParse = (s: string): unknown => { try { return JSON.parse(s); } catch { return {raw: s}; } };

export const productList: McpTool = {
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
    handler: async (args, ctx) => {
        const products = await ctx.services.productService.list(args ?? {});
        return ok(products);
    },
};

export const productGet: McpTool = {
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
    handler: async (args, ctx) => {
        const product = await ctx.services.productService.getBySlug(args.slug, {includeDrafts: args.includeDrafts});
        return ok(product);
    },
};

const productInputProps = {
    title: {type: 'string' as const, minLength: 1},
    sku: {type: 'string' as const, minLength: 1},
    description: {type: 'string' as const},
    price: {type: 'integer' as const, minimum: 0, description: 'Minor units (cents).'},
    currency: {type: 'string' as const, minLength: 3, maxLength: 3},
    stock: {type: 'integer' as const, minimum: 0},
    categories: {type: 'array' as const, items: {type: 'string' as const}},
    draft: {type: 'boolean' as const, default: true},
    slug: {type: 'string' as const},
};

export const productCreate: McpTool = {
    name: 'product.create',
    description: 'Creates a new product. Returns id, slug, version.',
    scopes: ['write:products'],
    inputSchema: {
        type: 'object',
        required: ['title', 'sku', 'price', 'currency'],
        properties: productInputProps,
    },
    handler: async (args, ctx) => {
        const res = await ctx.services.saveProduct({
            product: args,
            _session: sessionFor(ctx.actor),
        });
        return ok(typeof res === 'string' ? safeParse(res) : res);
    },
};

export const productUpdate: McpTool = {
    name: 'product.update',
    description: 'Updates an existing product by id (optimistic concurrency via expectedVersion).',
    scopes: ['write:products'],
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            ...productInputProps,
            expectedVersion: {type: 'integer'},
        },
    },
    handler: async (args, ctx) => {
        const {expectedVersion, ...rest} = args;
        const res = await ctx.services.saveProduct({
            product: rest,
            expectedVersion: expectedVersion ?? null,
            _session: sessionFor(ctx.actor),
        });
        return ok(typeof res === 'string' ? safeParse(res) : res);
    },
};

export const productPublish: McpTool = {
    name: 'product.publish',
    description: 'Publishes (or unpublishes when `publish: false`) a product.',
    scopes: ['write:products'],
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            publish: {type: 'boolean', default: true},
        },
    },
    handler: async (args, ctx) => {
        const res = await ctx.services.setProductPublished({
            id: args.id,
            publish: args.publish ?? true,
            _session: sessionFor(ctx.actor),
        });
        return ok(typeof res === 'string' ? safeParse(res) : res);
    },
};

export const PRODUCT_TOOLS: McpTool[] = [productList, productGet, productCreate, productUpdate, productPublish];
