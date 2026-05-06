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
        ]);
        // v2: `summary()` now returns the structured object directly,
        // and defaults to audience='public' (which is what un-tagged
        // ingests resolve to when no admin/internal/bot signal hits).
        const summary = await svc.summary('7d');
        expect(summary.topPages.find((p) => p.path === '/products')?.count).toBe(2);
        expect(summary.topEvents.find((e) => e.name === 'cart.add')?.count).toBe(1);
        expect(summary.totals.uniqueAnon).toBe(3);
    });

    it('stamps server-derived country from the request IP and never persists the IP', async () => {
        // The seed dataset bundled at infra/datasets/ip-to-country.json
        // includes 8.8.8.0/24 → US. Use it directly (no env override).
        const svc = new AnalyticsService(db);
        await svc.ingest([
            {id: 'g1', ts: Date.now(), anonId: 'x', sessionId: 's', name: 'pageview', type: 'pageview', path: '/'},
            // Client-supplied `country` field is ignored — server wins.
            {id: 'g2', ts: Date.now(), anonId: 'x', sessionId: 's', name: 'pageview', type: 'pageview', path: '/', country: 'XX'},
        ], {ip: '8.8.8.8'});
        const stored = await db.collection('Analytics').find({}).toArray() as any[];
        expect(stored).toHaveLength(2);
        for (const row of stored) {
            expect(row.country).toBe('US');
            expect(row.ip).toBeUndefined();
        }
    });

    it('omits country (and never persists IP) when the IP is not in the dataset', async () => {
        const svc = new AnalyticsService(db);
        await svc.ingest([
            {id: 'g3', ts: Date.now(), anonId: 'x', sessionId: 's', name: 'pageview', type: 'pageview', path: '/'},
        ], {ip: '203.0.113.99'}); // TEST-NET-3, not in seed
        const stored = await db.collection('Analytics').findOne({id: 'g3'}) as any;
        expect(stored.country).toBeUndefined();
        expect(stored.ip).toBeUndefined();
    });

    it('summary includes a topCountries breakdown grouped under "Unknown" for missing values', async () => {
        const svc = new AnalyticsService(db);
        const now = Date.now();
        await svc.ingest([
            {id: 'c1', ts: now, anonId: 'a', sessionId: 's', name: 'pageview', type: 'pageview', path: '/'},
            {id: 'c2', ts: now, anonId: 'b', sessionId: 's', name: 'pageview', type: 'pageview', path: '/'},
        ], {ip: '8.8.8.8'});
        await svc.ingest([
            {id: 'c3', ts: now, anonId: 'c', sessionId: 's', name: 'pageview', type: 'pageview', path: '/'},
        ]); // no IP → no country
        const summary = await svc.summary('7d');
        expect(summary.topCountries).toBeDefined();
        const us = summary.topCountries.find((c) => c.country === 'US');
        const unknown = summary.topCountries.find((c) => c.country === 'Unknown');
        expect(us?.count).toBe(2);
        expect(unknown?.count).toBe(1);
    });

    it('tags audience: admin when ingest is from an admin session, and the dashboard public filter excludes it', async () => {
        const svc = new AnalyticsService(db);
        const now = Date.now();
        await svc.ingest([
            {id: 'adm1', ts: now, anonId: 'a', sessionId: 's', name: 'pageview', type: 'pageview', path: '/admin'},
        ], {isAdminSession: true, userId: 'admin@example.com'});
        await svc.ingest([
            {id: 'pub1', ts: now, anonId: 'b', sessionId: 's', name: 'pageview', type: 'pageview', path: '/'},
        ]);
        const stored = await db.collection('Analytics').find({}).toArray() as any[];
        expect(stored.find(r => r.id === 'adm1').audience).toBe('admin');
        expect(stored.find(r => r.id === 'pub1').audience).toBe('public');

        const publicView = await svc.summary('7d', 'public');
        expect(publicView.totals.pageviews).toBe(1);
        const adminView = await svc.summary('7d', 'admin');
        expect(adminView.totals.pageviews).toBe(1);
        const allView = await svc.summary('7d', 'all');
        expect(allView.totals.pageviews).toBe(2);
    });

    it('tags audience: bot for known crawler UAs', async () => {
        const svc = new AnalyticsService(db);
        await svc.ingest([
            {id: 'bot1', ts: Date.now(), anonId: 'a', sessionId: 's', name: 'pageview', type: 'pageview', path: '/'},
        ], {userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'});
        const row = await db.collection('Analytics').findOne({id: 'bot1'}) as any;
        expect(row.audience).toBe('bot');
        expect(row.ua?.device).toBe('bot');
    });

    it('parses UA into device/browser/os fields server-side', async () => {
        const svc = new AnalyticsService(db);
        await svc.ingest([
            {id: 'ua1', ts: Date.now(), anonId: 'a', sessionId: 's', name: 'pageview', type: 'pageview', path: '/'},
        ], {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'});
        const row = await db.collection('Analytics').findOne({id: 'ua1'}) as any;
        expect(row.ua.device).toBe('mobile');
        expect(row.ua.os).toBe('iOS');
        expect(row.ua.vendor).toBe('Apple');
    });
});
