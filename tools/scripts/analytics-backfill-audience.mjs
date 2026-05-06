#!/usr/bin/env node
/**
 * Backfill `audience` on every Analytics row in the rolling 90-day
 * retention window. Per `docs/features/platform/client-analytics.md` v2
 * (2026-05-06).
 *
 * Logic per row:
 *   - `ua.device === 'bot'`      → 'bot'    (rare on old rows, but safe)
 *   - `userId` matches a Users.role of admin/editor/viewer (any logged-in
 *     CMS user, never a customer) → 'admin'
 *   - everything else            → 'public'
 *
 * Rows already carrying an `audience` are SKIPPED so re-runs are a no-op.
 * IP allowlist (audience: 'internal') can't be backfilled — we never
 * stored the IP — those rows stay 'public'. The admin can still re-tag
 * future traffic by adding their IP at /admin/system/analytics-filters.
 *
 * Usage:
 *   MONGODB_URI=mongodb://localhost:27017 node tools/scripts/analytics-backfill-audience.mjs
 *   MONGODB_URI=...                       node tools/scripts/analytics-backfill-audience.mjs --dry-run
 */
import {MongoClient} from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME     = process.env.MONGODB_DB || 'DB';
const DRY_RUN     = process.argv.includes('--dry-run');
const BATCH_SIZE  = 1000;

async function main() {
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    const analytics = db.collection('Analytics');
    const users = db.collection('Users');

    process.stdout.write(`[backfill] connected to ${MONGODB_URI}/${DB_NAME}\n`);
    if (DRY_RUN) process.stdout.write('[backfill] DRY RUN — no writes will happen\n');

    // 1) Gather the admin userId set once. Joining row-by-row would be O(n)
    //    Mongo round-trips; the admin user count is small (< few hundred)
    //    so a single set in memory is the right move.
    const adminUserIds = new Set();
    {
        const cursor = users.find(
            {role: {$in: ['admin', 'editor', 'viewer']}, kind: {$exists: false}},
            {projection: {_id: 1, email: 1}},
        );
        for await (const u of cursor) {
            // The trackEvent path stamps `email` as `userId` for admin
            // sessions and `customerId` for customer sessions. Backfill
            // matches on email so old admin rows resolve correctly.
            if (u.email) adminUserIds.add(String(u.email));
            adminUserIds.add(String(u._id));
        }
        process.stdout.write(`[backfill] ${adminUserIds.size} admin identifiers loaded\n`);
    }

    // 2) Walk rows missing `audience`. Two passes — admin first (cheaper
    //    targeted match), then a sweeping default-to-public.
    const adminFilter = {audience: {$exists: false}, userId: {$in: Array.from(adminUserIds)}};
    const adminCount = await analytics.countDocuments(adminFilter);
    process.stdout.write(`[backfill] tagging ${adminCount} rows as audience=admin\n`);
    if (!DRY_RUN && adminCount > 0) {
        const r = await analytics.updateMany(adminFilter, {$set: {audience: 'admin'}});
        process.stdout.write(`[backfill]  → ${r.modifiedCount} admin rows updated\n`);
    }

    const botFilter = {audience: {$exists: false}, 'ua.device': 'bot'};
    const botCount = await analytics.countDocuments(botFilter);
    if (botCount > 0) {
        process.stdout.write(`[backfill] tagging ${botCount} rows as audience=bot\n`);
        if (!DRY_RUN) {
            const r = await analytics.updateMany(botFilter, {$set: {audience: 'bot'}});
            process.stdout.write(`[backfill]  → ${r.modifiedCount} bot rows updated\n`);
        }
    }

    const remaining = {audience: {$exists: false}};
    const publicCount = await analytics.countDocuments(remaining);
    process.stdout.write(`[backfill] tagging ${publicCount} remaining rows as audience=public\n`);
    if (!DRY_RUN && publicCount > 0) {
        // Chunk the update by ts — Mongo is happy with one big updateMany,
        // but if the collection is huge, paginating keeps it within the
        // 16MB op-log entry budget.
        let scanned = 0;
        while (true) {
            const ids = await analytics
                .find(remaining, {projection: {_id: 1}})
                .limit(BATCH_SIZE)
                .toArray();
            if (ids.length === 0) break;
            const r = await analytics.updateMany(
                {_id: {$in: ids.map(d => d._id)}},
                {$set: {audience: 'public'}},
            );
            scanned += r.modifiedCount;
            process.stdout.write(`[backfill]  → ${scanned}/${publicCount} public rows updated\n`);
        }
    }

    process.stdout.write('[backfill] done\n');
    await client.close();
}

main().catch(err => {
    process.stderr.write(`[backfill] fatal: ${err.stack || err}\n`);
    process.exit(1);
});
