import {Db, MongoClient} from 'mongodb';
import {hash} from 'bcrypt';
import guid from '@utils/guid';

// **The only direct-Mongo write the e2e suite is allowed to do is the
//   admin user.** Every other piece of state — pages, sections, themes,
//   products, orders, translations — must be authored by that admin
//   through the admin UI in-test. That's the rule the suite is built
//   around: tests exercise the real authoring path (auth, audit,
//   permission gating, validation, revalidate). Page / section / theme
//   factories used to live here; they were removed when the rule
//   landed. Complex multi-feature scenarios that need a richer starting
//   state will go through `BundleService.import` (Phase D), which is
//   itself a permission-gated user-facing operation.

export interface SeedAdminInput {
    email?: string;
    password?: string;
    name?: string;
    role?: 'admin' | 'editor' | 'viewer';
}

export interface SeededAdmin {
    id: string;
    email: string;
    password: string;     // plaintext, for the spec to log in with
    passwordHash: string;
    /** Removes this seeded user from the DB. Idempotent. */
    cleanup: () => Promise<void>;
}

export async function withDb<T>(uri: string, fn: (db: Db) => Promise<T>): Promise<T> {
    const client = await MongoClient.connect(uri);
    try {
        // The next-server defaults to db('DB') in mongoDBConnection.ts; if
        // the URI carries a different default DB the client will use that
        // instead. We respect that and let the seeded data land in the same
        // DB the server reads.
        const db = client.db();
        return await fn(db);
    } finally {
        await client.close();
    }
}

export async function seedAdmin(uri: string, input: SeedAdminInput = {}): Promise<SeededAdmin> {
    // Per-test admin: unique email by default so parallel tests can't collide
    // and test cleanup can target this row exactly. Caller may override the
    // email when a spec wants a deterministic identity.
    const id = guid();
    const email = (input.email ?? `e2e-admin-${id}@e2e.local`).toLowerCase();
    const password = input.password ?? 'test-admin-pw';
    const passwordHash = await hash(password, 4);
    await withDb(uri, async db => {
        const users = db.collection('Users');
        await users.insertOne({
            id,
            name: input.name ?? `E2E Admin ${id.slice(0, 6)}`,
            email,
            password: passwordHash,
            role: input.role ?? 'admin',
            kind: 'admin',
            canPublishProduction: true,
            mustChangePassword: false,
        } as any);
    });
    let cleaned = false;
    const cleanup = async () => {
        if (cleaned) return;
        cleaned = true;
        await withDb(uri, async db => {
            await db.collection('Users').deleteOne({id});
        });
    };
    return {id, email, password, passwordHash, cleanup};
}
