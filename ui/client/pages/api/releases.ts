/**
 * Admin REST surface for Content Releases.
 *
 * Single endpoint accepts `{op, ...args}` and dispatches to the
 * matching `ReleaseService` method. Keeps the admin UI's network layer
 * tiny (no per-operation route file) while preserving the same auth +
 * same-origin guards every other admin route uses. The MCP tool
 * surface (services/features/Mcp/tools/releases.ts) is the canonical
 * API; this endpoint exists so the admin UI doesn't have to embed an
 * MCP token to call its own backend.
 */

import type {NextApiRequest, NextApiResponse} from 'next';
import {requireRole} from '@client/lib/api-helpers/authHelpers';
import {requireSameOrigin} from '@client/lib/api-helpers/origin';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

type Op =
    | 'list'
    | 'get'
    | 'create'
    | 'update'
    | 'delete'
    | 'attach'
    | 'detach'
    | 'publish'
    | 'rollback'
    | 'previewAt';

const VALID_OPS: readonly Op[] = [
    'list', 'get', 'create', 'update', 'delete',
    'attach', 'detach', 'publish', 'rollback', 'previewAt',
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({error: 'Method not allowed'});
    }
    if (!requireSameOrigin(req, res)) return;
    const auth = await requireRole(req, res, 'editor');
    if (!auth.ok) return;

    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
    const op = body.op as Op;
    if (!VALID_OPS.includes(op)) {
        return res.status(400).json({error: `unknown op: ${op}`});
    }

    const svc = getMongoConnection().releaseService;
    const actor = (auth as any).email ?? 'admin';

    try {
        switch (op) {
            case 'list':       return res.json(await svc.list({status: body.status}));
            case 'get':        return res.json(await svc.get(body.id));
            case 'previewAt':  return res.json(await svc.previewAt(body.id));
            case 'create':     return res.json(await svc.create({title: body.title, description: body.description, actor}));
            case 'update':     return res.json(await svc.update(body.id, body.patch ?? {}, body.expectedVersion));
            case 'delete':     await svc.delete(body.id); return res.json({deleted: true});
            case 'attach':     return res.json(await svc.attach({releaseId: body.releaseId, entity: body.entity, id: body.id, actor}));
            case 'detach':     return res.json(await svc.detach(body.releaseId, body.entity, body.id));
            case 'publish':    return res.json(await svc.publish({releaseId: body.id, expectedVersion: body.expectedVersion, actor}));
            case 'rollback':   return res.json(await svc.rollback(body.id, actor));
        }
    } catch (err) {
        return res.status(400).json({error: String((err as Error).message ?? err)});
    }
}
