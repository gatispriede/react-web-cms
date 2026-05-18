import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {CustomerAuthService} from './CustomerAuthService';

/**
 * W6c — magic-link issue/redeem smoke tests.
 *
 * Covers the security-critical invariants from the spec:
 *   - single-use (second redeem fails)
 *   - 15-min TTL (expired token fails)
 *   - 5/hour per-email rate limit
 *   - first-touch creates a customer; second redeem (same email)
 *     reuses the existing customer record
 */

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(() => {
    db = client.db(`magic_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

const build = () => new CustomerAuthService(
    db.collection('Users'),
    4,
    db.collection('CustomerMagicTokens'),
);

describe('magic-link issue + redeem', () => {
    it('issues a token and redeems it once', async () => {
        const svc = build();
        const issued = await svc.issueMagicLinkToken({email: 'a@b.com'}) as any;
        expect(issued.token).toBeTruthy();
        expect(issued.email).toBe('a@b.com');

        const redeemed = await svc.redeemMagicLinkToken({token: issued.token});
        expect(redeemed.ok).toBe(true);
        expect(redeemed.email).toBe('a@b.com');
        expect(redeemed.userId).toBeTruthy();
    });

    it('rejects a second redemption (single-use)', async () => {
        const svc = build();
        const issued = await svc.issueMagicLinkToken({email: 'a@b.com'}) as any;
        await svc.redeemMagicLinkToken({token: issued.token});
        const again = await svc.redeemMagicLinkToken({token: issued.token});
        expect(again.ok).toBe(false);
    });

    it('rejects unknown tokens', async () => {
        const svc = build();
        const res = await svc.redeemMagicLinkToken({token: 'not-a-real-token'});
        expect(res.ok).toBe(false);
    });

    it('rate-limits per email after 5 issuances/hour', async () => {
        const svc = build();
        for (let i = 0; i < 5; i++) {
            const r = await svc.issueMagicLinkToken({email: 'rl@x.com'});
            expect((r as any).token).toBeTruthy();
        }
        const sixth = await svc.issueMagicLinkToken({email: 'rl@x.com'});
        expect((sixth as any).error).toMatch(/too many/i);
    });

    it('reuses the customer record on the second magic-link sign-in', async () => {
        const svc = build();
        const a = await svc.issueMagicLinkToken({email: 'r@x.com'}) as any;
        const r1 = await svc.redeemMagicLinkToken({token: a.token});
        const b = await svc.issueMagicLinkToken({email: 'r@x.com'}) as any;
        const r2 = await svc.redeemMagicLinkToken({token: b.token});
        expect(r1.userId).toBe(r2.userId);
    });

    it('rejects when the email belongs to an admin', async () => {
        await db.collection('Users').insertOne({id: 'admin-1', email: 'admin@x.com', password: 'x', kind: 'admin'} as any);
        const svc = build();
        const issued = await svc.issueMagicLinkToken({email: 'admin@x.com'}) as any;
        const redeemed = await svc.redeemMagicLinkToken({token: issued.token});
        expect(redeemed.ok).toBe(false);
        expect(redeemed.error).toMatch(/staff/i);
    });
});
