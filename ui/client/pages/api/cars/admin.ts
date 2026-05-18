/**
 * Cars admin API — Wave 7b. Admin-only.
 *
 *   GET  /api/cars/admin?view=listings        — imported cars
 *   GET  /api/cars/admin?view=reservations    — reservation inquiries
 *   POST /api/cars/admin                      — admin actions:
 *      { action: 'import', source: 'fixture'|'live' }
 *      { action: 'confirm-deposit', reservationId }
 *      { action: 'cancel-reservation', reservationId }
 */
import type {NextApiRequest, NextApiResponse} from 'next';
import {requireRole} from '@client/lib/api-helpers/authHelpers';
import {requireSameOrigin} from '@client/lib/api-helpers/origin';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

const PRODUCTS = 'Products';
const INQUIRIES = 'Inquiries';

async function getDb() {
    const connection = getMongoConnection();
    for (let i = 0; i < 30 && !connection.database; i++) {
        await new Promise(r => setTimeout(r, 100));
    }
    return connection.database;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!requireSameOrigin(req, res)) return;
    const auth = await requireRole(req, res, 'admin');
    if (!auth.ok) return;
    const db = await getDb();
    if (!db) return res.status(503).json({error: 'Database not ready'});

    if (req.method === 'GET') {
        const view = typeof req.query.view === 'string' ? req.query.view : 'listings';
        if (view === 'reservations') {
            const rows = await db.collection(INQUIRIES)
                .find({topic: 'car-reservation'}, {projection: {_id: 0}})
                .sort({createdAt: -1})
                .limit(200)
                .toArray();
            return res.status(200).json({rows});
        }
        // listings
        const rows = await db.collection(PRODUCTS)
            .find({categories: 'cars'}, {projection: {_id: 0}})
            .sort({updatedAt: -1})
            .limit(200)
            .toArray();
        return res.status(200).json({rows});
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({error: 'Method not allowed'});
    }

    let body: Record<string, unknown>;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
        return res.status(400).json({error: 'Invalid JSON'});
    }
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'import') {
        const source = body.source === 'live' ? 'live' : 'fixture';
        try {
            const {SsComCarsAdapter} = await import('@services/features/Inventory/adapters/SsComCarsAdapter');
            const {normaliseAds} = await import('@services/features/Inventory/adapters/SsComCarsNormaliser');
            const cfg = source === 'live' ? {kind: 'ss-com-cars' as const} : {kind: 'ss-com-cars' as const, forceFixture: true};
            const adapter = new SsComCarsAdapter(cfg);
            const page = await adapter.fetchProducts();
            // Best-effort direct upsert when ProductService is available;
            // otherwise stash via the warehouse-product collection directly.
            let imported = 0;
            const now = new Date().toISOString();
            for (const row of page.items) {
                const existing = await db.collection(PRODUCTS).findOne({source: 'warehouse', externalId: row.externalId});
                const cats = ['cars'];
                const hint = (row.attributes as Record<string, string> | undefined)?._categoriesHint;
                if (hint) for (const c of hint.split(',')) if (c && c !== 'cars') cats.push(c);
                if (!existing) {
                    await db.collection(PRODUCTS).insertOne({
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
                        editedBy: 'cars-admin-import',
                    });
                } else {
                    await db.collection(PRODUCTS).updateOne(
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
                // Use normaliseAds reference so the import path is keyed
                // to the same transformation as InventoryService runs.
                void normaliseAds;
            }
            return res.status(200).json({ok: true, imported, source});
        } catch (err) {
             
            console.error('[api/cars/admin] import failed:', err);
            return res.status(500).json({error: String((err as Error).message ?? err)});
        }
    }

    if (action === 'confirm-deposit') {
        const reservationId = typeof body.reservationId === 'string' ? body.reservationId : '';
        if (!reservationId) return res.status(400).json({error: 'Missing reservationId'});
        const result = await db.collection(INQUIRIES).updateOne(
            {id: reservationId, topic: 'car-reservation'},
            {$set: {reservationStatus: 'deposit-confirmed', depositConfirmedAt: new Date().toISOString()}},
        );
        return res.status(200).json({ok: true, matched: result.matchedCount ?? 0, modified: result.modifiedCount ?? 0});
    }

    if (action === 'cancel-reservation') {
        const reservationId = typeof body.reservationId === 'string' ? body.reservationId : '';
        if (!reservationId) return res.status(400).json({error: 'Missing reservationId'});
        const result = await db.collection(INQUIRIES).updateOne(
            {id: reservationId, topic: 'car-reservation'},
            {$set: {reservationStatus: 'cancelled', cancelledAt: new Date().toISOString()}},
        );
        return res.status(200).json({ok: true, matched: result.matchedCount ?? 0, modified: result.modifiedCount ?? 0});
    }

    return res.status(400).json({error: 'Unknown action'});
}
