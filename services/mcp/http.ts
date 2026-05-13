/**
 * MCP Streamable-HTTP transport — entry point for `npm run mcp:http`.
 *
 * Production-ready remote MCP. Same dispatcher as the stdio entrypoint,
 * different transport. Designed to sit behind Caddy on the droplet:
 *
 *   Claude Desktop / Cursor
 *     ↓ HTTPS, Authorization: Bearer mcpsk_…
 *   Caddy  (TLS, IP allowlist, /mcp route)
 *     ↓ HTTP (back-end network)
 *   mcp service  (this file, port 8788)
 *     ↓
 *   MongoDB  (private network)
 *
 * Auth: every request must carry `Authorization: Bearer mcpsk_<…>`. The
 * token is validated against the same `McpTokens` collection the admin UI
 * issues from. Revocation at /admin/system/mcp takes effect on the next
 * request — no caching beyond the 60s `tokenLastUsedAt` write-back.
 *
 * Sessions: the SDK's `StreamableHTTPServerTransport` mints an
 * `Mcp-Session-Id` on the first POST and threads it through subsequent
 * GET (SSE) and DELETE calls. We keep one transport per session id in
 * memory; idle sessions are garbage-collected by the transport itself.
 *
 * Network defaults: bound to 127.0.0.1:8788. Docker networks override via
 * `MCP_HTTP_BIND=0.0.0.0` so the proxy can reach across the container
 * boundary; never expose this to the public internet directly — auth is
 * a token, not an IP allowlist; Caddy adds the allowlist on top.
 */

import express, {type Request, type Response} from 'express';
import {randomUUID} from 'node:crypto';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {McpServer} from '@services/features/Mcp/McpServer';
import {scopesForRole} from '@services/features/Mcp/scopeFromRole';
import type {IMcpToken} from '@interfaces/IMcp';
import {log} from '@services/infra/logger';
import {sessionFromReq, type GraphqlSession} from '@services/features/Auth/authz';
// authOptions lives in the Next pages tree (next to the NextAuth route
// it configures). Pulled in here to validate the session cookie on the
// MCP HTTP transport — same module the GraphQL route uses.
import {adminAuthOptions as authOptions} from '@client/pages/api/auth/authOptions';

const enabled = process.env.MCP_HTTP_ENABLED === 'true';
if (!enabled) {
    process.stderr.write('[mcp:http] MCP_HTTP_ENABLED is not "true" — refusing to start.\n');
    process.exit(0);
}

const PORT = Number(process.env.MCP_HTTP_PORT) || 8788;
const BIND = process.env.MCP_HTTP_BIND || '127.0.0.1';
// Optional second-line auth: comma-separated CIDR or literal IPs allowed
// to reach this port directly. Defense in depth — Caddy is the primary
// gate; this catches the case where someone accidentally publishes the
// port to the host. Empty string disables the check (Caddy is gating).
const ALLOWED_IPS = (process.env.MCP_HTTP_ALLOWED_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
const RATE_LIMIT_PER_MIN = Number(process.env.MCP_HTTP_RATE_LIMIT_PER_MIN) || 600;

interface SessionEntry {
    transport: StreamableHTTPServerTransport;
    server: Server;
    token: IMcpToken;
    /** Plaintext bearer — handed to tool dispatch for tools that proxy to
     *  the GraphQL API and need to forward auth. EMPTY when the auth path
     *  is a NextAuth session cookie (cookie-auth tools talk to Mongo
     *  directly; nothing to forward). Never logged. */
    tokenSecret: string;
    /** 'bearer' or 'cookie' — printed in logs so operators can tell
     *  apart Claude Desktop traffic from in-browser admin traffic. */
    authPath: 'bearer' | 'cookie';
    createdAt: number;
}

const sessions = new Map<string, SessionEntry>();

interface RateBucket {
    windowStart: number;
    count: number;
}
const rateBuckets = new Map<string, RateBucket>();

function rateLimitOk(tokenId: string): boolean {
    const now = Date.now();
    const bucket = rateBuckets.get(tokenId);
    if (!bucket || now - bucket.windowStart > 60_000) {
        rateBuckets.set(tokenId, {windowStart: now, count: 1});
        return true;
    }
    bucket.count += 1;
    return bucket.count <= RATE_LIMIT_PER_MIN;
}

function clientIp(req: Request): string {
    // Express's `req.ip` honours `app.set('trust proxy', …)`; we set it
    // below to trust the loopback proxy (Caddy).
    return req.ip ?? req.socket.remoteAddress ?? '';
}

function ipAllowed(ip: string): boolean {
    if (ALLOWED_IPS.length === 0) return true;
    return ALLOWED_IPS.includes(ip);
}

function readBearer(req: Request): string | null {
    const h = req.headers.authorization;
    if (typeof h !== 'string') return null;
    const match = /^Bearer\s+(.+)$/i.exec(h);
    return match ? match[1].trim() : null;
}

/**
 * Build a transient `IMcpToken`-shaped object from a NextAuth admin
 * session. We never persist this — it lives only inside the request /
 * session-cookie's session entry and is GC'd when the transport closes.
 *
 * The `id` collides intentionally with `session:<email>` so audit logs
 * and rate-limit buckets can distinguish cookie-auth traffic from real
 * tokens. The `hashedSecret` and `tokenIdPrefix` are empty — the verify
 * path is gated *before* this function ever runs (we already trust the
 * NextAuth cookie at this point), so the placeholder values never reach
 * a `bcrypt.compare`.
 */
function virtualTokenForSession(session: GraphqlSession): IMcpToken {
    const now = new Date().toISOString();
    return {
        id: `session:${session.email ?? 'anon'}`,
        name: `session:${session.email ?? 'anon'} (${session.role})`,
        tokenIdPrefix: '',
        hashedSecret: '',
        scopes: scopesForRole(session.role),
        createdBy: session.email ?? 'session-cookie',
        createdAt: now,
        // Cookie-driven sessions inherit NextAuth's session TTL — no
        // independent expiry needed.
        expiresAt: undefined,
    };
}

async function buildServerForToken(
    token: IMcpToken,
    tokenSecret: string,
    authPath: 'bearer' | 'cookie',
): Promise<{server: Server; transport: StreamableHTTPServerTransport}> {
    const conn = getMongoConnection();
    const mcp = new McpServer({services: conn, audit: conn.auditService});

    const server = new Server(
        {name: 'redis-node-js-cloud-cms', version: '0.1.0'},
        {capabilities: {tools: {}}},
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        // Filter the catalogue to what THIS auth context can actually
        // dispatch — viewers don't see write tools at all, editors don't
        // see admin:* tools. The dispatcher would reject them anyway, but
        // hiding them here keeps the AI from picking unreachable tools
        // and surfaces capability cleanly in the client UI.
        tools: mcp
            .listTools()
            .filter(t => (t.scopes ?? []).every(s => token.scopes.includes(s)))
            .map(t => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema,
            })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (req, extra) => {
        // MCP `notifications/progress` — wired only when the client
        // included `_meta.progressToken` on its `tools/call`. The SDK
        // hands us `extra.sendNotification` scoped to this request; we
        // tag every outgoing notification with the same token. Errors
        // are swallowed so a failed notification never aborts the tool.
        const progressToken = (req.params as any)?._meta?.progressToken
            ?? (extra as any)?._meta?.progressToken;
        const notify = progressToken !== undefined && extra?.sendNotification
            ? async (p: {progress: number; total?: number; message?: string}) => {
                try {
                    await extra.sendNotification({
                        method: 'notifications/progress',
                        params: {progressToken, ...p},
                    });
                } catch (err) {
                    log.warn({scope: 'mcp.http.progress', err, tool: req.params.name}, 'progress notification failed');
                }
            }
            : undefined;
        const outcome = await mcp.dispatch({
            tool: req.params.name,
            args: req.params.arguments ?? {},
            token,
            tokenSecret,
            notify,
        });
        if (!outcome.ok) {
            return {
                isError: true,
                content: [{type: 'text', text: JSON.stringify(outcome.error)}],
            };
        }
        return outcome.result!;
    });

    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        // The transport calls this when it mints a fresh session id from
        // an `initialize` POST. We register the session in our map.
        onsessioninitialized: (sessionId) => {
            sessions.set(sessionId, {
                transport, server, token, tokenSecret, authPath,
                createdAt: Date.now(),
            });
        },
    });

    transport.onclose = () => {
        // SDK fires onclose when the client DELETEs or the underlying
        // socket goes away. Drop the session so its server + transport
        // are eligible for GC.
        const sid = transport.sessionId;
        if (sid) sessions.delete(sid);
    };

    await server.connect(transport);
    return {server, transport};
}

/**
 * Resolve the calling identity for one MCP request.
 *
 * Order:
 *   1. NextAuth session cookie — preferred. If the caller is a logged-in
 *      admin/editor/viewer browsing `/admin/*` in the same browser, we
 *      trust that session and derive scopes from the role. No DB row is
 *      consulted; revoking the cookie revokes MCP access immediately.
 *   2. Bearer token — fallback for headless clients (Claude Desktop,
 *      Cursor, scripts). Token must be in `McpTokens` and not revoked /
 *      expired. The token's recorded scopes are the cap.
 *
 * Returns `{kind: 'denied', status, body}` for any rejection. Customer
 * sessions, anonymous, and missing-creds all fall to bearer; if bearer
 * also fails, the request is rejected.
 */
type AuthOutcome =
    | {kind: 'cookie'; token: IMcpToken; tokenSecret: ''; session: GraphqlSession}
    | {kind: 'bearer'; token: IMcpToken; tokenSecret: string}
    | {kind: 'denied'; status: number; body: {error: string}};

async function authenticate(req: Request, res: Response): Promise<AuthOutcome> {
    // 1) Session cookie — admin/editor/viewer logged into /admin/*.
    try {
        const session = await sessionFromReq(req as any, res as any, authOptions);
        if (session.kind === 'admin' && session.email) {
            const token = virtualTokenForSession(session);
            return {kind: 'cookie', token, tokenSecret: '', session};
        }
    } catch (err) {
        log.warn({scope: 'mcp.http.auth.cookie', err}, 'cookie auth check threw — falling back to bearer');
    }

    // 2) Bearer token.
    const rawToken = readBearer(req);
    if (!rawToken) {
        return {kind: 'denied', status: 401, body: {error: 'auth required: NextAuth admin session cookie OR bearer token'}};
    }
    const tokenSvc = getMongoConnection().mcpTokenService;
    if (!tokenSvc) {
        return {kind: 'denied', status: 503, body: {error: 'mcp token service not ready'}};
    }
    const token = await tokenSvc.verifyToken(rawToken);
    if (!token) {
        return {kind: 'denied', status: 401, body: {error: 'invalid or revoked token'}};
    }
    void tokenSvc.markUsed(token.id);
    return {kind: 'bearer', token, tokenSecret: rawToken};
}

async function handleMcp(req: Request, res: Response): Promise<void> {
    const ip = clientIp(req);
    if (!ipAllowed(ip)) {
        res.status(403).json({error: 'forbidden by IP allowlist'});
        return;
    }

    const auth = await authenticate(req, res);
    if (auth.kind === 'denied') {
        res.status(auth.status).json(auth.body);
        return;
    }
    const {token, tokenSecret} = auth;
    const authPath: 'bearer' | 'cookie' = auth.kind;

    if (!rateLimitOk(token.id)) {
        res.status(429).json({error: 'rate limit exceeded'});
        return;
    }

    // Reuse an existing session if the client supplied a session id.
    const sessionId = req.headers['mcp-session-id'];
    if (typeof sessionId === 'string' && sessions.has(sessionId)) {
        const entry = sessions.get(sessionId)!;
        if (entry.token.id !== token.id) {
            // Identity swap mid-session — close the door. Either an
            // attacker with a different cred tried to hijack, or the
            // user logged out and back in as someone else; either way
            // require re-init.
            res.status(403).json({error: 'session identity mismatch'});
            return;
        }
        await entry.transport.handleRequest(req, res, req.body);
        return;
    }

    // No session id, OR session id unknown. Initialize requests are
    // allowed to mint a fresh session; non-initialize calls without a
    // valid session must fail per the MCP spec.
    if (req.method === 'POST' && isInitializeRequest(req.body)) {
        const {transport} = await buildServerForToken(token, tokenSecret, authPath);
        log.info(
            {scope: 'mcp.http.session.open', authPath, identity: token.id, scopes: token.scopes.length},
            'mcp session opened',
        );
        await transport.handleRequest(req, res, req.body);
        return;
    }

    res.status(400).json({error: 'invalid or missing Mcp-Session-Id header'});
}

async function main() {
    const conn = getMongoConnection();
    let attempts = 0;
    while (!conn.mcpTokenService && attempts < 100) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }
    if (!conn.mcpTokenService) {
        log.error({scope: 'mcp.http.boot'}, 'MongoDB not ready; aborting');
        process.exit(2);
    }

    const app = express();
    app.disable('x-powered-by');
    // We're behind Caddy / the docker bridge — trust the immediate hop
    // so `req.ip` reflects the original client. Caddy sets
    // X-Forwarded-For; `loopback` covers single-hop bridges as well.
    app.set('trust proxy', 'loopback');
    app.use(express.json({limit: '1mb'}));

    app.get('/healthz', (_req, res) => {
        res.json({ok: true, sessions: sessions.size});
    });

    app.all('/mcp', (req, res, next) => {
        handleMcp(req, res).catch(next);
    });

    // Express default error handler wraps unhandled rejections — emit a
    // stable JSON shape so the SDK client can parse failures.
    app.use((err: unknown, _req: Request, res: Response, _next: any) => {
        log.error({scope: 'mcp.http.error', err}, 'unhandled mcp error');
        if (!res.headersSent) {
            res.status(500).json({error: 'internal error'});
        }
    });

    app.listen(PORT, BIND, () => {
        log.info(
            {scope: 'mcp.http.listen', bind: BIND, port: PORT, allowedIps: ALLOWED_IPS.length},
            'mcp http transport ready',
        );
    });
}

main().catch(err => {
    log.error({scope: 'mcp.http.fatal', err}, 'fatal');
    process.exit(1);
});
