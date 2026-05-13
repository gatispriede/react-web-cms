/**
 * W8c — Resend webhook receiver.
 *
 *   POST /api/email/webhook
 *
 * Verifies the Standard-Webhooks signature with `RESEND_WEBHOOK_SECRET`,
 * persists every event to `EmailEventLog`, and lands hard-bounces +
 * spam-complaints in the suppression list. Soft bounces get a 14-day
 * TTL suppression (auto-expires).
 *
 * Returns 200 on success; the operator's Resend dashboard surfaces
 * non-2xx as a delivery failure. We MUST NOT throw past the verifier:
 * bad signatures get a 401; everything else is best-effort 200 so
 * Resend doesn't retry-storm us on a transient Mongo blip.
 */

import type {NextApiRequest, NextApiResponse} from 'next';
import {verifyResendWebhook, WebhookVerifyError} from '@services/features/Email/webhookVerify';
import {getSuppressionList, getEmailLog} from '@services/features/Email/emailServices';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import type {EmailSuppressionKind} from '@interfaces/IEmailSuppression';

// Disable Next's auto JSON parser — signature verification needs the
// raw body byte-exact.
export const config = {api: {bodyParser: false}};

async function readRawBody(req: NextApiRequest): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer | string) => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function pickRecipient(data: Record<string, unknown> | undefined): string | null {
    if (!data) return null;
    const to = data.to;
    if (typeof to === 'string') return to;
    if (Array.isArray(to) && typeof to[0] === 'string') return to[0];
    if (typeof data.email === 'string') return data.email;
    return null;
}

function mapBounceKind(data: Record<string, unknown>): {kind: EmailSuppressionKind; bounceType?: string} {
    const bt = data['bounce_type'] ?? (data['bounce'] as Record<string, unknown> | undefined)?.['type'];
    const bounceType = typeof bt === 'string' ? bt.toLowerCase() : undefined;
    if (bounceType === 'hard' || bounceType === 'permanent') {
        return {kind: 'bounced-hard', bounceType};
    }
    return {kind: 'bounced-soft', bounceType};
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({error: 'POST only'});
    }

    const secret = process.env.RESEND_WEBHOOK_SECRET ?? '';
    let rawBody = '';
    try {
        rawBody = await readRawBody(req);
    } catch (err) {
        return res.status(400).json({error: 'read body failed', detail: String((err as Error).message)});
    }

    let event;
    try {
        event = verifyResendWebhook(rawBody, req.headers, secret);
    } catch (err) {
        const e = err as WebhookVerifyError;

        console.warn('[email.webhook] signature verify failed:', e.code, e.message);
        return res.status(401).json({error: e.code, message: e.message});
    }

    const type = String(event.type ?? '');
    const data = (event.data ?? {}) as Record<string, unknown>;
    const recipient = pickRecipient(data);
    const messageId = typeof data['email_id'] === 'string'
        ? (data['email_id'] as string)
        : typeof data['id'] === 'string' ? (data['id'] as string) : undefined;

    // Persist the event row first — never block on it.
    const logSvc = getEmailLog();
    if (logSvc && recipient) {
        void logSvc.recordEvent({
            type: type as never,
            to: recipient,
            messageId,
            bounceType: typeof data['bounce_type'] === 'string' ? (data['bounce_type'] as string) : undefined,
            diagnostic: typeof data['diagnostic'] === 'string' ? (data['diagnostic'] as string) : undefined,
            raw: data,
        });
    }

    // Audit log — operator visibility on every webhook event.
    try {
        const audit = getMongoConnection().auditService;
        if (audit) {
            void audit.record({
                actor: {email: 'webhook:resend'},
                collection: 'EmailEventLog',
                op: 'create',
                tag: type,
                diff: {after: {to: recipient, type, messageId, bounceType: data['bounce_type']}},
            });
        }
    } catch { /* audit failure non-fatal */ }

    // Suppression for hard bounces + complaints + soft (TTL'd).
    if (recipient) {
        const sup = getSuppressionList();
        if (sup) {
            try {
                if (type === 'email.bounced') {
                    const {kind, bounceType} = mapBounceKind(data);
                    await sup.add({
                        email: recipient,
                        kind,
                        reason: typeof data['diagnostic'] === 'string'
                            ? (data['diagnostic'] as string)
                            : bounceType,
                        addedBy: 'webhook:resend',
                        sourceMessageId: messageId,
                    });
                } else if (type === 'email.complained') {
                    await sup.add({
                        email: recipient,
                        kind: 'complained',
                        reason: 'spam-complaint',
                        addedBy: 'webhook:resend',
                        sourceMessageId: messageId,
                    });
                }
            } catch (err) {

                console.warn('[email.webhook] suppression write failed:', (err as Error).message);
            }
        }
    }

    return res.status(200).json({ok: true, type, recorded: Boolean(recipient)});
}
