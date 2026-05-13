/**
 * Admin REST surface for Product Display Templates (Phase 1.F).
 *
 * Single endpoint accepts `{op, ...args}` and dispatches to the matching
 * `ProductTemplateService` method. Same shape as `/api/releases` — keeps
 * the admin UI's network layer tiny while the MCP tool surface remains
 * the canonical API for AI / external callers.
 */

import type {NextApiRequest, NextApiResponse} from 'next';
import {requireRole} from './_authHelpers';
import {requireSameOrigin} from './_origin';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

type Op =
    | 'list'
    | 'get'
    | 'create'
    | 'update'
    | 'delete'
    | 'restore'
    | 'duplicate'
    | 'preview'
    | 'setProductTemplate';

const VALID_OPS: readonly Op[] = [
    'list', 'get', 'create', 'update', 'delete', 'restore',
    'duplicate', 'preview', 'setProductTemplate',
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

    const conn = getMongoConnection();
    const svc = conn.productTemplateService;
    const actor = (auth as any).email ?? 'admin';

    try {
        switch (op) {
            case 'list':
                return res.json(await svc.list({
                    audience: body.audience,
                    includeUsage: body.includeUsage === true,
                }));
            case 'get':
                return res.json(await svc.get(body.id));
            case 'create':
                return res.json(await svc.create(body.input ?? {name: body.name, ...body}, actor));
            case 'update':
                return res.json(await svc.update(body.id, body.patch ?? {}, body.expectedVersion, actor));
            case 'delete':
                // Phase 1.F polish — soft-delete so the admin pane can Undo.
                return res.json(await svc.softDelete(body.id));
            case 'restore':
                return res.json(await svc.restore(body.trashId));
            case 'duplicate':
                return res.json(await svc.duplicate(body.fromId, body.newName ?? '', actor));
            case 'preview': {
                const template = await svc.get(body.id);
                if (!template) return res.status(404).json({error: 'template not found'});
                const productId = body.fixtureProductId;
                let product = productId
                    ? await conn.productService.getById(productId)
                    : null;
                if (!product) {
                    const list = await conn.productService.list({limit: 1});
                    product = Array.isArray(list) ? (list[0] ?? null) : null;
                }
                return res.json({
                    templateId: template.id,
                    template,
                    fixtureProductId: product?.id ?? null,
                    sections: product
                        ? svc.applyTemplate(template, product)
                        : template.sections,
                });
            }
            case 'setProductTemplate': {
                const cur = await conn.productService.getById(body.productId);
                if (!cur) throw new Error(`product not found: ${body.productId}`);
                await conn.productService.save({
                    ...cur,
                    templateId: body.templateId ?? null,
                } as any, actor);
                return res.json({ok: true, productId: body.productId, templateId: body.templateId ?? null});
            }
        }
    } catch (err) {
        return res.status(400).json({error: String((err as Error).message ?? err)});
    }
}
