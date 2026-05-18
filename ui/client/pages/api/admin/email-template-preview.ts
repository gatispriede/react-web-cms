/**
 * W6a — Admin email template preview endpoint.
 *
 * POSTs `{template, fixture?, themeOverrides?}`; returns the rendered
 * subject + HTML + plaintext. Mirrors the MCP `email.preview` tool so
 * the admin pane and AI callers run through the same renderer.
 *
 * Admin/editor/viewer session required — no anonymous access (the
 * preview HTML could leak operator branding before site launch).
 */
import type {NextApiRequest, NextApiResponse} from 'next';
import {requireRole} from '@client/lib/api-helpers/authHelpers';
import {requireSameOrigin} from '@client/lib/api-helpers/origin';
import {renderTemplate, listTemplates} from '@services/features/Email/templates/registry';
import {resolveEmailTheme} from '@services/features/Email/templates/_shared/theme';
import sampleReceiptFixture from '@services/features/Email/templates/_fixtures/sample-receipt.json';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({error: 'Method not allowed'});
    }
    if (!requireSameOrigin(req, res)) return;
    const auth = await requireRole(req, res, 'viewer');
    if (!auth.ok) return;

    let body: any = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }
    const template = String(body?.template ?? '').trim();
    const tpls = listTemplates();
    if (!tpls.some(t => t.id === template)) {
        return res.status(400).json({
            error: `Unknown template "${template}". Known: ${tpls.map(t => t.id).join(', ')}`,
        });
    }
    const fixture = body?.fixture ?? (
        ['receipt', 'order-confirmation', 'shipped'].includes(template)
            ? sampleReceiptFixture
            : undefined
    );
    if (!fixture) {
        return res.status(400).json({
            error: `Template "${template}" has no bundled fixture — supply one via "fixture".`,
        });
    }
    try {
        const theme = resolveEmailTheme(body?.themeOverrides ?? {});
        const rendered = renderTemplate(template, fixture, theme);
        return res.status(200).json(rendered);
    } catch (err) {
        return res.status(500).json({error: String((err as Error)?.message ?? err)});
    }
}
