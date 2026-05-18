/**
 * Admin "Test send" endpoint. POSTs `{to}`, calls EmailService through
 * the live SiteFlags.mail block. Admin-rank only — wraps `requireRole`.
 *
 *   curl -XPOST /api/email/test -d '{"to":"you@example.com"}'
 *
 * Mirrors the MCP `email.config.test` tool surface for the admin UI
 * which doesn't have an MCP token to call directly.
 */
import type {NextApiRequest, NextApiResponse} from 'next';
import {requireRole} from '@client/lib/api-helpers/authHelpers';
import {requireSameOrigin} from '@client/lib/api-helpers/origin';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {sendEmail} from '@services/features/Email/EmailService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({error: 'Method not allowed'});
    }
    if (!requireSameOrigin(req, res)) return;
    const auth = await requireRole(req, res, 'admin');
    if (!auth.ok) return;

    let body: any = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }
    const to = String(body?.to ?? '').trim();
    if (!to || !to.includes('@')) {
        return res.status(400).json({error: 'Invalid `to` (must look like an email).'});
    }

    try {
        const connection = getMongoConnection();
        for (let i = 0; i < 50 && !connection.siteFlagsService; i++) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (!connection.siteFlagsService) {
            return res.status(503).json({error: 'Mongo not ready'});
        }
        const flags = await connection.siteFlagsService.get();
        const result = await sendEmail((flags as any).mail, {
            to,
            subject: 'Test email from your CMS',
            text: 'If you received this, the email provider is configured correctly.',
            html: '<p>If you received this, the email provider is configured correctly.</p>',
        });
        return res.status(result.ok ? 200 : 502).json({
            ok: result.ok,
            provider: result.provider,
            durationMs: result.durationMs,
            messageId: result.messageId,
            error: result.error,
        });
    } catch (err) {
        console.error('[api/email/test]', err);
        return res.status(500).json({error: String((err as Error)?.message ?? err)});
    }
}
