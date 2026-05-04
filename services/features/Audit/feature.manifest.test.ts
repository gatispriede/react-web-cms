import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {auditFeature} from '@services/features/Audit/feature.manifest';
import {AuditService} from '@services/features/Audit/AuditService';

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
    db = client.db(`audit_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('auditFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(auditFeature.id).toBe('audit');
        expect(auditFeature.displayName).toBe('Audit log');
    });

    it('services factory returns an `audit` key holding an AuditService', () => {
        const built = auditFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['audit']);
        expect(built?.audit).toBeInstanceOf(AuditService);
    });

    it('omits resolvers (Audit reads route through guarded mongo proxy)', () => {
        expect(auditFeature.resolvers).toBeUndefined();
    });

    it('contributes the audit SDL fragment (Phase C.2)', () => {
        expect(auditFeature.schemaSDL).toContain('extend type QueryMongo');
        expect(auditFeature.schemaSDL).toContain('getAuditLog');
        expect(auditFeature.schemaSDL).toContain('getAuditCollections');
        expect(auditFeature.schemaSDL).toContain('getAuditActors');
        // Owned by Observability, not Audit.
        expect(auditFeature.schemaSDL).not.toContain('getErrorLog');
    });

    it('contributes admin queryRequirements for the audit triplet', () => {
        expect(auditFeature.authz?.queryRequirements?.getAuditLog).toBe('admin');
        expect(auditFeature.authz?.queryRequirements?.getAuditCollections).toBe('admin');
        expect(auditFeature.authz?.queryRequirements?.getAuditActors).toBe('admin');
    });

    it('does not declare requires (audit is leaf-level)', () => {
        expect(auditFeature.requires).toBeUndefined();
    });
});
