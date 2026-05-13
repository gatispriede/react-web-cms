import type {NextApiRequest, NextApiResponse} from 'next';
import {ROLE_RANK, sessionFromReq} from '@services/features/Auth/authz';
import {adminAuthOptions as authOptions} from './authOptions';
import {resetAllLockouts} from '../_loginLockout';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {log} from '@services/infra/logger';

/**
 * Operator endpoint — clears the in-process login-lockout bucket.
 *
 * Auth (audited paths only — no shared-secret bypass):
 *   1. Admin NextAuth session (role >= admin), OR
 *   2. MCP token with `admin:auth` scope — first-class audited credential
 *      issued via `/admin/system/mcp`, scoped + revocable + observable in
 *      `audit.list` / `audit.errors`.
 *
 * If an operator has lost both paths (no admin session, no MCP token),
 * the recovery path is a server restart (which evaporates the in-process
 * map as a side effect).
 *
 * The lockout map lives in process memory. This endpoint is for the
 * "colleague typo'd their password and is locked out, I'm signed in as
 * admin" case, and for the `auth.resetLockouts` MCP tool an AI client
 * can call when the same human is at the keyboard.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({error: 'POST only'});
    }

    let actor: string | null = null;

    // Path 1 — admin NextAuth session.
    try {
        const session = await sessionFromReq(req, res, authOptions);
        if (session && ROLE_RANK[session.role] >= ROLE_RANK.admin) {
            actor = `admin:${(session as any).email ?? (session as any).userId ?? 'unknown'}`;
        }
    } catch { /* fall through */ }

    // Path 2 — MCP token with `admin:auth` scope. Bearer header only —
    // not via cookie / query string so the credential never lands in
    // referrer logs.
    if (!actor) {
        const auth = req.headers.authorization ?? '';
        const m = /^Bearer\s+(\S+)$/i.exec(auth);
        if (m) {
            try {
                const mongo = getMongoConnection();
                const tok = await mongo.mcpTokenService?.verifyToken(m[1]);
                if (tok && tok.scopes?.includes('admin:auth')) {
                    actor = `mcp:${tok.id}`;
                }
            } catch (err) {
                log.warn({scope: 'auth.lockout.reset', err}, 'mcp verify failed');
            }
        }
    }

    if (!actor) {
        return res.status(401).json({error: 'admin session or MCP token (scope: admin:auth) required'});
    }

    const {cleared} = resetAllLockouts();
    log.warn({scope: 'auth.lockout.reset', actor, cleared}, 'login lockouts cleared');
    return res.status(200).json({ok: true, cleared});
}
