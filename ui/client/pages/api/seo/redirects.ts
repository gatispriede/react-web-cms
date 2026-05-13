import type {NextApiRequest, NextApiResponse} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {getServerSession} from 'next-auth/next';
import {adminAuthOptions as authOptions} from '@client/pages/api/auth/authOptions';
import type {IRedirect} from '@interfaces/IRedirect';

/**
 * Admin REST endpoint for the W8h SEO redirect table.
 *
 *   GET    /api/seo/redirects          → list every row
 *   POST   /api/seo/redirects          → create
 *   PATCH  /api/seo/redirects?id=...   → update (version-checked)
 *   DELETE /api/seo/redirects?id=...   → delete
 *
 * Why a fresh route vs riding the GraphQL surface: redirects are a
 * small operator-facing CRUD with no SDL footprint elsewhere, and the
 * MCP tool layer already provides the same shape for agents. Keeping
 * this REST instead of growing the schema keeps the surface area
 * scoped to the W8h roadmap item.
 *
 * Auth: admin or editor session. The session is admin-cookie-based —
 * unauthenticated callers get 401 + nothing else; non-admin / non-
 * editor get 403.
 */
async function requireEditor(req: NextApiRequest, res: NextApiResponse): Promise<{email: string} | null> {
    try {

        const session = await getServerSession(req, res, authOptions as any) as any;
        const email = session?.user?.email;
        const role = session?.user?.role;
        if (!email) {
            res.status(401).json({error: 'unauthenticated'});
            return null;
        }
        if (role !== 'admin' && role !== 'editor') {
            res.status(403).json({error: 'forbidden'});
            return null;
        }
        return {email: String(email).toLowerCase()};
    } catch {
        res.status(401).json({error: 'unauthenticated'});
        return null;
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    const actor = await requireEditor(req, res);
    if (!actor) return;
    const svc = getMongoConnection().redirectsService;
    if (!svc) {
        res.status(503).json({error: 'redirects service not available'});
        return;
    }
    try {
        if (req.method === 'GET') {
            const rows = await svc.list();
            res.status(200).json({redirects: rows});
            return;
        }
        if (req.method === 'POST') {
            const body = (req.body ?? {}) as IRedirect;
            const created = await svc.create(body, actor.email);
            res.status(201).json(created);
            return;
        }
        if (req.method === 'PATCH') {
            const id = typeof req.query.id === 'string' ? req.query.id : '';
            const body = {...(req.body ?? {}), id} as IRedirect;
            const updated = await svc.update(body, actor.email);
            res.status(200).json(updated);
            return;
        }
        if (req.method === 'DELETE') {
            const id = typeof req.query.id === 'string' ? req.query.id : '';
            const out = await svc.delete(id);
            res.status(200).json(out);
            return;
        }
        res.status(405).json({error: 'method not allowed'});
    } catch (err) {
        const msg = String((err as Error)?.message ?? err);
        res.status(400).json({error: msg});
    }
}
