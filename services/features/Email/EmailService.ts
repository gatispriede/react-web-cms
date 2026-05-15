/**
 * EmailService — provider-pluggable transport for the public-site
 * inquiry form, MCP `email.send`, and admin "test send" tool.
 *
 * Provider chain (highest → lowest precedence):
 *   1. SiteFlags `mail.provider` → `smtp` | `resend` | `disabled`
 *   2. legacy env-var SMTP path (`SMTP_HOST` / `SMTP_PORT` / etc.)
 *
 * Rule: when an admin enables a DB provider it always wins — the
 * env-var path is the migration on-ramp for pre-DB deployments and is
 * shadowed the moment `mail.provider` becomes non-empty.
 *
 * Caching: the underlying nodemailer / fetch handle is keyed by a
 * config signature so a credential rotation through the admin UI
 * invalidates the cache and the next request rebuilds against fresh
 * material. Signatures include the secret material so they're not safe
 * to log; we hash them before stashing.
 *
 * Resend integration: we use the documented REST API
 * (`POST https://api.resend.com/emails`) directly via `fetch` rather
 * than pulling in the `resend` SDK — keeps deps small, the surface is
 * a one-liner, and the SDK is just a thin wrapper anyway. If the
 * operator later wants the SDK they can swap `_resendSend` without
 * touching the rest of the file.
 */

import {readFileSync} from 'fs';
import nodemailer, {Transporter} from 'nodemailer';
import {createHash} from 'crypto';

import {decrypt} from '@services/infra/secretBox';
import type {ISiteMailConfig} from '@services/features/Seo/SiteFlagsService';
import {getSuppressionList, getWarmupLimiter, getEmailLog} from './emailServices';

export interface EmailPayload {
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
    /** Override `from` for one send (e.g. test-send identifier).
     *  Defaults to the configured `from` / `MAIL_FROM`. */
    from?: string;
    /**
     * W8f — RFC 8058 one-click unsubscribe. When set, EmailService
     * adds `List-Unsubscribe: <mailto:...>, <https://.../unsubscribe?token=...>`
     * and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers
     * on both SMTP and Resend code paths. Required by Gmail / Yahoo for
     * bulk senders (2024 rule).
     */
    listUnsubscribeUrl?: string;
    listUnsubscribeMailto?: string;
    /** Arbitrary extra headers — both transports forward them. */
    extraHeaders?: Record<string, string>;
}

export interface EmailSendResult {
    ok: boolean;
    error?: string;
    messageId?: string;
    /** Wall-clock duration of the send call (ms). Useful for the
     *  admin "test send" UI to surface "took 412ms". */
    durationMs?: number;
    provider?: 'smtp' | 'resend' | 'disabled' | 'env-smtp';
    /**
     * W8c — sentinel returned when pre-send checks short-circuit before
     * dispatch. `suppressed` = recipient is on the suppression list;
     * `warmup-skipped` = today's warmup cap was already hit. Both leave
     * `ok: false` so callers don't double-account success.
     */
    skippedReason?: 'suppressed' | 'warmup-skipped';
}

interface ResolvedConfig {
    provider: 'smtp' | 'resend' | 'disabled' | 'env-smtp';
    from?: string;
    /** Populated when the operator picked a provider but creds are
     *  missing or undecryptable. Surfaced in the test-send error so
     *  the admin sees exactly which field to fill. */
    missing?: string[];
    smtp?: {
        host: string;
        port: number;
        user: string;
        pass: string;
    };
    resend?: {
        apiKey: string;
    };
}

// ──────────────────────────────────────────────────────────────────────
// Config resolution — DB first, env-var fallback
// ──────────────────────────────────────────────────────────────────────

/** Read an env value with `*_FILE` Docker-secrets precedence. */
function readSecret(name: string): string | undefined {
    const filePath = process.env[`${name}_FILE`];
    if (filePath) {
        try {
            return readFileSync(filePath, 'utf8').trim();
        } catch (err) {
             
            console.error(`[EmailService] failed reading ${name}_FILE at ${filePath}:`, err);
            return undefined;
        }
    }
    const direct = process.env[name];
    return direct ? direct.trim() : undefined;
}

function envSmtpConfig(): ResolvedConfig | null {
    const host = readSecret('SMTP_HOST');
    const port = Number(readSecret('SMTP_PORT') ?? '0');
    const user = readSecret('SMTP_USER');
    const pass = readSecret('SMTP_PASS');
    const from = readSecret('MAIL_FROM');
    if (!host || !port || !user || !pass) return null;
    return {provider: 'env-smtp', from, smtp: {host, port, user, pass}};
}

/** Resolve the effective provider config from a SiteFlags `mail`
 *  block, falling back to env-var SMTP when the block is absent. */
export function resolveMailConfig(mail: ISiteMailConfig | undefined): ResolvedConfig {
    if (mail?.provider) {
        if (mail.provider === 'disabled') {
            return {provider: 'disabled', from: mail.from};
        }
        if (mail.provider === 'smtp') {
            const pass = mail.smtpPassEncrypted ? safeDecrypt(mail.smtpPassEncrypted) : '';
            const host = mail.smtpHost ?? '';
            const user = mail.smtpUser ?? '';
            const port = mail.smtpPort ?? 0;
            const missing = [
                !host && 'SMTP host',
                !port && 'SMTP port',
                !user && 'SMTP user',
                !pass && (mail.smtpPassEncrypted ? 'SMTP password (decrypt failed — check SECRETBOX_KEY)' : 'SMTP password'),
            ].filter(Boolean) as string[];
            if (missing.length) {
                return {provider: 'disabled', from: mail.from, missing};
            }
            return {provider: 'smtp', from: mail.from, smtp: {host, port, user, pass}};
        }
        if (mail.provider === 'resend') {
            const apiKey = mail.resendApiKeyEncrypted ? safeDecrypt(mail.resendApiKeyEncrypted) : '';
            if (!apiKey) {
                return {
                    provider: 'disabled',
                    from: mail.from,
                    missing: [mail.resendApiKeyEncrypted
                        ? 'Resend API key (decrypt failed — check SECRETBOX_KEY)'
                        : 'Resend API key'],
                };
            }
            return {provider: 'resend', from: mail.from, resend: {apiKey}};
        }
    }
    return envSmtpConfig() ?? {provider: 'disabled'};
}

function safeDecrypt(boxed: string): string {
    try {
        return decrypt(boxed);
    } catch (err) {
         
        console.error('[EmailService] decrypt failed (likely wrong SECRETBOX_KEY):', (err as Error).message);
        return '';
    }
}

// ──────────────────────────────────────────────────────────────────────
// SMTP transport cache
// ──────────────────────────────────────────────────────────────────────

let cachedSmtp: Transporter | null = null;
let cachedSmtpSig = '';

function smtpSig(c: NonNullable<ResolvedConfig['smtp']>): string {
    return createHash('sha256')
        .update([c.host, c.port, c.user, c.pass].join('|'))
        .digest('hex');
}

function smtpTransport(c: NonNullable<ResolvedConfig['smtp']>): Transporter {
    const sig = smtpSig(c);
    if (cachedSmtp && cachedSmtpSig === sig) return cachedSmtp;
    cachedSmtp = nodemailer.createTransport({
        host: c.host,
        port: c.port,
        secure: c.port === 465 || c.port === 2465,
        auth: {user: c.user, pass: c.pass},
        pool: true,
        maxConnections: 2,
        maxMessages: 50,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
    });
    cachedSmtpSig = sig;
    return cachedSmtp;
}

// ──────────────────────────────────────────────────────────────────────
// Provider implementations
// ──────────────────────────────────────────────────────────────────────

function buildExtraHeaders(p: EmailPayload): Record<string, string> | undefined {
    const headers: Record<string, string> = {...(p.extraHeaders ?? {})};
    // RFC 8058: List-Unsubscribe with at least one URI. We always emit
    // both mailto + https when present — Gmail / Yahoo prefer the https
    // form (one-click POST), older clients fall back to mailto.
    const parts: string[] = [];
    if (p.listUnsubscribeMailto) parts.push(`<mailto:${p.listUnsubscribeMailto}>`);
    if (p.listUnsubscribeUrl) parts.push(`<${p.listUnsubscribeUrl}>`);
    if (parts.length > 0) {
        headers['List-Unsubscribe'] = parts.join(', ');
        if (p.listUnsubscribeUrl) {
            headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
        }
    }
    return Object.keys(headers).length ? headers : undefined;
}

async function _smtpSend(c: NonNullable<ResolvedConfig['smtp']>, from: string, p: EmailPayload): Promise<EmailSendResult> {
    const tr = smtpTransport(c);
    const info = await tr.sendMail({
        from,
        to: p.to,
        subject: p.subject,
        text: p.text,
        html: p.html ?? p.text,
        replyTo: p.replyTo,
        headers: buildExtraHeaders(p),
    });
    return {ok: true, messageId: info.messageId};
}

async function _resendSend(apiKey: string, from: string, p: EmailPayload): Promise<EmailSendResult> {
    // Resend REST: https://resend.com/docs/api-reference/emails/send-email
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            from,
            to: [p.to],
            subject: p.subject,
            text: p.text,
            html: p.html ?? undefined,
            reply_to: p.replyTo,
            headers: buildExtraHeaders(p),
        }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        return {ok: false, error: (json as {message?: string}).message ?? `Resend HTTP ${res.status}`};
    }
    return {ok: true, messageId: (json as {id?: string}).id};
}

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
    /** Free-form caller tag persisted on the EmailLog row. */
    tag?: string;
    /**
     * Skip the suppression-list pre-check. Reserved for the unsubscribe
     * confirmation email itself + the admin test-send — every other
     * call site must respect the suppression list.
     */
    bypassSuppression?: boolean;
    /** Skip the warmup cap. Used by admin test-sends. */
    bypassWarmup?: boolean;
}

/**
 * Send an email through the resolved provider. Caller passes the live
 * `mail` block (typically from `SiteFlagsService.get().mail`) — the
 * service does not read from Mongo itself, keeping it pure and
 * test-friendly.
 *
 * W8c — gates the send through the suppression list + warmup limiter
 * before dispatch and writes an `EmailLog` row for every attempt
 * (sent / suppressed / warmup-skipped / failed) so the deliverability
 * dashboard has a consistent feed.
 */
export async function sendEmail(
    mail: ISiteMailConfig | undefined,
    payload: EmailPayload,
    options: SendEmailOptions = {},
): Promise<EmailSendResult> {
    const cfg = resolveMailConfig(mail);
    const from = payload.from ?? cfg.from;
    const started = Date.now();
    const logSvc = getEmailLog();
    const recordLog = (row: {
        outcome: 'sent' | 'suppressed' | 'warmup-skipped' | 'failed';
        messageId?: string;
        error?: string;
    }) => {
        if (!logSvc) return;
        void logSvc.recordSend({
            to: String(payload.to ?? '').trim().toLowerCase(),
            from,
            subject: payload.subject,
            provider: cfg.provider,
            outcome: row.outcome,
            messageId: row.messageId,
            error: row.error,
            durationMs: Date.now() - started,
            tag: options.tag,
        });
    };

    // ── Pre-flight: suppression list ──────────────────────────────────
    if (!options.bypassSuppression) {
        const sup = getSuppressionList();
        if (sup) {
            try {
                const check = await sup.isSuppressed(payload.to);
                if (check.suppressed) {
                    recordLog({outcome: 'suppressed', error: `suppressed:${check.row?.kind ?? 'unknown'}`});
                    return {
                        ok: false,
                        provider: cfg.provider,
                        skippedReason: 'suppressed',
                        error: `Recipient suppressed (${check.row?.kind ?? 'unknown'}).`,
                        durationMs: Date.now() - started,
                    };
                }
            } catch (err) {
                // Defensive: never let a suppression check failure block
                // a legitimate send. Log and continue.

                console.warn('[EmailService] suppression check failed:', (err as Error)?.message ?? err);
            }
        }
    }

    // ── Pre-flight: warmup cap ────────────────────────────────────────
    if (!options.bypassWarmup) {
        const warm = getWarmupLimiter();
        if (warm) {
            try {
                const can = await warm.canSend();
                if (!can.ok) {
                    recordLog({outcome: 'warmup-skipped', error: `warmup-cap:${can.capToday}`});
                    // Hand the payload to the warmup queue worker — the
                    // worker drains it in the next ramp window. Best-
                    // effort: in-process queue, see WarmupQueueWorker.ts.
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-require-imports
                        const {enqueueWarmupDeferred} = require('./WarmupQueueWorker');
                        enqueueWarmupDeferred(payload);
                    } catch { /* worker not loaded */ }
                    return {
                        ok: false,
                        provider: cfg.provider,
                        skippedReason: 'warmup-skipped',
                        error: `Daily warmup cap reached (${can.sentToday}/${can.capToday}).`,
                        durationMs: Date.now() - started,
                    };
                }
            } catch { /* warmup is best-effort */ }
        }
    }

    if (cfg.provider === 'disabled') {
        const error = cfg.missing?.length
            ? `${mail?.provider ?? 'Email'} provider selected but missing: ${cfg.missing.join(', ')}.`
            : 'Email is disabled. Pick a provider in admin → System → Email and fill in credentials, or set SMTP_* env vars.';
        return {
            ok: false,
            provider: 'disabled',
            error,
            durationMs: Date.now() - started,
        };
    }
    if (!from) {
        return {
            ok: false,
            provider: cfg.provider,
            error: 'mail.from (or MAIL_FROM env) is not set.',
            durationMs: Date.now() - started,
        };
    }

    try {
        let result: EmailSendResult;
        if (cfg.provider === 'resend' && cfg.resend) {
            result = await _resendSend(cfg.resend.apiKey, from, payload);
        } else if ((cfg.provider === 'smtp' || cfg.provider === 'env-smtp') && cfg.smtp) {
            result = await _smtpSend(cfg.smtp, from, payload);
        } else {
            recordLog({outcome: 'failed', error: 'Provider config incomplete'});
            return {ok: false, provider: cfg.provider, error: 'Provider config incomplete', durationMs: Date.now() - started};
        }
        const final = {...result, provider: cfg.provider, durationMs: Date.now() - started};
        recordLog({
            outcome: final.ok ? 'sent' : 'failed',
            messageId: final.messageId,
            error: final.ok ? undefined : final.error,
        });
        if (final.ok) {
            const warm = getWarmupLimiter();
            if (warm) { void warm.recordSend(); }
        }
        return final;
    } catch (err) {

        console.error(`[EmailService:${cfg.provider}] send failed:`, err);
        recordLog({outcome: 'failed', error: String((err as Error)?.message ?? err)});
        return {
            ok: false,
            provider: cfg.provider,
            error: String((err as Error)?.message ?? err),
            durationMs: Date.now() - started,
        };
    }
}

/** For tests — purge the SMTP cache between cases. */
export function _resetEmailServiceCache(): void {
    cachedSmtp = null;
    cachedSmtpSig = '';
}
