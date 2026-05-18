import type {NextApiRequest, NextApiResponse} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {sendEmail} from '@services/features/Email/EmailService';
import {renderTemplate} from '@services/features/Email/templates/registry';
import {resolveEmailTheme} from '@services/features/Email/templates/_shared/theme';
import {clientIp, rateLimit} from '@client/lib/api-helpers/rateLimit';
import {log} from '@services/infra/logger';

/**
 * W6c — issue a magic-link sign-in email.
 *
 * Always returns 200 with a generic "if this email is registered we sent
 * a link" response — never enumerates whether the email exists. The
 * underlying `issueMagicLinkToken` short-circuits with the same response
 * shape on validation failure / rate-limit miss; the only branches that
 * widen the visible error are infrastructure failures (mail provider
 * disabled etc.) which an operator will see in server logs.
 *
 * Per-IP rate-limit (10/min) layered on top of the per-email cooldown
 * in the service (5/hour). Defeats both targeted enumeration scans and
 * scripted spam.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({error: 'POST only'});
    }
    const ip = clientIp(req as any);
    const rl = rateLimit(`magic-request:${ip}`, 10, 60_000);
    if (!rl.ok) {
        return res.status(429).json({ok: true}); // intentional no-leak
    }
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!email || !/.+@.+\..+/.test(email)) {
        return res.status(400).json({error: 'invalid email'});
    }
    const callbackUrl = String(req.body?.callbackUrl ?? '/account');

    try {
        const conn = getMongoConnection();
        const svc = (conn as any).featureServices?.customerAuth;
        if (!svc?.issueMagicLinkToken) {
            log.warn({scope: 'magic.request'}, 'customerAuth feature disabled — no magic-link');
            return res.status(200).json({ok: true});
        }
        const issued = await svc.issueMagicLinkToken({email});
        if ((issued as any).error) {
            // Treat all soft errors (rate-limit, validation) as opaque
            // success — same response shape as a successful issue.
            return res.status(200).json({ok: true});
        }
        const token = (issued as any).token as string;
        const siteUrl = (process.env.SITE_URL ?? '').replace(/\/$/, '');
        const verifyUrl = `${siteUrl}/account/verify?token=${encodeURIComponent(token)}&callbackUrl=${encodeURIComponent(callbackUrl)}`;

        const flags = await conn.siteFlagsService.get();
        const theme = resolveEmailTheme({
            siteName: process.env.SITE_NAME || (flags as any).siteName || 'Funisimo',
            siteUrl,
        });
        const rendered = renderTemplate('magic-link', {
            magicUrl: verifyUrl,
            expiryMinutes: 15,
            requestContext: ip,
        }, theme);
        const sendRes = await sendEmail((flags as any).mail, {
            to: email,
            subject: rendered.subject,
            text: rendered.text,
            html: rendered.html,
        }, {tag: 'magic-link'});
        if (!sendRes.ok) {
            log.warn({scope: 'magic.request', email, error: sendRes.error}, 'magic-link send failed');
        }
        return res.status(200).json({ok: true});
    } catch (err) {
        log.error({scope: 'magic.request', err}, 'magic-request handler failed');
        // Same opaque response — never leak.
        return res.status(200).json({ok: true});
    }
}
