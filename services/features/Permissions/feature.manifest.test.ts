import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {permissionsFeature} from './feature.manifest';
import {PermissionService, RequestPermissionCache} from './PermissionService';

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
    db = client.db(`perm_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('permissionsFeature manifest', () => {
    it('declares stable id + coreInfrastructure', () => {
        expect(permissionsFeature.id).toBe('permissions');
        expect(permissionsFeature.coreInfrastructure).toBe(true);
    });

    it('services factory returns a `permissions` key holding a PermissionService', () => {
        const built = permissionsFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built && Object.keys(built)).toEqual(['permissions']);
        expect(built?.permissions).toBeInstanceOf(PermissionService);
    });

    it('declares natural-key uniqueness on (userId, scope, resourceId)', () => {
        const idxs = permissionsFeature.indexes ?? [];
        const natural = idxs.find(i => i.spec.userId === 1 && i.spec.scope === 1 && i.spec.resourceId === 1);
        expect(natural?.options?.unique).toBe(true);
    });

    it('SDL surfaces grant/revoke + functionalRoles query', () => {
        expect(permissionsFeature.schemaSDL).toContain('grantPermission');
        expect(permissionsFeature.schemaSDL).toContain('revokePermission');
        expect(permissionsFeature.schemaSDL).toContain('functionalRoles');
    });
});

describe('PermissionService', () => {
    it('can() — admin role bypasses every per-resource check', async () => {
        const svc = new PermissionService(db);
        const ok = await svc.can({userId: 'u1', userRole: 'admin', scope: 'page', resourceId: '/about'});
        expect(ok).toBe(true);
    });

    it('can() — editor without grant denied; with grant allowed', async () => {
        const svc = new PermissionService(db);
        const before = await svc.can({userId: 'u1', userRole: 'editor', scope: 'page', resourceId: '/about'});
        expect(before).toBe(false);
        await svc.grant({userId: 'u1', scope: 'page', resourceId: '/about', grantedBy: 'admin@x.com'});
        const after = await svc.can({userId: 'u1', userRole: 'editor', scope: 'page', resourceId: '/about'});
        expect(after).toBe(true);
    });

    it('grant() is idempotent on (user, scope, resource)', async () => {
        const svc = new PermissionService(db);
        await svc.grant({userId: 'u1', scope: 'module', resourceId: 'sec-1', grantedBy: 'admin@x.com'});
        await svc.grant({userId: 'u1', scope: 'module', resourceId: 'sec-1', grantedBy: 'someone-else@x.com'});
        const list = await svc.listForUser('u1');
        expect(list.length).toBe(1);
        // First write wins (`$setOnInsert`).
        expect(list[0].grantedBy).toBe('admin@x.com');
    });

    it('revoke() removes the row + is idempotent', async () => {
        const svc = new PermissionService(db);
        await svc.grant({userId: 'u1', scope: 'page', resourceId: '/about', grantedBy: 'admin@x.com'});
        const r1 = await svc.revoke({userId: 'u1', scope: 'page', resourceId: '/about'});
        expect(r1.deleted).toBe(1);
        const r2 = await svc.revoke({userId: 'u1', scope: 'page', resourceId: '/about'});
        expect(r2.deleted).toBe(0);
    });

    it('levels are independent — page-edit on /about does NOT imply module-edit on its sections', async () => {
        const svc = new PermissionService(db);
        await svc.grant({userId: 'u1', scope: 'page', resourceId: '/about', grantedBy: 'admin@x.com'});
        const moduleAccess = await svc.can({userId: 'u1', userRole: 'editor', scope: 'module', resourceId: 'about-hero'});
        expect(moduleAccess).toBe(false);
    });

    it('per-request cache memoises identical checks', async () => {
        const svc = new PermissionService(db);
        await svc.grant({userId: 'u1', scope: 'page', resourceId: '/about', grantedBy: 'admin@x.com'});
        const cache = new RequestPermissionCache();
        const a = await svc.can({userId: 'u1', userRole: 'editor', scope: 'page', resourceId: '/about', cache});
        const b = await svc.can({userId: 'u1', userRole: 'editor', scope: 'page', resourceId: '/about', cache});
        expect(a).toBe(true);
        expect(b).toBe(true);
        expect(cache.size()).toBe(1);
    });
});

describe('functional roles registry', () => {
    it('composedFunctionalRoles() merges every active feature\'s declarations', async () => {
        const {composedFunctionalRoles} = await import('@services/infra/featureRegistry');
        const ids = composedFunctionalRoles().map(r => r.id);
        expect(ids).toContain('translator');
        expect(ids).toContain('content-editor');
        expect(ids).toContain('page-owner');
    });

    it('every assignable role exposes its grant map', async () => {
        const {composedFunctionalRoles} = await import('@services/infra/featureRegistry');
        const roles = composedFunctionalRoles();
        const translator = roles.find(r => r.id === 'translator');
        expect(translator?.assignable).toBe(true);
        expect(translator?.grants.translations).toBe('edit');
    });
});
