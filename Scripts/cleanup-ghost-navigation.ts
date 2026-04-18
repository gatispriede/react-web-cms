/**
 * One-shot cleanup: remove legacy Navigation docs that are missing the
 * `type: 'navigation'` marker. These came from an older `updateNavigation`
 * path that upserted a bare `{page, sections}` row on first reorder.
 * The admin now filters on `type: 'navigation'` so these are invisible, but
 * they still occupy disk and show up in raw dumps.
 *
 * Usage (from repo root):
 *   npx tsx --tsconfig src/Server/tsconfig.custom.json Scripts/cleanup-ghost-navigation.ts
 *
 * Dry-run is the default; pass `--apply` to actually delete.
 */
import {getMongoConnection} from '../src/Server/mongoDBConnection';

async function main() {
    const apply = process.argv.includes('--apply');
    const conn = getMongoConnection();
    // Wait for the client to come up.
    for (let i = 0; i < 50 && !(conn as any).db; i++) {
        await new Promise(r => setTimeout(r, 100));
    }
    const db = (conn as any).db;
    if (!db) {
        console.error('Mongo never connected — is it running?');
        process.exit(1);
    }
    const navigation = db.collection('Navigation');
    const ghosts = await navigation
        .find({type: {$ne: 'navigation'}}, {projection: {_id: 1, page: 1, sections: 1}})
        .toArray();
    if (ghosts.length === 0) {
        console.log('No ghost Navigation docs found. Nothing to do.');
        process.exit(0);
    }
    console.log(`Found ${ghosts.length} ghost Navigation docs:`);
    for (const g of ghosts) console.log(`  - ${g._id}  page=${(g as any).page}`);
    if (!apply) {
        console.log('\nDry run complete. Re-run with --apply to delete.');
        process.exit(0);
    }
    const result = await navigation.deleteMany({type: {$ne: 'navigation'}});
    console.log(`\nDeleted ${result.deletedCount} ghost docs.`);
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
