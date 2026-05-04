import {Db, MongoClient} from 'mongodb';
import {hash} from 'bcrypt';
import guid from '@utils/guid';
import type {IProduct} from '@interfaces/IProduct';
import type {IOrder, IOrderLineItem, OrderStatus} from '@interfaces/IOrder';

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
        // The next-server pins `db('DB')` in mongoDBConnection.ts. The
        // memory-server URI doesn't include a default db, so a bare
        // `client.db()` would land on `test` and the server would never
        // see the seeded admin → "Wrong email or password" on every
        // login. Override `MONGODB_SEED_DB` if a future server pivot
        // away from `'DB'` ever lands.
        const db = client.db(process.env.MONGODB_SEED_DB || 'DB');
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

// ──────────────────────────────────────────────────────────────────
// Phase-2 (e-commerce) factories.
//
// These break the "admin-UI-authoring only" rule on purpose: the
// products/orders specs need a deterministic starting state to assert
// storefront → cart → checkout flows in O(1) setup time. Authoring a
// product through the admin Drawer per-test would burn 10–20 s per
// spec on form interactions before the *actual* assertions even run.
//
// Both factories return a `cleanup()` and register through the
// caller-supplied `register(cleanup)` so tests can teardown via a
// single `afterEach` in the suite (see ecommerce/*.spec.ts).
// ──────────────────────────────────────────────────────────────────

export interface SeedProductInput {
    slug?: string;
    name?: string;
    /** Minor units (e.g. cents). Default 1999. */
    price?: number;
    stock?: number;
    image?: string;
    sku?: string;
    currency?: string;
}

export interface SeededProduct {
    id: string;
    slug: string;
    sku: string;
    cleanup: () => Promise<void>;
}

export async function seedProduct(uri: string, input: SeedProductInput = {}): Promise<SeededProduct> {
    const id = guid();
    const slug = (input.slug ?? `e2e-product-${id.slice(0, 6)}`).toLowerCase();
    // sku == slug by default so cart-line testids (`cart-item-row-${sku}`)
    // line up with the spec's `${slug}` substitution.
    const sku = (input.sku ?? slug).toUpperCase();
    const now = new Date().toISOString();
    const product: IProduct = {
        id,
        sku,
        slug,
        title: input.name ?? 'E2E Product',
        description: '',
        price: input.price ?? 1999,
        currency: input.currency ?? 'EUR',
        stock: input.stock ?? 10,
        images: input.image ? [input.image] : [],
        categories: [],
        attributes: {},
        variants: [],
        source: 'manual',
        draft: false,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
        version: 1,
    };
    await withDb(uri, async db => {
        await db.collection('Products').insertOne(product as any);
    });
    let cleaned = false;
    const cleanup = async () => {
        if (cleaned) return;
        cleaned = true;
        await withDb(uri, async db => {
            await db.collection('Products').deleteOne({id});
        });
    };
    // Cart-line testid uses sku; storefront testid uses slug. Tests need
    // both, so we expose both.
    return {id, slug, sku, cleanup};
}

export interface SeedOrderLineInput {
    productSlug: string;
    qty: number;
    /** Snapshot price (minor units). Default 1999. */
    unitPrice?: number;
    title?: string;
    sku?: string;
}

export interface SeedOrderInput {
    customerEmail?: string;
    lines: SeedOrderLineInput[];
    status?: OrderStatus;
    currency?: string;
}

export interface SeededOrder {
    id: string;
    orderNumber: string;
    cleanup: () => Promise<void>;
}

export async function seedOrder(uri: string, input: SeedOrderInput): Promise<SeededOrder> {
    const id = guid();
    const orderNumber = `E2E-${id.slice(0, 6).toUpperCase()}`;
    const currency = input.currency ?? 'EUR';
    const now = new Date().toISOString();
    const lineItems: IOrderLineItem[] = input.lines.map(line => {
        const unitPrice = line.unitPrice ?? 1999;
        return {
            productId: line.productSlug, // back-compat: tests don't have a product id
            sku: line.sku ?? line.productSlug,
            title: line.title ?? line.productSlug,
            quantity: line.qty,
            unitPrice,
            lineTotal: unitPrice * line.qty,
        };
    });
    const subtotal = lineItems.reduce((acc, l) => acc + l.lineTotal, 0);
    const status: OrderStatus = input.status ?? 'paid';
    const order: IOrder = {
        id,
        orderNumber,
        guestEmail: input.customerEmail,
        lineItems,
        subtotal,
        shippingTotal: 0,
        taxTotal: 0,
        discountTotal: 0,
        total: subtotal,
        currency,
        idempotencyKeys: {},
        status,
        statusHistory: [{status, at: now, by: 'e2e-fixture'}],
        createdAt: now,
        updatedAt: now,
        version: 1,
    };
    await withDb(uri, async db => {
        await db.collection('Orders').insertOne(order as any);
    });
    let cleaned = false;
    const cleanup = async () => {
        if (cleaned) return;
        cleaned = true;
        await withDb(uri, async db => {
            await db.collection('Orders').deleteOne({id});
        });
    };
    return {id, orderNumber, cleanup};
}

/**
 * Tiny per-test cleanup registry — specs call `register(cleanup)` after
 * each seed call, then a single `afterEach` invokes `flush()` to remove
 * everything. Keeping it inline (rather than a shared singleton) so
 * parallel specs in the same worker don't bleed cleanups across tests.
 */
export interface CleanupRegistry {
    register: (cleanup: () => Promise<void>) => void;
    flush: () => Promise<void>;
}

export function createCleanupRegistry(): CleanupRegistry {
    const cleanups: Array<() => Promise<void>> = [];
    return {
        register: (cleanup) => { cleanups.push(cleanup); },
        flush: async () => {
            // LIFO — orders before products before users, matches insert order.
            while (cleanups.length) {
                const fn = cleanups.pop()!;
                try { await fn(); } catch { /* idempotent — ignore */ }
            }
        },
    };
}
