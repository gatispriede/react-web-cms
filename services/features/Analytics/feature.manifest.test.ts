import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {analyticsFeature} from './feature.manifest';
import {AnalyticsService} from './AnalyticsService';

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
    db = client.db(`analytics_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('analyticsFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(analyticsFeature.id).toBe('analytics');
        expect(analyticsFeature.displayName).toBe('Analytics');
    });

    it('services factory returns an `analytics` key holding an AnalyticsService', () => {
        const built = analyticsFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built && Object.keys(built)).toEqual(['analytics']);
        expect(built?.analytics).toBeInstanceOf(AnalyticsService);
    });

    it('declares the Analytics collection indexes (TTL + dedupe + dashboard query patterns)', () => {
        const idxs = analyticsFeature.indexes ?? [];
        for (const i of idxs) expect(i.collection).toBe('Analytics');
        const ttl = idxs.find(i => i.spec.ts === 1 && i.options?.expireAfterSeconds);
        expect(ttl).toBeDefined();
        const dedupe = idxs.find(i => i.spec.id === 1);
        expect(dedupe?.options?.unique).toBe(true);
    });

    it('SDL declares public `trackEvent` ingest + admin `analyticsSummary`', () => {
        expect(analyticsFeature.schemaSDL).toContain('trackEvent');
        expect(analyticsFeature.schemaSDL).toContain('analyticsSummary');
    });

    it('authz: trackEvent is anon-open; analyticsSummary is admin-only', () => {
        expect(analyticsFeature.authz?.anonOpenMutations).toContain('trackEvent');
        expect(analyticsFeature.authz?.queryRequirements?.analyticsSummary).toBe('admin');
        // trackEvent must NOT appear under any role-gated bucket.
        expect(analyticsFeature.authz?.mutationRequirements?.trackEvent).toBeUndefined();
    });
});

describe('AnalyticsService', () => {
    it('rejects malformed events; accepts well-formed ones', async () => {
        const svc = new AnalyticsService(db);
        const result = await svc.ingest([
            {id: 'a', ts: Date.now(), anonId: 'anon-1', sessionId: 's-1', name: 'cart.add', type: 'interaction', path: '/products'},
            {id: 'b'}, // missing required fields
            null,
        ], undefined);
        expect(result.accepted).toBe(1);
    });

    it('strips invalid prop types but keeps strings/numbers/booleans', async () => {
        const svc = new AnalyticsService(db);
        await svc.ingest([{
            id: 'c', ts: Date.now(), anonId: 'anon-1', sessionId: 's-1', name: 'x', type: 'custom', path: '/',
            props: {ok: 'yes', count: 3, on: true, evil: {nested: true}, fn: (() => {}) as any},
        }], undefined);
        const stored = await db.collection('Analytics').findOne({id: 'c'}) as any;
        expect(stored.props.ok).toBe('yes');
        expect(stored.props.count).toBe(3);
        expect(stored.props.on).toBe(true);
        expect(stored.props.evil).toBeUndefined();
        expect(stored.props.fn).toBeUndefined();
    });

    it('summary returns top pages + top events for the requested range', async () => {
        const svc = new AnalyticsService(db);
        const now = Date.now();
        await svc.ingest([
            {id: 'p1', ts: now, anonId: 'a', sessionId: 's', name: 'pageview', type: 'pageview', path: '/products'},
            {id: 'p2', ts: now, anonId: 'b', sessionId: 's', name: 'pageview', type: 'pageview', path: '/products'},
            {id: 'p3', ts: now, anonId: 'c', sessionId: 's', name: 'pageview', type: 'pageview', path: '/'},
            {id: 'e1', ts: now, anonId: 'a', sessionId: 's', name: 'cart.add', type: 'interaction', path: '/products'},
        ], undefined);
        const summary = JSON.parse(await svc.summary('7d'));
        expect(summary.topPages.find((p: any) => p.path === '/products')?.count).toBe(2);
        expect(summary.topEvents.find((e: any) => e.name === 'cart.add')?.count).toBe(1);
    });
});
