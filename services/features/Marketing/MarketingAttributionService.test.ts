import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {MarketingAttributionService} from './MarketingAttributionService';

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
    db = client.db(`marketing_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

const build = () => new MarketingAttributionService(
    db.collection('MarketingReferrer'),
    db.collection('Users'),
);

describe('MarketingAttributionService', () => {
    it('records a UTM hit and surfaces it in the report', async () => {
        const svc = build();
        const r = await svc.recordHit({
            sessionId: 'sess-1',
            utm: {source: 'google', campaign: 'launch'},
            landingPath: '/',
        });
        expect((r as any).id).toBeTruthy();
        const report = await svc.report({groupBy: 'source', range: '30d'});
        expect(report.total).toBe(1);
        expect(report.rows.find(x => x.key === 'google')?.hits).toBe(1);
    });

    it('skips storage when no attribution info is present', async () => {
        const svc = build();
        const r = await svc.recordHit({sessionId: 'sess-2', landingPath: '/'});
        expect((r as any).id).toBe('');
        const report = await svc.report({});
        expect(report.total).toBe(0);
    });

    it('attaches sessionId hits to a user and stamps firstTouchUtm immutably', async () => {
        const svc = build();
        const userId = 'user-1';
        await db.collection('Users').insertOne({id: userId, email: 'x@y.com', kind: 'customer'} as any);

        await svc.recordHit({sessionId: 's', utm: {source: 'google', campaign: 'launch'}, landingPath: '/'});
        await new Promise(r => setTimeout(r, 5));
        await svc.recordHit({sessionId: 's', utm: {source: 'facebook'}, landingPath: '/products'});

        const res = await svc.attachToUser({sessionId: 's', userId});
        expect(res.ok).toBe(true);
        expect(res.firstTouchSet).toBe(true);

        const user = await db.collection('Users').findOne({id: userId}) as any;
        expect(user.firstTouchUtm.source).toBe('google');
        expect(user.lastTouchUtm.source).toBe('facebook');

        // A second attach must not overwrite firstTouch.
        await svc.recordHit({sessionId: 's', utm: {source: 'tiktok'}, landingPath: '/'});
        const res2 = await svc.attachToUser({sessionId: 's', userId});
        expect(res2.firstTouchSet).toBe(false);
        const user2 = await db.collection('Users').findOne({id: userId}) as any;
        expect(user2.firstTouchUtm.source).toBe('google');
        expect(user2.lastTouchUtm.source).toBe('tiktok');
    });

    it('groups by campaign and by ref', async () => {
        const svc = build();
        await svc.recordHit({sessionId: 's1', utm: {campaign: 'spring'}});
        await svc.recordHit({sessionId: 's2', utm: {campaign: 'spring'}});
        await svc.recordHit({sessionId: 's3', ref: 'influencer-X'});
        const byCampaign = await svc.report({groupBy: 'campaign'});
        expect(byCampaign.rows.find(r => r.key === 'spring')?.hits).toBe(2);
        const byRef = await svc.report({groupBy: 'ref'});
        expect(byRef.rows.find(r => r.key === 'influencer-X')?.hits).toBe(1);
    });
});
