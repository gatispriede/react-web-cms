import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {composeDiagnostics} from './DiagnosticsService';
import {IdempotencyService, InMemoryIdempotencyMongo} from '@services/infra/idempotency';
import {InMemoryRedis} from '@services/infra/redis';
import type {FeatureManifest} from '@services/infra/featureManifest';

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
    db = client.db(`diagnostics_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

const fixtureRegistry: readonly FeatureManifest[] = [
    {
        id: 'alpha',
        displayName: 'Alpha',
        coreInfrastructure: true,
        schemaSDL: `extend type QueryMongo { alphaA: String alphaB: String }
extend type MutationMongo { alphaWrite(x: Int): String }`,
        authz: {mutationRequirements: {alphaWrite: 'admin'}},
    },
    {
        id: 'beta',
        displayName: 'Beta',
        schemaSDL: `extend type QueryMongo { betaQ: String }`,
        cascadeRules: [{collection: 'BetaChild' as any, parentCollection: 'Beta' as any, parentField: '_id' as any, childField: 'betaId' as any} as any],
    } as FeatureManifest,
    {
        id: 'gamma',
        displayName: 'Gamma',
    } as FeatureManifest,
];

describe('composeDiagnostics', () => {
    it('returns the expected snapshot shape with build, features, storage, trash, idempotency, authorization, generatedAt', async () => {
        const idempotency = new IdempotencyService(null, new InMemoryIdempotencyMongo());
        const snap = await composeDiagnostics({
            db,
            redis: new InMemoryRedis(),
            featureRegistry: fixtureRegistry,
            resolveEnabled: () => true,
            composedFunctionalRoles: () => [{id: 'translator'}, {id: 'merchandiser'}],
            idempotency,
        });
        expect(Object.keys(snap).sort()).toEqual([
            'authorization', 'build', 'features', 'generatedAt', 'idempotency', 'storage', 'trash',
        ]);
        expect(snap.build.bootId).toBeTruthy();
        expect(typeof snap.build.uptimeMs).toBe('number');
        expect(snap.features.map(f => f.id)).toEqual(['alpha', 'beta', 'gamma']);
        const alpha = snap.features.find(f => f.id === 'alpha')!;
        expect(alpha.queryCount).toBe(2);
        expect(alpha.mutationCount).toBe(1);
        expect(alpha.gatedMutationCount).toBe(1);
        expect(alpha.coreInfrastructure).toBe(true);
        const beta = snap.features.find(f => f.id === 'beta')!;
        expect(beta.queryCount).toBe(1);
        expect(beta.cascadeRuleCount).toBe(1);
        expect(snap.idempotency).toEqual({inFlight: 0, ttlSeconds: 300});
        expect(snap.authorization.functionalRolesRegistered).toBe(2);
        expect(snap.authorization.grantTotal).toBe(0);
        expect(Array.isArray(snap.trash)).toBe(true);
    });

    it('counts trash collections by suffix and aggregates Permissions by scope', async () => {
        await db.collection('Foo.trash').insertMany([
            {_id: 1, deletedAt: new Date('2025-01-01'), trashGroup: 'g1'},
            {_id: 2, deletedAt: new Date('2025-02-01'), trashGroup: 'g1'},
            {_id: 3, deletedAt: new Date('2025-03-01'), trashGroup: 'g2'},
        ]);
        await db.collection('Bar.trash').insertMany([
            {_id: 1, deletedAt: new Date('2024-12-01'), trashGroup: 'g3'},
        ]);
        await db.collection('Permissions').insertMany([
            {userId: 'u1', scope: 'page', resourceId: 'p1'},
            {userId: 'u2', scope: 'page', resourceId: 'p2'},
            {userId: 'u3', scope: 'module', resourceId: 'm1'},
        ]);
        const snap = await composeDiagnostics({
            db,
            redis: null,
            featureRegistry: fixtureRegistry,
            resolveEnabled: () => true,
            composedFunctionalRoles: () => [],
            idempotency: new IdempotencyService(null, new InMemoryIdempotencyMongo()),
        });
        const foo = snap.trash.find(t => t.collection === 'Foo.trash')!;
        expect(foo.rowCount).toBe(3);
        expect(foo.distinctTrashGroups).toBe(2);
        expect(foo.oldestDeletedAt).toBe(new Date('2025-01-01').toISOString());
        expect(snap.authorization.grantsByScope).toEqual({page: 2, module: 1});
        expect(snap.authorization.grantTotal).toBe(3);
    });

    it('does not surface env secrets — only NODE_ENV / DEPLOY_TIER / GIT_SHA-shaped fields', async () => {
        process.env.MONGO_URI = 'mongodb://secret:hunter2@db/x';
        process.env.REDIS_URL = 'redis://hunter2@redis/x';
        process.env.SOMETHING_SECRET = 'hunter2';
        const snap = await composeDiagnostics({
            db,
            redis: null,
            featureRegistry: fixtureRegistry,
            resolveEnabled: () => true,
            composedFunctionalRoles: () => [],
            idempotency: new IdempotencyService(null, new InMemoryIdempotencyMongo()),
        });
        const json = JSON.stringify(snap);
        expect(json).not.toContain('hunter2');
        expect(json).not.toContain('mongodb://');
        expect(json).not.toContain('redis://');
    });
});
