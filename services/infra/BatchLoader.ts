/**
 * Micro-task tick aggregator — the DataLoader fold-in for ServiceLoader.
 *
 * One `BatchLoader<K, V>` per (request, accessor). Reads queued during
 * the same micro-task tick fold into a single backend call:
 *
 *   const loader = new BatchLoader(ids => svc.getManyByIds(ids));
 *   const [a, b, c] = await Promise.all([
 *     loader.load('1'), loader.load('2'), loader.load('1'),
 *   ]);
 *   // → svc.getManyByIds(['1','2']) called once; load('1') de-duped.
 *
 * No new dependency — this is ~50 lines of bookkeeping. `dataloader`
 * (the package) is overkill for our use case; we don't need the cache
 * map persisting across ticks (request-scoped instances handle that).
 *
 * Shape contract for the batch fn:
 *   - input: unique keys in declaration order
 *   - output: parallel array of values OR `null` for "not found"
 *   - throwing rejects every pending `load()` for that tick
 */
export type BatchFn<K, V> = (keys: readonly K[]) => Promise<readonly (V | null)[]>;

export class BatchLoader<K, V> {
    private queue: Array<{key: K; resolve: (v: V | null) => void; reject: (err: unknown) => void}> = [];
    private scheduled = false;

    constructor(private readonly batchFn: BatchFn<K, V>) {}

    /**
     * Enqueue a key for the next tick. Identical keys within a tick
     * resolve from a single backend call — same value handed to every
     * caller.
     */
    load(key: K): Promise<V | null> {
        return new Promise<V | null>((resolve, reject) => {
            this.queue.push({key, resolve, reject});
            if (!this.scheduled) {
                this.scheduled = true;
                queueMicrotask(() => this.flush());
            }
        });
    }

    private async flush(): Promise<void> {
        const pending = this.queue;
        this.queue = [];
        this.scheduled = false;
        if (pending.length === 0) return;

        // Dedupe — first occurrence wins for ordering; every duplicate
        // resolver gets the same value back.
        const seen = new Map<K, number>();
        const uniqueKeys: K[] = [];
        for (const p of pending) {
            if (!seen.has(p.key)) {
                seen.set(p.key, uniqueKeys.length);
                uniqueKeys.push(p.key);
            }
        }

        try {
            const results = await this.batchFn(uniqueKeys);
            if (results.length !== uniqueKeys.length) {
                throw new Error(`BatchLoader: batchFn returned ${results.length} results for ${uniqueKeys.length} keys`);
            }
            for (const p of pending) {
                const idx = seen.get(p.key)!;
                p.resolve(results[idx] ?? null);
            }
        } catch (err) {
            for (const p of pending) p.reject(err);
        }
    }
}
