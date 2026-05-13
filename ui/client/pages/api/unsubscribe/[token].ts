/**
 * W8f — RFC 8058 one-click unsubscribe endpoint.
 *
 *   GET  /api/unsubscribe/<token>   → confirmation page (HTML)
 *   POST /api/unsubscribe/<token>   → executes the unsubscribe (one-click)
 *
 * The token carries `{userId, category | '*', expiresAt}` signed with
 * `secretBox` (see `unsubscribeToken.ts`). We never trust query params
 * for the target user — the token is the only identity authority on
 * this endpoint.
 *
 * Why GET also flips the preference: per RFC 8058, the one-click button
 * in modern mail UIs (Gmail / Yahoo) POSTs, but legacy clients open the
 * link. Both must work end-to-end with zero further confirmation — the
 * customer asked to leave; we don't gate them behind another form.
 */

import type {NextApiRequest, NextApiResponse} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {verifyUnsubscribeToken} from '@services/features/Notifications/unsubscribeToken';
import {rateLimit} from '@client/pages/api/_rateLimit';
import type {NotificationsService} from '@services/features/Notifications/NotificationsService';

function clientIp(req: NextApiRequest): string {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string') return fwd.split(',')[0]!.trim();
    if (Array.isArray(fwd)) return fwd[0]!.trim();
    return req.socket?.remoteAddress ?? 'unknown';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    // Rate-limit by IP to slow down token-guessing.
    const decision = rateLimit(`unsub:${clientIp(req)}`, 30, 60_000);
    if (!decision.ok) {
        res.status(429).json({ok: false, error: 'rate-limited'});
        return;
    }

    const token = String(req.query.token ?? '');
    const payload = verifyUnsubscribeToken(token);
    if (!payload) {
        res.status(400).send(renderError('This unsubscribe link is invalid or has expired.'));
        return;
    }

    const conn = getMongoConnection();
    const notifications = (conn as any).featureServices?.notifications as NotificationsService | undefined;
    if (!notifications) {
        res.status(500).json({ok: false, error: 'notifications service unavailable'});
        return;
    }

    if (req.method === 'POST' || req.method === 'GET') {
        try {
            const updated = payload.category === '*'
                ? await notifications.optOutAllMarketing(payload.userId)
                : await notifications.optOut(payload.userId, payload.category);
            try {
                await conn.auditService?.record({
                    collection: 'NotificationPreferences',
                    docId: payload.userId,
                    op: 'update',
                    actor: {email: 'unsubscribe-link', role: 'customer'},
                    diff: {before: null, after: {category: payload.category, source: 'rfc8058'}},
                    tag: `notifications:unsubscribe:${payload.category}`,
                });
            } catch { /* audit-system failure must never block the opt-out */ }
            if (req.method === 'POST') {
                res.status(200).json({ok: true, prefs: updated});
                return;
            }
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.status(200).send(renderSuccess(payload.category));
            return;
        } catch (err) {
            res.status(500).json({ok: false, error: String((err as Error).message ?? err)});
            return;
        }
    }
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ok: false, error: 'method not allowed'});
}

function renderSuccess(category: string): string {
    const label = category === '*' ? 'all marketing emails' : `the "${category}" notification category`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Unsubscribed</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:system-ui,sans-serif;max-width:520px;margin:60px auto;padding:24px;color:#222}
h1{font-size:20px;margin:0 0 12px}p{line-height:1.5}a{color:#0a58ca}</style></head>
<body data-testid="unsubscribe-success">
<h1>You have been unsubscribed</h1>
<p>You will no longer receive ${escapeHtml(label)}.</p>
<p>Transactional emails (order receipts, account security) will still be delivered — these are required for your account.</p>
<p><a href="/account/notifications" data-testid="unsubscribe-manage-link">Manage all notification preferences</a></p>
</body></html>`;
}

function renderError(msg: string): string {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Unsubscribe failed</title>
<style>body{font-family:system-ui,sans-serif;max-width:520px;margin:60px auto;padding:24px}</style></head>
<body data-testid="unsubscribe-error"><h1>Unable to process</h1><p>${escapeHtml(msg)}</p></body></html>`;
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
}
