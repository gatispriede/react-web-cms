/**
 * Wave 7b — Cars MCP tools.
 *
 *   cars.list                   — list cars (Products with categories:['cars'])
 *   cars.get                    — fetch one car by slug
 *   cars.import                 — manually trigger import from fixture or live
 *   cars.reservation.list       — list reservation inquiries
 *   cars.reservation.confirm    — confirm deposit on a pending reservation
 *   cars.reservation.cancel     — cancel a reservation
 *
 * Storage is the existing `Products` + `Inquiries` Mongo collections; we
 * use the connection's `database` handle directly (matches the
 * `inquiries.ts` MCP-tool pattern) since there is no dedicated Cars
 * service surface — the adapter shape is the integration point.
 */
import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {defineTool} from './_shared';

const PRODUCTS = 'Products';
const INQUIRIES = 'Inquiries';

async function db() {
    const conn = getMongoConnection();
    const d = conn?.database;
    if (!d) throw new Error('Database not ready');
    return d;
}

export const carsList: McpTool = defineTool({
    // SAFE: read-only
    name: 'cars.list',
    description: 'List imported car listings (Products with categories=cars). Honours sort/make/fuel filters.',
    scopes: ['read:products'],
    inputSchema: {
        type: 'object',
        properties: {
            limit: {type: 'integer', minimum: 1, maximum: 500},
            sort: {type: 'string', enum: ['recent', 'price-asc', 'price-desc', 'year-desc', 'mileage-asc']},
            make: {type: 'string'},
            fuel: {type: 'string', enum: ['diesel', 'petrol', 'hybrid', 'phev', 'electric', 'lpg', 'cng']},
            includeDrafts: {type: 'boolean'},
        },
    },
}, async (args) => {
    const d = await db();
    const limit = Math.min(500, Math.max(1, Number(args.limit ?? 50)));
    const sort = typeof args.sort === 'string' ? args.sort : 'recent';
    const sortSpec: Record<string, 1 | -1> =
        sort === 'price-asc' ? {price: 1}
            : sort === 'price-desc' ? {price: -1}
                : sort === 'year-desc' ? {'attributes.year': -1}
                    : sort === 'mileage-asc' ? {'attributes.mileage_km': 1}
                        : {updatedAt: -1};
    const filter: Record<string, unknown> = {categories: 'cars'};
    if (!args.includeDrafts) filter.draft = {$ne: true};
    if (typeof args.make === 'string') filter['attributes.make'] = args.make.toLowerCase();
    if (typeof args.fuel === 'string') filter['attributes.fuel'] = args.fuel.toLowerCase();
    const rows = await d.collection(PRODUCTS)
        .find(filter, {projection: {_id: 0}})
        .sort(sortSpec)
        .limit(limit)
        .toArray();
    return {rows};
});

export const carsGet: McpTool = defineTool({
    // SAFE: read-only
    name: 'cars.get',
    description: 'Fetch one car by slug.',
    scopes: ['read:products'],
    inputSchema: {
        type: 'object',
        required: ['slug'],
        properties: {slug: {type: 'string', minLength: 1}},
    },
}, async (args) => {
    const d = await db();
    const row = await d.collection(PRODUCTS).findOne(
        {slug: args.slug, categories: 'cars'},
        {projection: {_id: 0}},
    );
    return {car: row ?? null};
});

export const carsImport: McpTool = defineTool({
    name: 'cars.import',
    description: 'Manually trigger a ss.com cars import. `source: "fixture"` reads the committed JSON fixture; `source: "live"` requires SSCOM_FETCH_ENABLED=true + SSCOM_FETCH_URL set.',
    scopes: ['write:products'],
    idempotent: true,
    auditScope: 'cars',
    inputSchema: {
        type: 'object',
        properties: {
            source: {type: 'string', enum: ['fixture', 'live']},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'cars.import');
    const source = args.source === 'live' ? 'live' : 'fixture';
    const {SsComCarsAdapter} = await import('@services/features/Inventory/adapters/SsComCarsAdapter');
    const cfg = source === 'live'
        ? {kind: 'ss-com-cars' as const}
        : {kind: 'ss-com-cars' as const, forceFixture: true};
    const adapter = new SsComCarsAdapter(cfg);
    const page = await adapter.fetchProducts();
    const d = await db();
    const now = new Date().toISOString();
    let imported = 0;
    for (const row of page.items) {
        const existing = await d.collection(PRODUCTS).findOne({source: 'warehouse', externalId: row.externalId});
        const cats = ['cars'];
        const hint = (row.attributes as Record<string, string> | undefined)?._categoriesHint;
        if (hint) for (const c of hint.split(',')) if (c && c !== 'cars') cats.push(c);
        if (!existing) {
            await d.collection(PRODUCTS).insertOne({
                id: row.externalId,
                sku: row.sku,
                title: row.title,
                slug: row.externalId.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
                description: row.description ?? '',
                price: row.priceCents,
                currency: row.currency,
                stock: row.stock,
                images: row.images ?? [],
                categories: cats,
                attributes: row.attributes ?? {},
                variants: [],
                source: 'warehouse',
                externalId: row.externalId,
                manualOverrides: [],
                draft: false,
                createdAt: now,
                updatedAt: now,
                version: 1,
                editedBy: 'mcp:cars.import',
            });
        } else {
            await d.collection(PRODUCTS).updateOne(
                {source: 'warehouse', externalId: row.externalId},
                {
                    $set: {
                        price: row.priceCents,
                        stock: row.stock,
                        images: row.images ?? existing.images,
                        attributes: row.attributes ?? existing.attributes,
                        categories: cats,
                        updatedAt: now,
                    },
                },
            );
        }
        imported++;
    }
    return {imported, source};
});

export const carsReservationList: McpTool = defineTool({
    // SAFE: read-only
    name: 'cars.reservation.list',
    description: 'List car reservation inquiries (Inquiries with topic=car-reservation), newest first.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            limit: {type: 'integer', minimum: 1, maximum: 500},
            status: {type: 'string', enum: ['pending', 'deposit-confirmed', 'cancelled']},
        },
    },
}, async (args) => {
    const d = await db();
    const limit = Math.min(500, Math.max(1, Number(args.limit ?? 100)));
    const filter: Record<string, unknown> = {topic: 'car-reservation'};
    if (typeof args.status === 'string') filter.reservationStatus = args.status;
    const rows = await d.collection(INQUIRIES)
        .find(filter, {projection: {_id: 0}})
        .sort({createdAt: -1})
        .limit(limit)
        .toArray();
    return {rows};
});

export const carsReservationConfirm: McpTool = defineTool({
    // SAFE: direct collection write — not a GraphQL mutation
    name: 'cars.reservation.confirm',
    description: 'Confirm the deposit on a pending car reservation. Operator action — does not auto-charge.',
    scopes: ['write:content'],
    idempotent: true,
    auditScope: 'cars',
    inputSchema: {
        type: 'object',
        required: ['reservationId'],
        properties: {
            reservationId: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'cars.reservation.confirm');
    const d = await db();
    const res = await d.collection(INQUIRIES).updateOne(
        {id: args.reservationId, topic: 'car-reservation'},
        {$set: {reservationStatus: 'deposit-confirmed', depositConfirmedAt: new Date().toISOString()}},
    );
    return {matched: res.matchedCount ?? 0, modified: res.modifiedCount ?? 0};
});

export const carsReservationCancel: McpTool = defineTool({
    // SAFE: direct collection write
    name: 'cars.reservation.cancel',
    description: 'Cancel a car reservation (sets reservationStatus to "cancelled").',
    scopes: ['write:content'],
    idempotent: true,
    auditScope: 'cars',
    inputSchema: {
        type: 'object',
        required: ['reservationId'],
        properties: {
            reservationId: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'cars.reservation.cancel');
    const d = await db();
    const res = await d.collection(INQUIRIES).updateOne(
        {id: args.reservationId, topic: 'car-reservation'},
        {$set: {reservationStatus: 'cancelled', cancelledAt: new Date().toISOString()}},
    );
    return {matched: res.matchedCount ?? 0, modified: res.modifiedCount ?? 0};
});

export const CARS_TOOLS: McpTool[] = [
    carsList,
    carsGet,
    carsImport,
    carsReservationList,
    carsReservationConfirm,
    carsReservationCancel,
];
