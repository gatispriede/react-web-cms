import {Collection, Db} from 'mongodb';
import guid from '@utils/guid';
import {OrderError} from '@interfaces/IOrder';
import type {ProductService} from '@services/features/Products/ProductService';

/**
 * StockReservationService — owned by the Orders module since the
 * Inventory module didn't ship a reserve/confirm/release API.
 *
 * DECISION: stock decrement happens at confirm-time, not at hold-time.
 * A held reservation just sits in `StockReservations` and doesn't move
 * `Products.stock` — so two concurrent finalizes for the last unit race
 * on a single atomic `findOneAndUpdate({stock: {$gte: qty}}, $inc)`
 * which is the correct over-sell guard. Holding-time decrement would
 * require a second matching mutation on release/sweep with its own race
 * window.
 *
 * Trade-off: a concurrent shopper sees current stock (the reserved qty
 * isn't subtracted), so two carts can both add the last unit and race
 * at finalize. The first finalize wins; the second sees `OUT_OF_STOCK`.
 * This is acceptable for v1 — the alternative (visible reservation)
 * doubles the race surface and the reserved/visible discrepancy
 * confuses customers.
 */

export type ReservationStatus = 'held' | 'confirmed' | 'released';

export interface ReservedLine {
    productId: string;
    sku: string;
    qty: number;
}

export interface StockReservationDoc {
    id: string;
    lineItems: ReservedLine[];
    expiresAt: string;
    status: ReservationStatus;
    createdAt: string;
    updatedAt: string;
}

export class StockReservationService {
    private reservations: Collection;
    private products: Collection;
    private indexesReady = false;

    constructor(private db: Db, private productService: ProductService) {
        this.reservations = db.collection('StockReservations');
        this.products = db.collection('Products');
    }

    async ensureIndexes(): Promise<void> {
        if (this.indexesReady) return;
        try {
            await this.reservations.createIndex({id: 1}, {unique: true});
            await this.reservations.createIndex({status: 1, expiresAt: 1});
            this.indexesReady = true;
        } catch (err) {
            console.error('StockReservationService.ensureIndexes:', err);
        }
    }

    private availableStock(product: any, sku: string): number {
        const variants = Array.isArray(product?.variants) ? product.variants : [];
        if (variants.length > 0) {
            const v = variants.find((x: any) => x?.sku === sku);
            if (v) return typeof v.stock === 'number' ? v.stock : 0;
        }
        return typeof product?.stock === 'number' ? product.stock : 0;
    }

    async reserve(lineItems: ReservedLine[], ttlMs: number): Promise<StockReservationDoc> {
        await this.ensureIndexes();
        if (!Array.isArray(lineItems) || lineItems.length === 0) {
            throw new OrderError('EMPTY_RESERVATION');
        }
        // Pre-flight stock check. We don't lock — confirm-time is the
        // real guard; this is a fast UX-friendly fail path.
        for (const line of lineItems) {
            const product = await this.productService.getById(line.productId);
            if (!product) throw new OrderError('PRODUCT_NOT_FOUND', {sku: line.sku});
            const stock = this.availableStock(product, line.sku);
            if (stock < line.qty) {
                throw new OrderError('OUT_OF_STOCK', {sku: line.sku, available: stock, requested: line.qty});
            }
        }
        const now = new Date();
        const doc: StockReservationDoc = {
            id: guid(),
            lineItems: lineItems.map(l => ({productId: l.productId, sku: l.sku, qty: l.qty})),
            expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
            status: 'held',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
        };
        await this.reservations.insertOne(doc as any);
        return doc;
    }

    async getById(id: string): Promise<StockReservationDoc | null> {
        await this.ensureIndexes();
        const doc = await this.reservations.findOne({id}, {projection: {_id: 0}});
        return doc as StockReservationDoc | null;
    }

    /**
     * Atomically decrement stock per line and mark the reservation
     * confirmed. Each `$inc` is gated by a `stock >= qty` filter; if any
     * line fails we throw `OUT_OF_STOCK` and leave previously-decremented
     * lines as-is (caller can release the reservation). v1 accepts this
     * partial-failure window; the alternative (multi-doc transaction)
     * needs a Mongo replica set, which the dev/test setup doesn't have.
     */
    async confirm(reservationId: string): Promise<StockReservationDoc> {
        await this.ensureIndexes();
        const doc = await this.reservations.findOne({id: reservationId});
        if (!doc) throw new OrderError('RESERVATION_NOT_FOUND', {reservationId});
        if ((doc as any).status === 'confirmed') return doc as unknown as StockReservationDoc;
        if ((doc as any).status === 'released') throw new OrderError('RESERVATION_RELEASED', {reservationId});
        for (const line of (doc as any).lineItems as ReservedLine[]) {
            // Variant-aware decrement. The variant inside `variants[]` has
            // its own `stock`; if there are no variants we touch parent.
            const product = await this.products.findOne({id: line.productId});
            if (!product) throw new OrderError('PRODUCT_NOT_FOUND', {sku: line.sku});
            const variants = Array.isArray((product as any).variants) ? (product as any).variants : [];
            const hasVariant = variants.some((v: any) => v?.sku === line.sku);
            let res: any;
            if (hasVariant) {
                res = await this.products.findOneAndUpdate(
                    {id: line.productId, 'variants.sku': line.sku, 'variants.stock': {$gte: line.qty}},
                    {$inc: {'variants.$.stock': -line.qty}, $set: {updatedAt: new Date().toISOString()}},
                    {returnDocument: 'after'},
                );
            } else {
                res = await this.products.findOneAndUpdate(
                    {id: line.productId, stock: {$gte: line.qty}},
                    {$inc: {stock: -line.qty}, $set: {updatedAt: new Date().toISOString()}},
                    {returnDocument: 'after'},
                );
            }
            const updated = (res && (res as any).value !== undefined) ? (res as any).value : res;
            if (!updated) throw new OrderError('OUT_OF_STOCK', {sku: line.sku});
        }
        const now = new Date().toISOString();
        await this.reservations.updateOne(
            {id: reservationId},
            {$set: {status: 'confirmed', updatedAt: now}},
        );
        return {...(doc as any), status: 'confirmed', updatedAt: now} as StockReservationDoc;
    }

    async release(reservationId: string): Promise<void> {
        await this.ensureIndexes();
        const now = new Date().toISOString();
        await this.reservations.updateOne(
            {id: reservationId, status: 'held'},
            {$set: {status: 'released', updatedAt: now}},
        );
    }

    /** Returns reservation IDs that were swept. */
    async sweep(now: Date = new Date()): Promise<string[]> {
        await this.ensureIndexes();
        const cutoff = now.toISOString();
        const docs = await this.reservations
            .find({status: 'held', expiresAt: {$lt: cutoff}}, {projection: {id: 1}})
            .toArray();
        const ids = docs.map(d => (d as any).id as string);
        if (ids.length === 0) return [];
        await this.reservations.updateMany(
            {id: {$in: ids}, status: 'held'},
            {$set: {status: 'released', updatedAt: cutoff}},
        );
        return ids;
    }
}
