import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {mcpFeature} from '@services/features/Mcp/feature.manifest';
import {McpTokenService} from '@services/features/Mcp/McpTokenService';

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
    db = client.db(`mcp_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('mcpFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(mcpFeature.id).toBe('mcp');
        expect(mcpFeature.displayName).toBe('MCP tokens');
    });

    it('does not declare requires (McpTokenService is leaf-level)', () => {
        expect(mcpFeature.requires).toBeUndefined();
    });

    it('services factory returns an `mcp` key holding an McpTokenService', () => {
        const built = mcpFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['mcp']);
        expect(built?.mcp).toBeInstanceOf(McpTokenService);
    });

    it('declares the McpTokens indexes mirrored from ensureIndexes()', () => {
        const idxs = mcpFeature.indexes ?? [];
        const idIdx = idxs.find(i => i.collection === 'McpTokens' && (i.spec as any).id === 1);
        expect(idIdx?.options?.unique).toBe(true);
        const prefixIdx = idxs.find(i => i.collection === 'McpTokens' && (i.spec as any).tokenIdPrefix === 1);
        expect(prefixIdx).toBeDefined();
        const lifecycleIdx = idxs.find(i => i.collection === 'McpTokens'
            && (i.spec as any).revokedAt === 1
            && (i.spec as any).expiresAt === 1);
        expect(lifecycleIdx).toBeDefined();
    });

    it('contributes the MCP token SDL fragment (Phase C.2)', () => {
        expect(mcpFeature.schemaSDL).toContain('mcpListTokens');
        expect(mcpFeature.schemaSDL).toContain('mcpIssueToken');
        expect(mcpFeature.schemaSDL).toContain('mcpRevokeToken');
    });

    it('contributes admin authz entries + session injection on issue/revoke', () => {
        expect(mcpFeature.authz?.queryRequirements?.mcpListTokens).toBe('admin');
        expect(mcpFeature.authz?.mutationRequirements?.mcpIssueToken).toBe('admin');
        expect(mcpFeature.authz?.mutationRequirements?.mcpRevokeToken).toBe('admin');
        expect(mcpFeature.authz?.sessionInjected).toContain('mcpIssueToken');
        expect(mcpFeature.authz?.sessionInjected).toContain('mcpRevokeToken');
    });

    it('omits resolvers (MCP token surface goes through guarded mongo proxy)', () => {
        expect(mcpFeature.resolvers).toBeUndefined();
    });
});
