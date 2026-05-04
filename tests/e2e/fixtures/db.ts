import {MongoMemoryServer} from 'mongodb-memory-server';

// Per-worker mongodb-memory-server. Each Playwright worker holds one
// long-lived in-memory Mongo; specs reuse it across the worker's lifetime
// and partition data either by collection name or by doing a wipe in
// `beforeEach`.
//
// DECISION: per-worker (not per-test) DB. Same trade-off as the Vitest
// suite — boot is the expensive part, isolation between workers is enough
// for our test data volume.
export interface E2EMongoHandle {
    uri: string;
    dbName: string;
    stop: () => Promise<void>;
}

export async function startMongo(workerIndex: number): Promise<E2EMongoHandle> {
    // In reuse-dev mode the running dev server is bound to its own Mongo
    // (Docker on :27017 by default). Seeding into a memory-server in that
    // mode means the auth flow looks up users in a *different* database
    // than where the test inserted them — sign-in always says "wrong email
    // or password" even with a fresh user. Reuse the dev server's Mongo
    // instead so seed and auth share storage.
    if (process.env.PLAYWRIGHT_E2E_REUSE_DEV) {
        const uri = process.env.PLAYWRIGHT_E2E_MONGODB_URI
            ?? process.env.MONGODB_URI
            ?? 'mongodb://localhost:27017/DB';
        const dbName = (() => {
            try { return new URL(uri.replace('mongodb://', 'http://')).pathname.slice(1) || 'DB'; } catch { return 'DB'; }
        })();
        return {
            uri,
            dbName,
            stop: async () => {/* operator owns the dev server's Mongo */},
        };
    }

    // Isolated mode — each worker gets its own memory-server.
    const dbName = `e2e_w${workerIndex}_${Date.now()}`;
    const mongod = await MongoMemoryServer.create();
    const baseUri = mongod.getUri();
    const uri = baseUri.endsWith('/') ? `${baseUri}${dbName}` : `${baseUri}/${dbName}`;
    return {
        uri,
        dbName,
        stop: async () => {
            await mongod.stop();
        },
    };
}
