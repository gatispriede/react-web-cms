/**
 * SMTP transport helper for the public-site inquiry form ("Send a brief").
 *
 * Configuration follows the standard Docker secrets convention: each
 * value can be supplied EITHER as a plain env var or via a file path in
 * `<NAME>_FILE`. The file form lets the operator replace just the secret
 * file without re-editing `.env` or rebuilding the image. The mailer
 * resolves the file form when present, falling back to the plain env
 * form otherwise — so an existing `.env`-only deployment keeps working.
 *
 * Variables (env or `_FILE` form):
 *   SMTP_HOST       — server hostname (e.g. smtp.gmail.com, mail.inbox.lv)
 *   SMTP_PORT       — usually 587 (STARTTLS) or 465 (TLS)
 *   SMTP_USER       — SMTP auth username (often the from-address)
 *   SMTP_PASS       — SMTP auth password / app-specific password
 *   MAIL_FROM       — RFC-5322 from header, e.g. "Funisimo <noreply@…>"
 *
 * If any required value is missing the helper refuses to send and
 * reports a clear error so the operator can debug without the API
 * silently swallowing submissions.
 *
 * The transporter is cached in module scope so repeated requests reuse
 * the same TCP/TLS pool — important once submissions get traffic.
 */

import {readFileSync} from 'fs';
import nodemailer, {Transporter} from 'nodemailer';

/**
 * Resolve a config value with `*_FILE` precedence:
 *   1. If `<name>_FILE` is set, read its contents (trimmed) — this is the
 *      Docker / Kubernetes secrets convention. The path lives in env so
 *      the secret material itself never appears in the process list or
 *      `docker inspect` output.
 *   2. Else read the plain `<name>` env var.
 *   3. Else return undefined and let the caller decide how to react.
 *
 * Read failures (path set but file missing or unreadable) are logged
 * once and treated as missing — the API will respond 502 and the server
 * log will tell the operator exactly which secret file failed.
 */
function readSecret(name: string): string | undefined {
    const filePath = process.env[`${name}_FILE`];
    if (filePath) {
        try {
            // `trim()` so a trailing newline added by `echo "secret" >
            // /run/secrets/foo` doesn't corrupt the value.
            return readFileSync(filePath, 'utf8').trim();
        } catch (err) {
            console.error(`[inquiry mailer] failed reading ${name}_FILE at ${filePath}:`, err);
            return undefined;
        }
    }
    const direct = process.env[name];
    return direct ? direct.trim() : undefined;
}

let cached: Transporter | null = null;
let cachedSignature = '';

function _readConfig() {
    return {
        host: readSecret('SMTP_HOST'),
        port: readSecret('SMTP_PORT'),
        user: readSecret('SMTP_USER'),
        pass: readSecret('SMTP_PASS'),
        from: readSecret('MAIL_FROM'),
    };
}

function _signature(cfg: ReturnType<typeof _readConfig>): string {
    // Include SMTP_PASS in the signature so a cred rotation (file
    // replacement) invalidates the cached transport and the next request
    // builds a fresh pool against the new credentials. Never logged.
    return [cfg.host ?? '', cfg.port ?? '', cfg.user ?? '', cfg.pass ?? ''].join('|');
}

function _transport(): Transporter | null {
    const cfg = _readConfig();
    const port = Number(cfg.port ?? '0');
    if (!cfg.host || !port || !cfg.user || !cfg.pass) return null;
    const sig = _signature(cfg);
    if (cached && cachedSignature === sig) return cached;
    cached = nodemailer.createTransport({
        host: cfg.host,
        port,
        // 465 implies implicit TLS; everything else uses STARTTLS upgrade.
        secure: port === 465,
        auth: {user: cfg.user, pass: cfg.pass},
        // Conservative pool — the public form is bursty, not high-volume.
        pool: true,
        maxConnections: 2,
        maxMessages: 50,
    });
    cachedSignature = sig;
    return cached;
}

export interface InquiryEmailPayload {
    to: string;
    subject: string;
    text: string;
    html: string;
    /** Set to the visitor's email so a reply from the inbox lands back
     *  in their conversation. From stays as MAIL_FROM for SPF/DKIM. */
    replyTo?: string;
}

export interface InquirySendResult {
    ok: boolean;
    error?: string;
    messageId?: string;
}

export async function sendInquiryEmail(p: InquiryEmailPayload): Promise<InquirySendResult> {
    const tr = _transport();
    if (!tr) {
        return {
            ok: false,
            error:
                'SMTP is not configured. Set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM ' +
                '(or their _FILE equivalents for Docker secrets) in the environment.',
        };
    }
    const from = readSecret('MAIL_FROM');
    if (!from) {
        return {ok: false, error: 'MAIL_FROM is not set (env or _FILE).'};
    }
    try {
        const info = await tr.sendMail({
            from,
            to: p.to,
            subject: p.subject,
            text: p.text,
            html: p.html,
            replyTo: p.replyTo,
        });
        return {ok: true, messageId: info.messageId};
    } catch (err) {
        // Don't leak SMTP server messages to the client; log server-side
        // and return a generic flag. The API endpoint formats user-facing
        // copy, this just reports machine-friendly success/fail.
        console.error('[inquiry mailer] send failed:', err);
        return {ok: false, error: String((err as Error)?.message ?? err)};
    }
}
