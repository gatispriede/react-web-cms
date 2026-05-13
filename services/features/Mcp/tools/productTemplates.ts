/**
 * MCP product-template tools — operator-managed `IProductTemplate` library.
 *
 *   productTemplate.list      — read-side introspection (optional usage count)
 *   productTemplate.get       — full document by id
 *   productTemplate.create    — new custom template
 *   productTemplate.update    — patch (built-ins reject structural edits)
 *   productTemplate.duplicate — clone any template as a fresh custom row
 *   productTemplate.delete    — cascade-resets products to default; built-ins reject
 *   productTemplate.preview   — server-render against a fixture product (snippet)
 *   product.template.set      — single + F8-bulk batch
 *
 * Scope model:
 *   - read tools → `read:content`
 *   - write tools → `write:content`
 *   - destructive tools (`delete`) carry `idempotent: true` so retried
 *     calls short-circuit through the F8 idempotency cache.
 *
 * Phase 1.F (product-display-templates).
 */

import {McpTool} from '../types';
import {defineTool, runBatch} from './_shared';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {TEMPLATE_AUDIENCES} from '@interfaces/IProductTemplate';

const svc = () => getMongoConnection().productTemplateService;
const productSvc = () => getMongoConnection().productService;

const AUDIENCE_ENUM = TEMPLATE_AUDIENCES as unknown as string[];

// ─── Read ────────────────────────────────────────────────────────

export const productTemplateList: McpTool = defineTool({
    name: 'productTemplate.list',
    description: 'List every product display template. Pass `includeUsage:true` to embed a per-template `usageCount` (number of products referencing it). Optional `audience` filter.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            audience: {type: 'string', enum: AUDIENCE_ENUM},
            includeUsage: {type: 'boolean'},
        },
    },
}, async (args) => {
    return svc().list({
        audience: args.audience,
        includeUsage: args.includeUsage === true,
    });
});

export const productTemplateGet: McpTool = defineTool({
    name: 'productTemplate.get',
    description: 'Fetch a single product display template by id (full sections list).',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {id: {type: 'string'}},
    },
}, async (args) => {
    const t = await svc().get(String(args.id));
    if (!t) throw new Error(`productTemplate not found: ${args.id}`);
    return t;
});

export const productTemplatePreview: McpTool = defineTool({
    name: 'productTemplate.preview',
    description: 'Resolve the template + a fixture product and return the "would-render" sections list. Operators inspect this to confirm the template binds correctly before assigning to live products. Returns `{templateId, fixtureProductId, sections}`.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string'},
            fixtureProductId: {type: 'string', description: 'Optional product id to bind; first product is picked otherwise.'},
        },
    },
}, async (args) => {
    const template = await svc().get(String(args.id));
    if (!template) throw new Error(`productTemplate not found: ${args.id}`);
    let product = args.fixtureProductId
        ? await productSvc().getById(String(args.fixtureProductId))
        : null;
    if (!product) {
        const all = await productSvc().list({limit: 1}).catch(() => null);
        const first = Array.isArray(all) ? all[0] : null;
        product = first ?? null;
    }
    if (!product) {
        return {
            templateId: template.id,
            fixtureProductId: null,
            sections: template.sections,
            note: 'no fixture product available — returning unbound sections',
        };
    }
    return {
        templateId: template.id,
        fixtureProductId: product.id,
        sections: svc().applyTemplate(template, product),
    };
});

// ─── Write ───────────────────────────────────────────────────────

export const productTemplateCreate: McpTool = defineTool({
    name: 'productTemplate.create',
    description: 'Create a new custom product display template. Built-in templates are seeded by the platform — operators duplicate them rather than re-creating.',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        required: ['name'],
        properties: {
            name: {type: 'string', minLength: 1},
            description: {type: 'string'},
            thumbnailImageId: {type: 'string'},
            audience: {type: 'string', enum: AUDIENCE_ENUM},
            applicableTo: {
                type: 'object',
                properties: {
                    categories: {type: 'array', items: {type: 'string'}},
                    sources: {type: 'array', items: {type: 'string', enum: ['manual', 'warehouse']}},
                },
            },
            sections: {type: 'array', items: {type: 'object'}},
        },
    },
}, async (args, ctx) => {
    return svc().create({
        name: String(args.name),
        description: typeof args.description === 'string' ? args.description : undefined,
        thumbnailImageId: typeof args.thumbnailImageId === 'string' ? args.thumbnailImageId : undefined,
        audience: args.audience,
        applicableTo: args.applicableTo,
        sections: Array.isArray(args.sections) ? args.sections : undefined,
    }, ctx.actor);
});

export const productTemplateUpdate: McpTool = defineTool({
    name: 'productTemplate.update',
    description: 'Patch a custom product display template. Built-ins reject structural edits (sections / applicableTo / audience) — duplicate first. Pass `expectedVersion` for optimistic concurrency.',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string'},
            name: {type: 'string'},
            description: {type: 'string'},
            thumbnailImageId: {type: 'string'},
            audience: {type: 'string', enum: AUDIENCE_ENUM},
            applicableTo: {type: 'object'},
            sections: {type: 'array'},
            expectedVersion: {type: 'integer', minimum: 1},
        },
    },
}, async (args, ctx) => {
    const patch: Record<string, unknown> = {};
    if (typeof args.name === 'string') patch.name = args.name;
    if (typeof args.description === 'string') patch.description = args.description;
    if (typeof args.thumbnailImageId === 'string') patch.thumbnailImageId = args.thumbnailImageId;
    if (args.audience !== undefined) patch.audience = args.audience;
    if (args.applicableTo) patch.applicableTo = args.applicableTo;
    if (args.sections) patch.sections = args.sections;
    return svc().update(
        String(args.id),
        patch as any,
        typeof args.expectedVersion === 'number' ? args.expectedVersion : undefined,
        ctx.actor,
    );
});

export const productTemplateDuplicate: McpTool = defineTool({
    name: 'productTemplate.duplicate',
    description: 'Clone any template (built-in or custom) as a fresh `builtIn:false` custom row. The `newName` defaults to "<source> (copy)" when omitted.',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        required: ['fromId'],
        properties: {
            fromId: {type: 'string'},
            newName: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    return svc().duplicate(
        String(args.fromId),
        typeof args.newName === 'string' ? args.newName : '',
        ctx.actor,
    );
});

export const productTemplateDelete: McpTool = defineTool({
    name: 'productTemplate.delete',
    description: 'Delete a custom product display template. Every product referencing it is reset to the default fallback (`built-in:standard`). Built-in templates cannot be deleted.',
    scopes: ['write:content'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args) => {
    // Phase 1.F polish — soft-delete via `ProductTemplates.trash` (24h TTL)
    // so the admin Sonner toast can Undo. The shape stays additive: existing
    // callers still see `{deleted, id, cascadedProducts}`; the new `trashId`
    // is what `productTemplate.restore` needs.
    const res = await svc().softDelete(String(args.id));
    return {deleted: true, id: args.id, cascadedProducts: res.cascadedProducts, trashId: res.trashId};
});

export const productTemplateRestore: McpTool = defineTool({
    name: 'productTemplate.restore',
    description: 'Restore a soft-deleted product display template within the 24h trash TTL. Re-inserts the snapshot and re-links every product captured in the snapshot\'s `affectedProductIds`. Idempotent — repeat calls on the same `trashId` after success are no-ops.',
    scopes: ['write:content'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['trashId'],
        properties: {
            trashId: {type: 'string'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args) => {
    return svc().restore(String(args.trashId));
});

// ─── Per-product write helper ────────────────────────────────────

export const productTemplateSet: McpTool = defineTool({
    name: 'product.template.set',
    description: 'Assign a template to one or more products. Single shape: `{productId, templateId}`. Bulk shape per F8: `{items: [{productId, templateId}]}` OR `{ids: [productId...], templateId}` (apply same template to N products). Pass `templateId: null` to clear the assignment (product falls back to default).',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        properties: {
            productId: {type: 'string'},
            templateId: {type: 'string', description: 'Empty string clears the assignment.'},
            ids: {type: 'array', items: {type: 'string'}},
            items: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['productId'],
                    properties: {
                        productId: {type: 'string'},
                        templateId: {type: 'string', description: 'Empty string clears the assignment.'},
                    },
                },
            },
        },
    },
}, async (args, ctx) => {
    const ps = productSvc();
    type Item = {productId: string; templateId: string | null};
    const norm = (v: unknown): string | null =>
        v === undefined || v === null || v === '' ? null : String(v);
    let batch: Item[];
    if (Array.isArray(args.items)) {
        batch = (args.items as any[]).map(b => ({
            productId: String(b.productId),
            templateId: norm(b.templateId),
        }));
    } else if (Array.isArray(args.ids)) {
        const templateId = norm(args.templateId);
        batch = (args.ids as string[]).map(productId => ({productId: String(productId), templateId}));
    } else if (args.productId) {
        batch = [{productId: String(args.productId), templateId: norm(args.templateId)}];
    } else {
        throw new Error('product.template.set: pass `{productId, templateId}` or `items[]` or `{ids, templateId}`');
    }
    return runBatch(
        batch.map(b => ({id: b.productId, payload: b})),
        async (_id, payload) => {
            const m = payload!;
            const current = await ps.getById(m.productId);
            if (!current) throw new Error(`product not found: ${m.productId}`);
            await ps.save({
                ...current,
                // null/empty sentinel signals "clear" via the
                // ProductService.save passthrough; explicit string keeps
                // the supplied assignment.
                templateId: m.templateId === null ? undefined : m.templateId,
            } as any, ctx.actor, current.version ?? null);
            return {productId: m.productId, templateId: m.templateId};
        },
    );
});

export const PRODUCT_TEMPLATES_TOOLS: McpTool[] = [
    productTemplateList,
    productTemplateGet,
    productTemplatePreview,
    productTemplateCreate,
    productTemplateUpdate,
    productTemplateDuplicate,
    productTemplateDelete,
    productTemplateRestore,
    productTemplateSet,
];
