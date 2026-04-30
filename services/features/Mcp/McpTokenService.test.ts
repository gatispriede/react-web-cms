import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {Db, MongoClient} from 'mongodb';
import {McpTokenService} from '@services/features/Mcp/McpTokenService';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let svc: McpTokenService;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(async () => {
    db = client.db(`mcptok_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    svc = new McpTokenService(db);
});

describe('McpTokenService', () => {
    it('issueToken returns a raw secret with the mcpsk_ prefix and stores a hashed copy', async () => {
        const issued = await svc.issueToken({name: 'cli', scopes: ['read:content']}, 'admin@x');
        expect(issued.secret.startsWith('mcpsk_')).toBe(true);
        expect(issued.secret.length).toBeGreaterThan(60);
        expect(issued.expiresAt).toBeTruthy();
        const list = await svc.listTokens();
        expect(list).toHaveLength(1);
        expect(list[0].name).toBe('cli');
        expect(list[0].status).toBe('active');
        // hashedSecret / tokenIdPrefix shouldn't be exposed via listTokens.
        expect((list[0] as any).hashedSecret).toBeUndefined();
        expect((list[0] as any).tokenIdPrefix).toBeUndefined();
    });

    it('verifyToken accepts the issued secret and rejects a wrong one', async () => {
        const issued = await svc.issueToken({name: 'cli', scopes: ['read:content']}, 'admin@x');
        const ok = await svc.verifyToken(issued.secret);
        expect(ok?.id).toBe(issued.id);
        expect(ok?.scopes).toEqual(['read:content']);
        const bad = await svc.verifyToken(issued.secret.replace(/.$/, 'z'));
        expect(bad).toBeNull();
        const malformed = await svc.verifyToken('garbage');
        expect(malformed).toBeNull();
    });

    it('verifyToken rejects revoked tokens', async () => {
        const issued = await svc.issueToken({name: 'cli', scopes: ['read:content']}, 'admin@x');
        await svc.revokeToken(issued.id);
        const verified = await svc.verifyToken(issued.secret);
        expect(verified).toBeNull();
        const list = await svc.listTokens();
        expect(list[0].status).toBe('revoked');
    });

    it('verifyToken rejects expired tokens', async () => {
        const issued = await svc.issueToken({name: 'cli', scopes: ['read:content'], ttlDays: 1}, 'admin@x');
        // Manually rewind the expiresAt to the past.
        await db.collection('McpTokens').updateOne(
            {id: issued.id},
            {$set: {expiresAt: '2000-01-01T00:00:00.000Z'}},
        );
        const verified = await svc.verifyToken(issued.secret);
        expect(verified).toBeNull();
        const list = await svc.listTokens();
        expect(list[0].status).toBe('expired');
    });

    it('issueToken rejects empty name and empty scopes', async () => {
        await expect(svc.issueToken({name: '', scopes: ['read:content']}, 'a')).rejects.toThrow();
        await expect(svc.issueToken({name: 'x', scopes: []}, 'a')).rejects.toThrow();
        await expect(svc.issueToken({name: 'x', scopes: ['nope' as any]}, 'a')).rejects.toThrow();
    });

    it('markUsed updates lastUsedAt without other changes', async () => {
        const issued = await svc.issueToken({name: 'cli', scopes: ['read:content']}, 'admin@x');
        await svc.markUsed(issued.id);
        const list = await svc.listTokens();
        expect(list[0].lastUsedAt).toBeTruthy();
    });

    it('revokeToken is idempotent (second call reports false)', async () => {
        const issued = await svc.issueToken({name: 'cli', scopes: ['read:content']}, 'admin@x');
        const r1 = await svc.revokeToken(issued.id);
        const r2 = await svc.revokeToken(issued.id);
        expect(r1.revoked).toBe(true);
        expect(r2.revoked).toBe(false);
    });
});
