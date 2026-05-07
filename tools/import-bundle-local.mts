/**
 * One-shot bundle import → local Mongo. Bypasses MCP token scopes.
 * Run: npx tsx --tsconfig services/tsconfig.custom.json tools/import-bundle-local.mts <bundle.json>
 *
 * Used to seed local dev with prod content for visual iteration before
 * pushing changes back. Local Mongo is treated as cattle — overwrite is
 * fine (the canonical content lives on the prod droplet's volume).
 */
import {readFileSync} from 'node:fs';
import {MongoClient} from 'mongodb';
import {BundleService} from '@services/features/Bundle/BundleService';

const path = process.argv[2];
if (!path) { console.error('usage: tsx ... import-bundle-local.mts <bundle.json>'); process.exit(2); }
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'DB';

const bundle = JSON.parse(readFileSync(path, 'utf8'));
const client = await MongoClient.connect(uri);
try {
    const svc = new BundleService(client.db(dbName));
    const out = await svc.import(bundle);
    console.log(JSON.stringify(out, null, 2));
} finally {
    await client.close();
}
