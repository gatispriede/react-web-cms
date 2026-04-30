import {Collection, Db} from 'mongodb';
import bcrypt from 'bcrypt';
import {randomBytes} from 'node:crypto';
import guid from '@utils/guid';
import {
    ALL_MCP_SCOPES,
    IMcpIssuedToken,
    IMcpToken,
    IMcpTokenSummary,
    McpScope,
} from '@interfaces/IMcp';

/**
 * MCP token service — stores per-client tokens for the MCP server.
 *
 * Storage: separate `McpTokens` collection. We deliberately do NOT reuse
 * `Users` — these aren't user accounts (no login session, no role, no
 * password reset flow), they're machine-to-machine credentials owned by
 * the admin who issued them.
 *
 * Secret format: `mcpsk_<8-hex prefix><56-hex remainder>`. The prefix is
 * stored in plain text on the doc (`tokenIdPrefix`) so verify can look up
 * by prefix and only bcrypt-compare the remainder against ONE candidate.
 * Without the prefix, `verifyToken` would have to bcrypt-compare against
 * every token in the table on every MCP call.
 */

const SCOPE_SET: ReadonlySet<string> = new Set(ALL_MCP_SCOPES);
const PREFIX_LEN = 8;
const REMAINDER_BYTES = 28; // 56 hex chars
const DEFAULT_TTL_DAYS = Number(process.env.MCP_TOKEN_DEFAULT_TTL_DAYS) > 0
    ? Number(process.env.MCP_TOKEN_DEFAULT_TTL_DAYS)
    : 90;
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

export class McpTokenService {
    private tokens: Collection;
    private indexesReady = false;

    constructor(db: Db) {
        this.tokens = db.collection('McpTokens');
    }

    private async ensureIndexes(): Promise<void> {
        if (this.indexesReady) return;
        try {
            await this.tokens.createIndex({id: 1}, {unique: true});
            await this.tokens.createIndex({tokenIdPrefix: 1});
            await this.tokens.createIndex({revokedAt: 1, expiresAt: 1});
            this.indexesReady = true;
        } catch (err) {
            console.error('McpTokenService.ensureIndexes:', err);
        }
    }

    /**
     * Issue a fresh token. Returns the raw secret ONCE — caller must surface
     * it to the operator immediately and discard. Storage keeps only the
     * bcrypt of the remainder + the plain prefix.
     */
    async issueToken(
        params: {name: string; scopes: McpScope[]; ttlDays?: number | null},
        createdBy: string,
    ): Promise<IMcpIssuedToken> {
        await this.ensureIndexes();
        const name = (params.name || '').trim();
        if (!name) throw new Error('name is required');
        const scopes = (params.scopes || []).filter(s => SCOPE_SET.has(s));
        if (!scopes.length) throw new Error('at least one valid scope is required');

        const prefix = randomBytes(4).toString('hex'); // 8 hex chars
        const remainder = randomBytes(REMAINDER_BYTES).toString('hex'); // 56 hex chars
        const secret = `mcpsk_${prefix}${remainder}`;
        const hashedSecret = await bcrypt.hash(remainder, BCRYPT_ROUNDS);

        const now = new Date();
        const ttl = typeof params.ttlDays === 'number' && params.ttlDays > 0
            ? params.ttlDays
            : (params.ttlDays === null ? null : DEFAULT_TTL_DAYS);
        const expiresAt = ttl
            ? new Date(now.getTime() + ttl * 24 * 60 * 60 * 1000).toISOString()
            : undefined;

        const doc: IMcpToken = {
            id: guid(),
            name,
            tokenIdPrefix: prefix,
            hashedSecret,
            scopes,
            createdBy,
            createdAt: now.toISOString(),
            ...(expiresAt ? {expiresAt} : {}),
        };
        await this.tokens.insertOne(doc as any);
        return {id: doc.id, name, secret, scopes, expiresAt};
    }

    /**
     * Verify a raw secret. Returns the token doc on success, null otherwise.
     * Rejects revoked / expired tokens. Does NOT mark `lastUsedAt` —
     * call `markUsed` from the dispatcher so a verify-without-execute
     * (e.g., readiness probe) doesn't bump the timestamp.
     */
    async verifyToken(rawSecret: string): Promise<IMcpToken | null> {
        await this.ensureIndexes();
        if (!rawSecret || typeof rawSecret !== 'string') return null;
        if (!rawSecret.startsWith('mcpsk_')) return null;
        const body = rawSecret.slice('mcpsk_'.length);
        if (body.length !== PREFIX_LEN + REMAINDER_BYTES * 2) return null;
        const prefix = body.slice(0, PREFIX_LEN);
        const remainder = body.slice(PREFIX_LEN);

        // Multiple tokens could (rarely) share a prefix — iterate all matches.
        const candidates = await this.tokens.find({tokenIdPrefix: prefix}).toArray();
        const nowIso = new Date().toISOString();
        for (const raw of candidates) {
            const doc = raw as unknown as IMcpToken;
            if (doc.revokedAt) continue;
            if (doc.expiresAt && doc.expiresAt < nowIso) continue;
            try {
                const ok = await bcrypt.compare(remainder, doc.hashedSecret);
                if (ok) return this.stripMongoId(raw);
            } catch (err) {
                console.error('McpTokenService.verifyToken bcrypt failed:', err);
            }
        }
        return null;
    }

    async revokeToken(id: string): Promise<{id: string; revoked: boolean}> {
        await this.ensureIndexes();
        const res = await this.tokens.updateOne(
            {id, revokedAt: {$exists: false}},
            {$set: {revokedAt: new Date().toISOString()}},
        );
        return {id, revoked: (res.modifiedCount ?? 0) > 0};
    }

    async listTokens(): Promise<IMcpTokenSummary[]> {
        await this.ensureIndexes();
        const docs = await this.tokens.find({}, {projection: {_id: 0, hashedSecret: 0, tokenIdPrefix: 0}}).sort({createdAt: -1}).toArray();
        const nowIso = new Date().toISOString();
        return docs.map((d: any) => {
            const status: 'active' | 'revoked' | 'expired' = d.revokedAt
                ? 'revoked'
                : (d.expiresAt && d.expiresAt < nowIso ? 'expired' : 'active');
            return {
                id: d.id,
                name: d.name,
                scopes: d.scopes ?? [],
                createdBy: d.createdBy,
                createdAt: d.createdAt,
                lastUsedAt: d.lastUsedAt,
                expiresAt: d.expiresAt,
                revokedAt: d.revokedAt,
                status,
            };
        });
    }

    async markUsed(id: string): Promise<void> {
        try {
            await this.tokens.updateOne({id}, {$set: {lastUsedAt: new Date().toISOString()}});
        } catch (err) {
            // Never block the call on a lastUsedAt write.
            console.error('McpTokenService.markUsed:', err);
        }
    }

    private stripMongoId(doc: any): IMcpToken {
        const {_id, ...rest} = doc ?? {};
        return rest as IMcpToken;
    }
}
