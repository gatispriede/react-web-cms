import {Collection, Db} from 'mongodb';

/**
 * Atomic per-year order-number counter. Uses a `Counters` collection
 * with a single doc per year keyed `orders.YYYY`, incremented via
 * `findOneAndUpdate({$inc:1, upsert:true, returnDocument:'after'})` so
 * concurrent calls never collide.
 */
export class OrderCounter {
    private counters: Collection;
    private indexesReady = false;

    constructor(db: Db) {
        this.counters = db.collection('Counters');
    }

    private async ensureIndexes(): Promise<void> {
        if (this.indexesReady) return;
        try {
            await this.counters.createIndex({key: 1}, {unique: true});
            this.indexesReady = true;
        } catch (err) {
            console.error('OrderCounter.ensureIndexes:', err);
        }
    }

    async next(now: Date = new Date()): Promise<string> {
        await this.ensureIndexes();
        const year = now.getUTCFullYear();
        const key = `orders.${year}`;
        const result = await this.counters.findOneAndUpdate(
            {key},
            {$inc: {value: 1}, $setOnInsert: {key, createdAt: now.toISOString()}},
            {upsert: true, returnDocument: 'after'},
        );
        const doc = (result as any)?.value ?? result;
        const value = (doc && typeof doc === 'object' && typeof doc.value === 'number') ? doc.value : 1;
        return `ORD-${year}-${String(value).padStart(6, '0')}`;
    }
}
