/**
 * Public-site contact form ("Send a brief") submission endpoint.
 *
 * Flow:
 *   1. POST guard
 *   2. Rate-limit per IP (3 in 5 min) — submission storms get a 429
 *   3. Honeypot field check — bots fill `website`, humans don't see it
 *   4. Payload validation — required string fields, length caps,
 *      plausible email shape
 *   5. Settings load — recipient address + master enable flag come
 *      from `siteFlags`; admin can rotate them without redeploy
 *   6. Send via nodemailer (env-configured SMTP) — see
 *      `_inquiryMailer.ts`
 *   7. Audit row inserted into Mongo `Inquiries` collection so even if
 *      the SMTP send fails the operator still has a record
 *
 * No auth on this endpoint — it's the public-facing contact form. The
 * defensive layers above (rate-limit, honeypot, validation, length caps)
 * are intentionally redundant rather than relying on a single gate.
 */

import type {NextApiRequest, NextApiResponse} from 'next';
import guid from '@utils/guid';
import {requireSameOrigin} from './_origin';
import {clientIp, rateLimit} from './_rateLimit';
import {sendInquiryEmail} from './_inquiryMailer';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

/** Strip CR/LF and other control chars before splicing user input into
 *  email headers. Without this an attacker could inject `Bcc:` / `From:`
 *  via the `name` or `topic` field — nodemailer doesn't sanitise header
 *  values for us. Legitimate user input never has these characters. */
const stripHeaderChars = (s: string): string =>
    s.replace(/[\r\n\t\v\f\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim();

/** Compare a request's Origin / Referer against a comma-separated allow
 *  list. A leading `*.` wildcard matches the apex domain plus all
 *  subdomains: `*.funisimo.pro` accepts `funisimo.pro`, `www.funisimo.pro`,
 *  etc. Plain hostnames (`funisimo.pro`) are exact-match. Full URLs
 *  (`https://funisimo.pro`) are reduced to host before comparison. */
function originMatchesAllowList(reqOrigin: string, allowList: string): boolean {
    const list = allowList.split(',').map(s => s.trim()).filter(Boolean);
    if (list.length === 0) return true;
    let originHost = '';
    try {
        originHost = new URL(reqOrigin).host.toLowerCase();
    } catch {
        return false;
    }
    return list.some(entry => {
        // Reduce the entry to its host portion. Try URL-parse first so
        // `https://funisimo.pro` becomes `funisimo.pro`. If parse fails
        // (plain hostname or wildcard like `*.funisimo.pro`) keep the
        // entry literal — the wildcard check handles it.
        let bare = entry.trim().toLowerCase();
        try {
            bare = new URL(bare).host.toLowerCase();
        } catch { /* plain or wildcard — keep as-is */ }

        if (bare.startsWith('*.')) {
            const suffix = bare.slice(2);
            return originHost === suffix || originHost.endsWith('.' + suffix);
        }
        return originHost === bare;
    });
}

interface InquiryPayload {
    topic?: string;
    name?: string;
    email?: string;
    message?: string;
    /** Honeypot — should be empty on every legitimate submission. */
    website?: string;
    [k: string]: unknown;
}

const MAX_LEN = {
    topic: 80,
    name: 120,
    email: 200,
    message: 4000,
};

const isString = (v: unknown): v is string => typeof v === 'string';
const trim = (v: unknown): string => (isString(v) ? v.trim() : '');
const isPlausibleEmail = (s: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= MAX_LEN.email;

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({error: 'Method not allowed'});
    }
    // We DO NOT call `requireSameOrigin` here unconditionally — the
    // explicit allow-list (loaded below from siteFlags) is meant to
    // *replace* same-origin when set. If the allow-list is empty we
    // fall back to a same-origin check at the right point in the flow.
    const ip = clientIp(req);
    // 3 submissions per IP per 5 minutes. The contact form is low-volume
    // by design; this stops noisy spammer floods without ever bothering
    // a real visitor sending 1-2 inquiries.
    const rl = rateLimit(`inquiry:${ip}`, 3, 5 * 60_000);
    if (!rl.ok) {
        res.setHeader('Retry-After', Math.ceil(rl.retryAfterMs / 1000));
        return res.status(429).json({error: 'Too many submissions, please try again later.'});
    }

    let body: InquiryPayload;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
        return res.status(400).json({error: 'Invalid JSON payload'});
    }
    if (!body || typeof body !== 'object') {
        return res.status(400).json({error: 'Invalid payload'});
    }

    // Honeypot — silently 200 so bots don't learn they were detected.
    if (trim(body.website).length > 0) {
        return res.status(200).json({ok: true});
    }

    const topic = trim(body.topic).slice(0, MAX_LEN.topic);
    const name = trim(body.name).slice(0, MAX_LEN.name);
    const email = trim(body.email).slice(0, MAX_LEN.email);
    const message = trim(body.message).slice(0, MAX_LEN.message);

    if (!name) return res.status(400).json({error: 'Name is required'});
    if (!email || !isPlausibleEmail(email)) {
        return res.status(400).json({error: 'A valid email is required'});
    }
    if (!message) return res.status(400).json({error: 'Message is required'});

    // Load settings — recipient address, enable flag, allowed origins,
    // per-client cap. We piggy-back on the connection's
    // `siteFlagsService` so we don't need access to the private `db`
    // handle. Wait briefly for first-boot Mongo init to finish.
    const connection = getMongoConnection();
    for (let i = 0; i < 30 && !connection.siteFlagsService; i++) {
        await new Promise(r => setTimeout(r, 100));
    }
    if (!connection.siteFlagsService) {
        return res.status(503).json({error: 'Database not ready'});
    }
    const flags = await connection.siteFlagsService.get();
    if (flags.inquiryEnabled === false) {
        return res.status(503).json({error: 'Inquiry form is currently disabled'});
    }

    // Origin gate — exactly one of the two checks runs:
    //   * Allow-list set → request Origin must match an entry. Used
    //     when the same image runs across multiple deployments and we
    //     want to lock submissions to a canonical domain.
    //   * Allow-list empty → same-origin only (request Origin matches
    //     request Host). Sane default; works on localhost dev too.
    const allow = (flags.inquiryAllowedOrigins ?? '').trim();
    if (allow) {
        const origin = String(req.headers.origin ?? req.headers.referer ?? '');
        if (!originMatchesAllowList(origin, allow)) {
            return res.status(403).json({error: 'Origin not allowed'});
        }
    } else {
        if (!requireSameOrigin(req, res)) return;
    }

    // Lifetime per-client quota — count audited inquiries from this IP
    // and reject when they've reached the configured cap. Defence
    // against abuse where one IP / one office NAT keeps spamming the
    // form long after the per-window rate-limiter cools off.
    const maxPerClient = typeof flags.inquiryMaxPerClient === 'number'
        ? flags.inquiryMaxPerClient
        : 3;
    if (maxPerClient > 0 && connection.database) {
        // Count successful AND failed audits — failed-SMTP rows still
        // mean the visitor reached us, which is what the cap counts.
        const seen = await connection.database
            .collection('Inquiries')
            .countDocuments({ip});
        if (seen >= maxPerClient) {
            return res.status(429).json({
                error: 'You have reached the maximum number of messages from this address.',
            });
        }
    }

    const recipient = flags.inquiryRecipientEmail || 'gatiss.priede@inbox.lv';

    // Compose email — plain text is required, HTML is the rich version.
    // Header-bound fields (subject) get CR/LF + control chars stripped to
    // prevent header injection (`name=Foo\r\nBcc: leak@evil.com\r\n`
    // would otherwise smuggle a Bcc header). Body content keeps newlines
    // because they're harmless inside the body.
    const subjectPrefix = '[funisimo.pro inquiry]';
    const safeName = stripHeaderChars(name);
    const safeTopic = stripHeaderChars(topic);
    const subject = safeTopic
        ? `${subjectPrefix} ${safeTopic} — ${safeName}`
        : `${subjectPrefix} ${safeName}`;

    // Use the CR/LF-stripped versions for the identifier line so a
    // malformed `name` field doesn't make the email body look like it
    // contains forged headers (e.g. "Bcc: leaked@evil.com" appearing as
    // body text). The user's `message` keeps its newlines — that's the
    // intended free-text field.
    const text = [
        `New inquiry from ${safeName} <${email}>`,
        safeTopic ? `Topic: ${safeTopic}` : '',
        '',
        message,
        '',
        '---',
        `IP: ${ip}`,
        `User-Agent: ${stripHeaderChars((req.headers['user-agent'] as string) ?? '(unknown)')}`,
        `Submitted: ${new Date().toISOString()}`,
    ].filter(Boolean).join('\n');

    const html = `
        <p><strong>New inquiry</strong></p>
        <p>From: <strong>${escapeHtml(safeName)}</strong>
            &lt;<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>&gt;</p>
        ${safeTopic ? `<p>Topic: <strong>${escapeHtml(safeTopic)}</strong></p>` : ''}
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
        <hr/>
        <p style="color:#666;font-size:90%">
            IP: ${escapeHtml(ip)}<br/>
            Submitted: ${escapeHtml(new Date().toISOString())}
        </p>`.trim();

    const mailResult = await sendInquiryEmail({
        to: recipient,
        subject,
        text,
        html,
        replyTo: email,
    });

    // Audit insert is best-effort. We log even on success so the operator
    // has a backup of the email content in Mongo, and we log on failure
    // so the operator can recover the missed message manually. Failures
    // here don't bubble — the email already either worked or didn't.
    try {
        await connection.database?.collection('Inquiries').insertOne({
            id: guid(),
            createdAt: new Date().toISOString(),
            ip,
            userAgent: (req.headers['user-agent'] as string) ?? '',
            topic,
            name,
            email,
            message,
            recipient,
            mail: {
                ok: mailResult.ok,
                error: mailResult.error,
                messageId: mailResult.messageId,
            },
        });
    } catch (err) {
        console.error('[api/inquiry] audit insert failed:', err);
    }

    if (!mailResult.ok) {
        // Don't expose the SMTP error verbatim to a public visitor; the
        // server log has the detail. They get a generic message and can
        // still try again.
        return res.status(502).json({
            error: 'We could not deliver your message right now. Please try again or email directly.',
        });
    }
    return res.status(200).json({ok: true});
}
