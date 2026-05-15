/**
 * Cars storefront API — Wave 7b. GET endpoints only.
 *
 *   GET /api/cars           — list cars (Products with categories:['cars'])
 *   GET /api/cars?slug=…    — fetch one car by slug
 *
 * POST /api/cars/reserve lives in `./cars/reserve.ts` (Next routes one
 * file per path segment).
 */
import type {NextApiRequest, NextApiResponse} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

const PRODUCTS = 'Products';
const isString = (v: unknown): v is string => typeof v === 'string';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({error: 'Method not allowed'});
    }

    const connection = getMongoConnection();
    for (let i = 0; i < 30 && !connection.database; i++) {
        await new Promise(r => setTimeout(r, 100));
    }
    const db = connection.database;
    if (!db) return res.status(503).json({error: 'Database not ready'});

    const slug = isString(req.query.slug) ? req.query.slug : '';
    if (slug) {
        const row = await db.collection(PRODUCTS).findOne(
            {slug, categories: 'cars', draft: {$ne: true}},
            {projection: {_id: 0}},
        );
        if (!row) return res.status(404).json({error: 'Not found'});
        return res.status(200).json(row);
    }

    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    const sort = isString(req.query.sort) ? req.query.sort : 'recent';
    const sortSpec: Record<string, 1 | -1> =
        sort === 'price-asc' ? {price: 1}
            : sort === 'price-desc' ? {price: -1}
                : sort === 'year-desc' ? {'attributes.year': -1}
                    : sort === 'mileage-asc' ? {'attributes.mileage_km': 1}
                        : {updatedAt: -1};

    const filter: Record<string, unknown> = {categories: 'cars', draft: {$ne: true}};
    const make = isString(req.query.make) ? req.query.make.toLowerCase() : '';
    const fuel = isString(req.query.fuel) ? req.query.fuel.toLowerCase() : '';
    if (make) filter['attributes.make'] = make;
    if (fuel) filter['attributes.fuel'] = fuel;

    const rows = await db
        .collection(PRODUCTS)
        .find(filter, {projection: {_id: 0}})
        .sort(sortSpec)
        .limit(limit)
        .toArray();
    return res.status(200).json({rows});
}
