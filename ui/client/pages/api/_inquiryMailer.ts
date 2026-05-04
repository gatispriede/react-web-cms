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
        // Implicit TLS on 465 (canonical) and 2465 (alternate that
        // some providers — Resend included — publish for cases where
        // 465 is blocked at the cloud-provider firewall, as
        // DigitalOcean does by default). Every other port uses
        // STARTTLS upgrade, including 587 / 2587.
        secure: port === 465 || port === 2465,
        auth: {user: cfg.user, pass: cfg.pass},
        // Conservative pool — the public form is bursty, not high-volume.
        pool: true,
        maxConnections: 2,
        maxMessages: 50,
        // Hard timeouts — without these nodemailer hangs the request
        // for many minutes if the SMTP server doesn't answer (port
        // blocked at the upstream firewall, TLS handshake stalls,
        // etc.). 10s is generous for any healthy relay, fast enough
        // that the API returns a 502 + audit row well before the
        // public-form fetch times out client-side.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
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

/**
 * Thin shim that routes through `services/features/Email/EmailService.ts`.
 * `EmailService.sendEmail` reads provider config from `siteFlags.mail`
 * (admin-configurable, encrypted at rest) and falls back to SMTP env
 * vars when the DB block is absent — so legacy deployments keep working
 * unchanged.
 *
 * Caller passes the `mail` block through; we don't read `siteFlags`
 * here because this module is loaded outside the GraphQL/service
 * context. `pages/api/inquiry.ts` already pulls `flags` for the
 * recipient + enable check; it now also passes `flags.mail`.
 */
import {sendEmail as serviceSendEmail} from '@services/features/Email/EmailService';
import type {ISiteMailConfig} from '@services/features/Seo/SiteFlagsService';

export async function sendInquiryEmail(
    p: InquiryEmailPayload,
    mail?: ISiteMailConfig,
): Promise<InquirySendResult> {
    const result = await serviceSendEmail(mail, {
        to: p.to,
        subject: p.subject,
        text: p.text,
        html: p.html,
        replyTo: p.replyTo,
    });
    if (!result.ok) {
        return {ok: false, error: result.error};
    }
    return {ok: true, messageId: result.messageId};
}
